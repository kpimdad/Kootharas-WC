/**
 * fetch-results.js
 * Runs via GitHub Actions (server-side, no CORS).
 * Fetches finished WC 2026 matches from football-data.org,
 * scores predictions, and updates Firestore.
 *
 * Required env vars:
 *   FOOTBALL_API_KEY          — football-data.org token
 *   FIREBASE_SERVICE_ACCOUNT  — Firebase service account JSON (as a string)
 */

'use strict';
const https   = require('https');
const path    = require('path');
const admin   = require('firebase-admin');

// ── Load MATCHES index (matchId + kickoffUTC + teams) ─────────────────────────
const MATCHES = require('./matches-index.json');
console.log('Fixtures loaded:', MATCHES.length);

// ── Firebase Admin ────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Scoring (mirror of app.js) ────────────────────────────────────────────────
function calculatePoints(pA, pB, rA, rB) {
  if (pA === rA && pB === rB) return 13;
  const predWin = pA > pB ? 1 : pA < pB ? -1 : 0;
  const realWin = rA > rB ? 1 : rA < rB ? -1 : 0;
  return predWin === realWin ? 10 : 0;
}

// ── Fetch from football-data.org ──────────────────────────────────────────────
function fetchAPI(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.football-data.org',
      path,
      headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY }
    };
    https.get(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`API error ${res.statusCode}: ${data}`));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error: ' + e.message)); }
      });
    }).on('error', reject);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[${new Date().toISOString()}] Starting WC result sync…`);

  // Fetch yesterday + today (UTC) to avoid missing matches that kicked off
  // near midnight — the run fires on the next UTC date and would miss them
  // with a single-day filter. The script skips already-scored matches so
  // fetching a wider window is harmless.
  const now  = new Date();
  const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today     = now.toISOString().slice(0, 10);
  console.log(`Fetching results for ${yesterday} → ${today}`);

  let data;
  try {
    data = await fetchAPI(`/v4/competitions/WC/matches?status=FINISHED&dateFrom=${yesterday}&dateTo=${today}`);
  } catch (e) {
    console.warn('Date-filtered fetch failed, retrying with season param…', e.message);
    data = await fetchAPI(`/v4/competitions/WC/matches?status=FINISHED&season=2026&dateFrom=${yesterday}&dateTo=${today}`);
  }

  const finished = (data.matches || []).filter(m => m.status === 'FINISHED');
  console.log(`Found ${finished.length} finished match(es)`);

  // Capture ranks BEFORE any updates — mirror the app's multi-level sort
  // (points → exact scores → correct results → fewer predictions submitted)
  const prevRanks = {};
  let allUsersData = [];
  try {
    const usersSnap = await db.collection('users').get();
    usersSnap.forEach(d => { if (!d.data().isAdminAccount && !d.data().disabled) allUsersData.push({ id: d.id, ...d.data() }); });
    allUsersData.sort((a, b) => {
      if ((b.totalPoints          || 0) !== (a.totalPoints          || 0)) return (b.totalPoints          || 0) - (a.totalPoints          || 0);
      if ((b.computedExact        || 0) !== (a.computedExact        || 0)) return (b.computedExact        || 0) - (a.computedExact        || 0);
      if ((b.computedWinner       || 0) !== (a.computedWinner       || 0)) return (b.computedWinner       || 0) - (a.computedWinner       || 0);
      return (a.predictionsSubmitted || 0) - (b.predictionsSubmitted || 0);
    });
    allUsersData.forEach((u, i) => { prevRanks[u.id] = i + 1; });
    console.log(`Pre-update ranks captured for ${allUsersData.length} users`);
  } catch (e) { console.warn('Could not capture pre-update ranks:', e.message); }

  let updated = 0;

  for (const apiMatch of finished) {
    const rA = apiMatch.score?.fullTime?.home;
    const rB = apiMatch.score?.fullTime?.away;
    if (rA == null || rB == null) continue;

    // Match by kickoff time (±5 min tolerance)
    const apiTime = new Date(apiMatch.utcDate).getTime();
    const ourMatch = MATCHES.find(
      m => Math.abs(new Date(m.kickoffUTC).getTime() - apiTime) < 5 * 60 * 1000
    );

    if (!ourMatch) {
      console.log(`  ⚠ No local match for: ${apiMatch.homeTeam?.name} vs ${apiMatch.awayTeam?.name} @ ${apiMatch.utcDate}`);
      continue;
    }

    // Check existing Firestore state
    const matchRef = db.collection('matches').doc(ourMatch.matchId);
    const matchDoc = await matchRef.get();
    const current  = matchDoc.exists ? matchDoc.data() : {};

    if (current.resultA === rA && current.resultB === rB && current.status === 'completed') {
      console.log(`  — Already scored: ${ourMatch.teamA} ${rA}–${rB} ${ourMatch.teamB}`);
      continue;
    }

    // Write result to Firestore
    await matchRef.set({ resultA: rA, resultB: rB, status: 'completed' }, { merge: true });

    // Score all predictions for this match
    const predsSnap = await db.collection('predictions')
      .where('matchId', '==', ourMatch.matchId).get();

    const predBatch = db.batch();
    const deltas = {};

    let skipped = 0;
    predsSnap.forEach(doc => {
      const p    = doc.data();
      const pts  = calculatePoints(p.predictedA, p.predictedB, rA, rB);
      const prev = p.pointsAwarded ?? null;
      if (prev === pts) { skipped++; return; }  // already correct — skip write
      predBatch.update(doc.ref, { pointsAwarded: pts });
      deltas[p.userId] = (deltas[p.userId] || 0) + (pts - (prev ?? 0));
    });
    if (skipped > 0) console.log(`    (skipped ${skipped} predictions already at correct score)`);

    await predBatch.commit();

    // Update user total points
    const userBatch = db.batch();
    for (const [uid, delta] of Object.entries(deltas)) {
      if (delta === 0) continue;
      const uRef  = db.collection('users').doc(uid);
      const uSnap = await uRef.get();
      if (uSnap.exists) {
        userBatch.update(uRef, { totalPoints: (uSnap.data().totalPoints || 0) + delta });
      }
    }
    await userBatch.commit();

    console.log(`  ✅ ${ourMatch.teamA} ${rA}–${rB} ${ourMatch.teamB} · ${predsSnap.size} prediction(s) scored`);
    updated++;
  }

  // If any matches were updated, persist rank snapshot for arrow display
  if (updated > 0 && Object.keys(prevRanks).length > 0) {
    try {
      const usersSnap2 = await db.collection('users').get();
      const allUsers2 = [];
      usersSnap2.forEach(d => { if (!d.data().isAdminAccount && !d.data().disabled) allUsers2.push({ id: d.id, ...d.data() }); });
      allUsers2.sort((a, b) => {
        if ((b.totalPoints          || 0) !== (a.totalPoints          || 0)) return (b.totalPoints          || 0) - (a.totalPoints          || 0);
        if ((b.computedExact        || 0) !== (a.computedExact        || 0)) return (b.computedExact        || 0) - (a.computedExact        || 0);
        if ((b.computedWinner       || 0) !== (a.computedWinner       || 0)) return (b.computedWinner       || 0) - (a.computedWinner       || 0);
        return (a.predictionsSubmitted || 0) - (b.predictionsSubmitted || 0);
      });
      const currentRanks = {};
      allUsers2.forEach((u, i) => { currentRanks[u.id] = i + 1; });
      await db.collection('meta').doc('rankSnapshot').set({ prevRanks, currentRanks });
      console.log('Rank snapshot written to Firestore');
    } catch (e) { console.warn('Could not write rank snapshot:', e.message); }
  }

  // Write last-sync timestamp to Firestore so the app can show it
  await db.collection('config').doc('lastSync').set({
    syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    matchesUpdated: updated
  });

  console.log(`Done. ${updated} match(es) updated.`);
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
