/**
 * backfill-predictions.js
 * 1. Resets ALL existing predictions and user points to zero
 * 2. Creates any missing users from predictions-backfill.json
 * 3. Enters all predictions and scores them against existing match results
 *
 * Run via GitHub Actions (workflow_dispatch).
 */
'use strict';
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const MATCHES  = require('./matches-index.json');
const BACKFILL = require('./predictions-backfill.json');

function calculatePoints(pA, pB, rA, rB) {
  if (pA === rA && pB === rB) return 13;
  const predWin = pA > pB ? 1 : pA < pB ? -1 : 0;
  const realWin = rA > rB ? 1 : rA < rB ? -1 : 0;
  return predWin === realWin ? 10 : 0;
}

function normalise(s) {
  return (s || '').toLowerCase().replace(/[\s\-\.&]/g, '');
}

function findMatch(teamA, teamB) {
  const nA = normalise(teamA), nB = normalise(teamB);
  return MATCHES.find(m =>
    normalise(m.teamA) === nA && normalise(m.teamB) === nB
  ) || MATCHES.find(m =>
    normalise(m.teamA) === nB && normalise(m.teamB) === nA
  ) || MATCHES.find(m =>
    (normalise(m.teamA).includes(nA) || nA.includes(normalise(m.teamA))) &&
    (normalise(m.teamB).includes(nB) || nB.includes(normalise(m.teamB)))
  );
}

async function deleteCollection(colRef) {
  const snap = await colRef.get();
  if (snap.empty) return 0;
  const batches = [];
  let batch = db.batch();
  let count = 0;
  snap.forEach(doc => {
    batch.delete(doc.ref);
    count++;
    if (count % 499 === 0) { batches.push(batch); batch = db.batch(); }
  });
  batches.push(batch);
  for (const b of batches) await b.commit();
  return count;
}

async function main() {
  console.log(`[${new Date().toISOString()}] Starting full reset + backfill…\n`);

  // ── STEP 1: Delete all predictions ────────────────────────────────────────
  console.log('Step 1: Deleting all existing predictions…');
  const deleted = await deleteCollection(db.collection('predictions'));
  console.log(`  Deleted ${deleted} prediction(s)\n`);

  // ── STEP 2: Reset all user points to 0 ────────────────────────────────────
  console.log('Step 2: Resetting all user points to 0…');
  const usersSnap = await db.collection('users').get();
  const resetBatch = db.batch();
  usersSnap.forEach(d => {
    resetBatch.update(d.ref, { totalPoints: 0, exactScores: 0, correctResults: 0 });
  });
  await resetBatch.commit();
  console.log(`  Reset ${usersSnap.size} user(s)\n`);

  // ── STEP 3: Build userId map, create missing users ─────────────────────────
  console.log('Step 3: Checking / creating users…');
  const usersSnap2 = await db.collection('users').get();
  const userMap = {};
  usersSnap2.forEach(d => {
    if (!d.data().disabled) userMap[normalise(d.data().nickname)] = d.id;
  });

  const nicknamesNeeded = [...new Set(BACKFILL.map(e => e.nickname))];
  for (const nickname of nicknamesNeeded) {
    if (userMap[normalise(nickname)]) {
      console.log(`  ✓ ${nickname}`);
    } else {
      const ref = db.collection('users').doc();
      await ref.set({
        nickname,
        pinHash: '', mobile: '',
        isAdmin: false, totalPoints: 0, exactScores: 0, correctResults: 0,
        championPick: '', goldenBootPick: '', lastMinuteCount: 0,
        photoURL: '', createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      userMap[normalise(nickname)] = ref.id;
      console.log(`  ✅ Created "${nickname}"`);
    }
  }

  // ── STEP 4: Fetch match results ────────────────────────────────────────────
  console.log('\nStep 4: Loading match results…');
  const matchResultsSnap = await db.collection('matches').get();
  const matchResults = {};
  matchResultsSnap.forEach(d => {
    const data = d.data();
    if (data.resultA != null && data.resultB != null) matchResults[d.id] = data;
  });
  console.log(`  ${Object.keys(matchResults).length} match result(s) available`);

  // ── STEP 5: Insert predictions ─────────────────────────────────────────────
  console.log('\nStep 5: Inserting predictions…');
  let added = 0, errors = 0;
  const pointDeltas = {};

  for (const entry of BACKFILL) {
    const { nickname, teamA, teamB, predictedA, predictedB } = entry;
    const userId = userMap[normalise(nickname)];
    if (!userId) { console.log(`  ⚠ Unknown user: "${nickname}"`); errors++; continue; }

    const match = findMatch(teamA, teamB);
    if (!match) { console.log(`  ⚠ Unknown match: "${teamA}" vs "${teamB}"`); errors++; continue; }

    const predId  = `${userId}_${match.matchId}`;
    const result  = matchResults[match.matchId];
    const pts     = result ? calculatePoints(predictedA, predictedB, result.resultA, result.resultB) : null;

    await db.collection('predictions').doc(predId).set({
      userId, matchId: match.matchId,
      predictedA, predictedB,
      pointsAwarded: pts,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
      lastMinute: false, backfilled: true
    });

    if (pts != null) pointDeltas[userId] = (pointDeltas[userId] || 0) + pts;

    const resultStr = result ? ` (actual ${result.resultA}–${result.resultB} → ${pts} pts)` : ' (unscored)';
    console.log(`  ✅ ${nickname} · ${match.teamA} vs ${match.teamB}: ${predictedA}–${predictedB}${resultStr}`);
    added++;
  }

  // ── STEP 6: Update user totals ─────────────────────────────────────────────
  console.log('\nStep 6: Updating user totals…');
  const finalBatch = db.batch();
  for (const [uid, pts] of Object.entries(pointDeltas)) {
    finalBatch.update(db.collection('users').doc(uid), { totalPoints: pts });
  }
  await finalBatch.commit();

  // Print summary
  const usersSnap3 = await db.collection('users').get();
  usersSnap3.forEach(d => {
    const u = d.data();
    if (!u.disabled && !u.isAdminAccount) {
      console.log(`  ${u.nickname}: ${u.totalPoints || pointDeltas[d.id] || 0} pts`);
    }
  });

  console.log(`\nDone. Predictions added: ${added}, Errors: ${errors}`);
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
