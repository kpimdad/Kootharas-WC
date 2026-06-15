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
const fs      = require('fs');
const path    = require('path');
const vm      = require('vm');
const admin   = require('firebase-admin');

// ── Load MATCHES array from static matches.js ─────────────────────────────────
// vm context only exposes `var` declarations, not `const`, so we rewrite on the fly
const matchesPath = path.resolve(__dirname, '..', 'matches.js');
const matchesSrc  = fs.readFileSync(matchesPath, 'utf8')
  .replace(/\bconst\s+MATCHES\b/, 'var MATCHES');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(matchesSrc, ctx);
const MATCHES = ctx.MATCHES;

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

  let data;
  try {
    data = await fetchAPI('/v4/competitions/WC/matches?status=FINISHED');
  } catch (e) {
    // Try with season param if default fails
    console.warn('First attempt failed, retrying with season=2026…', e.message);
    data = await fetchAPI('/v4/competitions/WC/matches?status=FINISHED&season=2026');
  }

  const finished = (data.matches || []).filter(m => m.status === 'FINISHED');
  console.log(`Found ${finished.length} finished match(es) from API`);

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

    predsSnap.forEach(doc => {
      const p    = doc.data();
      const pts  = calculatePoints(p.predictedA, p.predictedB, rA, rB);
      const prev = p.pointsAwarded ?? 0;
      predBatch.update(doc.ref, { pointsAwarded: pts });
      deltas[p.userId] = (deltas[p.userId] || 0) + (pts - prev);
    });

    await predBatch.commit();

    // Update user total points
    const userBatch = db.batch();
    for (const [uid, delta] of Object.entries(deltas)) {
      if (delta === 0) continue;
      const uRef  = db.collection('users').doc(uid);
      const uSnap = await uRef.get();
      if (uSnap.exists()) {
        userBatch.update(uRef, { totalPoints: (uSnap.data().totalPoints || 0) + delta });
      }
    }
    await userBatch.commit();

    console.log(`  ✅ ${ourMatch.teamA} ${rA}–${rB} ${ourMatch.teamB} · ${predsSnap.size} prediction(s) scored`);
    updated++;
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
