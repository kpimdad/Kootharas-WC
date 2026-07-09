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

// ── Team name aliases (football-data.org name → our local name) ───────────────
// The API uses different spellings for some teams. Extend this as needed.
const TEAM_ALIASES = {
  'Bosnia and Herzegovina':        'Bosnia & Herzegovina',
  "Côte d'Ivoire":                 'Ivory Coast',
  "Cote d'Ivoire":                 'Ivory Coast',
  'Korea Republic':                'South Korea',
  'Republic of Korea':             'South Korea',
  'Czech Republic':                'Czechia',
  'United States':                 'USA',
  'Cabo Verde':                    'Cape Verde',
  'Congo DR':                      'DR Congo',
  'Democratic Republic of Congo':  'DR Congo',
};

function normalizeTeam(name) {
  if (!name) return '';
  return (TEAM_ALIASES[name] || name).toLowerCase().trim();
}

// Check if an API team name refers to the same team as a local name.
// Tries exact match first, then word-level overlap for edge cases.
function teamsMatch(apiName, localName) {
  const a = normalizeTeam(apiName);
  const b = localName.toLowerCase().trim();
  if (a === b) return true;
  const wordsA = a.split(/[\s&]+/).filter(w => w.length > 2);
  const wordsB = b.split(/[\s&]+/).filter(w => w.length > 2);
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  return wordsA.every(w => wordsB.some(bw => bw.includes(w) || w.includes(bw)));
}

// Find our local match for an API result.
// CRITICAL FIX: when two games share the same kickoff slot, disambiguate
// by team name instead of returning the first match found (which caused
// both API results to be mapped to the same local match).
function findLocalMatch(apiMatch) {
  const apiTime = new Date(apiMatch.utcDate).getTime();
  const apiHome = apiMatch.homeTeam?.name || '';
  const apiAway = apiMatch.awayTeam?.name || '';

  // Narrow to same-kickoff-time candidates (±5 min tolerance)
  const candidates = MATCHES.filter(
    m => Math.abs(new Date(m.kickoffUTC).getTime() - apiTime) < 5 * 60 * 1000
  );

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Multiple matches at same time — must match by team name
  const byTeam = candidates.find(
    m => teamsMatch(apiHome, m.teamA) && teamsMatch(apiAway, m.teamB)
  );
  if (byTeam) return byTeam;

  // Try reversed (API sometimes lists home/away differently)
  const byTeamRev = candidates.find(
    m => teamsMatch(apiHome, m.teamB) && teamsMatch(apiAway, m.teamA)
  );
  if (byTeamRev) return byTeamRev;

  // Could not disambiguate — log and skip (safer than scoring the wrong match)
  console.warn(`  ⚠ Cannot disambiguate ${apiHome} vs ${apiAway} @ ${apiMatch.utcDate} among ${candidates.length} candidates: ${candidates.map(c => `${c.teamA} vs ${c.teamB}`).join(', ')}`);
  return null;
}

// ── Scoring (mirror of app.js) ────────────────────────────────────────────────
// From QF onwards (Jul 9 20:00 UTC): exact=25, result=15, penalty=20
const QF_START_UTC           = new Date('2026-07-09T20:00:00Z');
const PENALTY_BONUS_QF       = 20;
// Jokers only apply to matches that kick off on or after this date.
const JOKER_START_UTC        = new Date('2026-06-28T00:00:00Z');
const KNOCKOUT_STAGE_IDS_SET = new Set(['R32', 'R16', 'QF', 'SF', '3rd', 'F']);

function getScoring(kickoffUTC) {
  return new Date(kickoffUTC) >= QF_START_UTC
    ? { exact: 25, result: 15, penalty: PENALTY_BONUS_QF }
    : { exact: 13, result: 10, penalty: 5 };
}

function calculatePoints(pA, pB, rA, rB, kickoffUTC) {
  const { exact, result } = getScoring(kickoffUTC || 0);
  if (pA === rA && pB === rB) return exact;
  const predWin = pA > pB ? 1 : pA < pB ? -1 : 0;
  const realWin = rA > rB ? 1 : rA < rB ? -1 : 0;
  return predWin === realWin ? result : 0;
}

