/**
 * backup-predictions.js
 * Runs via GitHub Actions every 30 minutes.
 * When a match has just kicked off (within the last 35 min),
 * snapshots all predictions for that match into an Excel file
 * and commits it to backups/ in the repo.
 *
 * Required env vars (same as fetch-results.js):
 *   FIREBASE_SERVICE_ACCOUNT — Firebase service account JSON string
 */

'use strict';

const path  = require('path');
const fs    = require('fs');
const admin = require('firebase-admin');
const Excel = require('exceljs');

const MATCHES = require('./matches-index.json');

// ── Firebase Admin ────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Find matches that kicked off in the last 35 minutes ───────────────────────
const now       = Date.now();
const WINDOW_MS = 35 * 60 * 1000; // 35-min window (workflow runs every 30 min + buffer)

const justStarted = MATCHES.filter(m => {
  const ko = new Date(m.kickoffUTC).getTime();
  return ko <= now && ko >= now - WINDOW_MS;
});

if (justStarted.length === 0) {
  console.log('No matches kicked off in the last 35 minutes — nothing to back up.');
  process.exit(0);
}

console.log(`${justStarted.length} match(es) just started:`, justStarted.map(m => `${m.teamA} vs ${m.teamB}`).join(', '));

// ── Fetch users (userId → nickname) ──────────────────────────────────────────
const usersSnap = await db.collection('users').get();
const nickMap   = {};
usersSnap.forEach(d => { nickMap[d.id] = d.data().nickname || d.data().name || d.id; });

// ── For each kicked-off match, pull predictions and write Excel ───────────────
const backupsDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir);

for (const m of justStarted) {
  const predSnap = await db.collection('predictions')
    .where('matchId', '==', m.matchId)
    .get();

  const wb   = new Excel.Workbook();
  const ws   = wb.addWorksheet('Predictions');

  // Header row
  ws.columns = [
    { header: 'Player',     key: 'player',     width: 20 },
    { header: 'Match',      key: 'match',      width: 30 },
    { header: 'Prediction', key: 'prediction', width: 14 },
  ];
  ws.getRow(1).font      = { bold: true };
  ws.getRow(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2D3D' } };
  ws.getRow(1).font      = { bold: true, color: { argb: 'FFFFD700' } };

  // Data rows
  const rows = [];
  predSnap.forEach(d => {
    const p = d.data();
    rows.push({
      player:     nickMap[p.userId] || p.userId,
      match:      `${m.teamA} vs ${m.teamB}`,
      prediction: `${p.predictedA} - ${p.predictedB}`,
    });
  });

  // Sort by player name
  rows.sort((a, b) => a.player.localeCompare(b.player));
  rows.forEach(r => ws.addRow(r));

  // Alternate row shading
  ws.eachRow((row, i) => {
    if (i > 1) {
      row.fill = { type: 'pattern', pattern: 'solid',
        fgColor: { argb: i % 2 === 0 ? 'FF0F1923' : 'FF162030' } };
      row.font = { color: { argb: 'FFD0E0F0' } };
    }
  });

  // Save file
  const dateStr  = new Date(m.kickoffUTC).toISOString().slice(0, 10);
  const matchStr = `${m.teamA.replace(/\s+/g,'_')}_vs_${m.teamB.replace(/\s+/g,'_')}`;
  const fileName = `${dateStr}_${m.matchId}_${matchStr}.xlsx`;
  const filePath = path.join(backupsDir, fileName);

  await wb.xlsx.writeFile(filePath);
  console.log(`✅ Backup saved: backups/${fileName} (${rows.length} predictions)`);
}

process.exit(0);