function calculatePointsWithJoker(pA, pB, rA, rB, hasJoker, kickoffUTC) {
  if (!hasJoker) return calculatePoints(pA, pB, rA, rB, kickoffUTC);
  const { exact } = getScoring(kickoffUTC || 0);
  return (pA === rA && pB === rB) ? exact : 0;
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
  // with a single-day filter. Already-scored matches are skipped, so
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
  finished.forEach(m => console.log(`  API: ${m.homeTeam?.name} vs ${m.awayTeam?.name} @ ${m.utcDate} → ${m.score?.fullTime?.home}-${m.score?.fullTime?.away}`));

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

  // Load all jokers once — used to apply joker scoring per user per match
  const jokerMap = {}; // userId → Set<matchId>
  try {
    const jSnap = await db.collection('jokers').get();
    jSnap.forEach(d => { jokerMap[d.id] = new Set(d.data().matchIds || []); });
    console.log(`Jokers loaded for ${Object.keys(jokerMap).length} user(s)`);
  } catch (e) { console.warn('Could not load jokers:', e.message); }

  let updated = 0;

  for (const apiMatch of finished) {
    const rA = apiMatch.score?.fullTime?.home;
    const rB = apiMatch.score?.fullTime?.away;
    if (rA == null || rB == null) continue;

    const ourMatch = findLocalMatch(apiMatch);

    if (!ourMatch) {
      console.log(`  ⚠ No local match for: ${apiMatch.homeTeam?.name} vs ${apiMatch.awayTeam?.name} @ ${apiMatch.utcDate}`);
      continue;
    }

    console.log(`  Matched: API [${apiMatch.homeTeam?.name} vs ${apiMatch.awayTeam?.name}] → local [${ourMatch.teamA} vs ${ourMatch.teamB}] (${ourMatch.matchId})`);

    // Check existing Firestore state
    const matchRef = db.collection('matches').doc(ourMatch.matchId);
    const matchDoc = await matchRef.get();
    const current  = matchDoc.exists ? matchDoc.data() : {};

    if (current.resultA === rA && current.resultB === rB && current.status === 'completed') {
      console.log(`  — Already scored: ${ourMatch.teamA} ${rA}–${rB} ${ourMatch.teamB}`);
      continue;
    }

    // Determine penalty winner for knockout draw results from API data
    const isKnockout = KNOCKOUT_STAGE_IDS_SET.has(ourMatch.stage);
    let penaltyWinner = null;
    if (isKnockout && rA === rB && apiMatch.score?.winner && apiMatch.score.winner !== 'DRAW') {
      // Map API winner (HOME_TEAM/AWAY_TEAM) to our teamA/teamB
      // Check which local team the API home side refers to
      const homeIsTeamA = teamsMatch(apiMatch.homeTeam?.name || '', ourMatch.teamA);
      const apiWinnerIsHome = apiMatch.score.winner === 'HOME_TEAM';
      penaltyWinner = (apiWinnerIsHome === homeIsTeamA) ? 'teamA' : 'teamB';
      console.log(`    🥅 Penalty winner: ${penaltyWinner} (${penaltyWinner === 'teamA' ? ourMatch.teamA : ourMatch.teamB})`);
    }

    // Write result to Firestore
    const matchWriteData = { resultA: rA, resultB: rB, status: 'completed' };
    if (penaltyWinner) matchWriteData.penaltyWinner = penaltyWinner;
    await matchRef.set(matchWriteData, { merge: true });

    // Score all predictions for this match
    const predsSnap = await db.collection('predictions')
      .where('matchId', '==', ourMatch.matchId).get();

    const predBatch = db.batch();
    const deltas = {};

    const jokerEligible = new Date(ourMatch.kickoffUTC) >= JOKER_START_UTC;
    let skipped = 0, jokerHits = 0, penaltyCorrect = 0;
    const matchScoring = getScoring(ourMatch.kickoffUTC);
    predsSnap.forEach(doc => {
      const p        = doc.data();
      const hasJoker = jokerEligible && (jokerMap[p.userId]?.has(ourMatch.matchId) || false);
      let pts        = calculatePointsWithJoker(p.predictedA, p.predictedB, rA, rB, hasJoker, ourMatch.kickoffUTC);
      // Penalty bonus: if user predicted a draw and pick is correct
      const penBonus = (penaltyWinner && p.predictedA === p.predictedB && p.penaltyPick === penaltyWinner)
        ? matchScoring.penalty : 0;
      pts += penBonus;
      if (penBonus > 0) penaltyCorrect++;
      const prev = p.pointsAwarded ?? null;
      if (prev === pts) { skipped++; return; }  // already correct — skip write
      predBatch.update(doc.ref, { pointsAwarded: pts, jokerUsed: hasJoker, penaltyBonusAwarded: penBonus });
      deltas[p.userId] = (deltas[p.userId] || 0) + (pts - (prev ?? 0));
      if (hasJoker && pts - penBonus === matchScoring.exact) jokerHits++;
    });
    if (jokerHits > 0) console.log(`    (${jokerHits} joker hit(s) → ${JOKER_PTS} pts each)`);
    if (penaltyCorrect > 0) console.log(`    (${penaltyCorrect} penalty correct → +${PENALTY_BONUS} pts each)`);
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
