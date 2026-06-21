/* ═══════════════════════════════════════════════════════
   WC 2026 PREDICTION GAME — app.js
   Vanilla JS · Firebase Firestore · No build step
   ═══════════════════════════════════════════════════════ */

'use strict';

const { initializeApp }                                   = window.firebaseApp;
const { getFirestore, collection, doc, getDoc, getDocs,
        setDoc, updateDoc, query, where, orderBy,
        serverTimestamp, writeBatch }                     = window.firebaseFirestore;

// ── Subdivision flag fix (Scotland / England / Wales use invisible tag chars
//    that get stripped when saved as UTF-8 text; define them here in JS instead)
const SUBDIVISION_FLAGS = {
  'Scotland': '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
  'England':  '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  'Wales':    '\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}',
};
function getFlag(teamName, fallback) {
  return SUBDIVISION_FLAGS[teamName] || fallback;
}

// ── All 48 WC 2026 Teams (derived from matches.js) ─────
const ALL_TEAMS = [...new Set(
  MATCHES.filter(m => m.stage === 'Group').flatMap(m => [m.teamA, m.teamB])
)].sort();

// ── App State ──────────────────────────────────────────
const STATE = {
  db: null,
  session: null,
  matches: [],
  predictions: {},
  users: [],
  countdownTimers: [],
  currentPredictMatch: null,
};

// ── Rank movement helpers ──────────────────────────────
function loadPrevRanks() {
  try {
    const data = JSON.parse(localStorage.getItem('wc2026_rankData') || '{}');
    return data.prevRanks || {};
  } catch { return {}; }
}
function saveRankSnapshot(rankedUsers, currentMatchCount) {
  // Two-slot approach:
  //   prevRanks    = ranks before the latest result batch (used for arrows display)
  //   currentRanks = ranks as of last render (promoted to prevRanks on next new result)
  // This means arrows persist through refreshes and reset when new results arrive.
  try {
    const stored = JSON.parse(localStorage.getItem('wc2026_rankData') || '{}');
    const prevMatchCount = stored.prevMatchCount || 0;
    const newCurrentRanks = {};
    rankedUsers.forEach((u, i) => { newCurrentRanks[u.id] = i + 1; });

    if (currentMatchCount > prevMatchCount) {
      // New result(s) — promote current → prev, record fresh current
      localStorage.setItem('wc2026_rankData', JSON.stringify({
        prevRanks:      stored.currentRanks || {},
        currentRanks:   newCurrentRanks,
        prevMatchCount: currentMatchCount,
      }));
    } else {
      // No new results — keep prevRanks intact so arrows survive refreshes
      localStorage.setItem('wc2026_rankData', JSON.stringify({
        prevRanks:      stored.prevRanks || {},
        currentRanks:   newCurrentRanks,
        prevMatchCount,
      }));
    }
  } catch {}
}

// ── Session ────────────────────────────────────────────
const SESSION_KEY = 'wc2026_session';
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

function saveSession(userId, nickname, isAdmin) {
  const session = { userId, nickname, isAdmin, expires: Date.now() + SESSION_TTL };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  STATE.session = { userId, nickname, isAdmin };
}
function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!s || s.expires < Date.now()) { localStorage.removeItem(SESSION_KEY); return null; }
    return s;
  } catch { return null; }
}
function clearSession() { localStorage.removeItem(SESSION_KEY); STATE.session = null; }

// ── PIN Hashing ────────────────────────────────────────
async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Toast ──────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', lock: '🔒' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || icons.info}</span> ${msg}`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── View Router ────────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  // Bottom nav active state
  document.querySelectorAll('.bnav-btn[data-view]').forEach(b =>
    b.classList.toggle('active', b.dataset.view === id));
  const isLogin = id === 'view-login';
  document.getElementById('app-nav').style.display   = isLogin ? 'none' : 'flex';
  document.getElementById('bottom-nav').style.display = isLogin ? 'none' : 'flex';
  // Scroll to top on view change
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ── Time Helpers ───────────────────────────────────────
function matchMetaLabel(m) {
  if (m.stage === 'Group') {
    const md = m.matchDay.match(/MD(\d+)/)?.[1] || '1';
    return `Group ${m.group} · Match Day ${md}`;
  }
  return m.matchDay;
}

function formatKickoff(isoString) {
  return new Date(isoString).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });
}

function timeUntil(msOrIso) {
  const ms = typeof msOrIso === 'number' ? msOrIso : new Date(msOrIso).getTime();
  const diff = ms - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Lock time = kickoff - 5 minutes
function getLockMs(match) {
  return new Date(match.kickoffUTC).getTime() - 5 * 60 * 1000;
}
function isLocked(match) {
  return getLockMs(match) <= Date.now();
}
// Last 30 minutes before lock = show fire badge
function isLastMinuteWindow(match) {
  const lockMs = getLockMs(match);
  const now = Date.now();
  return now >= lockMs - 30 * 60 * 1000 && now < lockMs;
}

// ── Photo resize → base64 (FileReader — works on iOS Safari) ──
function resizeImageToBase64(file, size = 80) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.onload = e => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image decode failed'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          // Center-crop to square
          const min = Math.min(img.width, img.height);
          const sx  = (img.width  - min) / 2;
          const sy  = (img.height - min) / 2;
          ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } catch (err) { reject(err); }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Avatar ─────────────────────────────────────────────
const AVATAR_COLORS = [
  '#E74C3C','#3498DB','#2ECC71','#F39C12',
  '#9B59B6','#1ABC9C','#E67E22','#E91E63',
  '#00BCD4','#FF5722','#607D8B','#795548'
];

function getAvatarHTML(user, size = 36) {
  const name = user.nickname || '?';
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  const bg  = AVATAR_COLORS[idx];
  const initials = name.slice(0, 2).toUpperCase();
  const style = `width:${size}px;height:${size}px;font-size:${Math.floor(size * 0.38)}px;line-height:${size}px;`;
  if (user.photoURL) {
    return `<img class="avatar" src="${user.photoURL}" alt="${name}" style="${style}"
      onerror="this.outerHTML='<div class=\\'avatar\\' style=\\'background:${bg};${style}\\'>${initials}</div>'">`;
  }
  return `<div class="avatar" style="background:${bg};${style}">${initials}</div>`;
}

// ── Scoring ────────────────────────────────────────────
function calculatePoints(pA, pB, rA, rB) {
  if (Math.sign(pA - pB) !== Math.sign(rA - rB)) return 0;   // wrong result
  if (pA === rA && pB === rB) return 13;                       // exact score + correct result (10+3)
  return 10;                                                    // correct result/winner only
}

// ── Firestore ──────────────────────────────────────────
async function fetchMatches() {
  const snap = await getDocs(collection(STATE.db, 'matches'));
  const fs = {};
  snap.forEach(d => { fs[d.id] = d.data(); });
  STATE.matches = MATCHES.map(m => ({
    ...m,
    resultA: fs[m.matchId]?.resultA ?? null,
    resultB: fs[m.matchId]?.resultB ?? null,
    status:  fs[m.matchId]?.status  ?? m.status,
  }));
}

async function fetchMyPredictions() {
  if (!STATE.session) return;
  const snap = await getDocs(query(
    collection(STATE.db, 'predictions'),
    where('userId', '==', STATE.session.userId)
  ));
  STATE.predictions = {};
  snap.forEach(d => { const p = d.data(); STATE.predictions[p.matchId] = p; });
}

async function fetchUsers() {
  const snap = await getDocs(collection(STATE.db, 'users'));
  STATE.users = [];
  snap.forEach(d => {
    if (!d.data().disabled && !d.data().isAdminAccount) STATE.users.push({ id: d.id, ...d.data() });
  });
  STATE.users.sort((a, b) => {
    if ((b.totalPoints     || 0) !== (a.totalPoints     || 0)) return (b.totalPoints     || 0) - (a.totalPoints     || 0);
    if ((b.computedExact   || 0) !== (a.computedExact   || 0)) return (b.computedExact   || 0) - (a.computedExact   || 0);
    if ((b.computedWinner  || 0) !== (a.computedWinner  || 0)) return (b.computedWinner  || 0) - (a.computedWinner  || 0);
    return (a.predictionsSubmitted || 0) - (b.predictionsSubmitted || 0); // fewer played = better
  });
}

// ═══════════════════════════════════════════════════════
// VIEW 1 — LOGIN
// ═══════════════════════════════════════════════════════
async function initLoginView() {
  const snap = await getDocs(collection(STATE.db, 'users'));
  const sel  = document.getElementById('login-user-select');
  // Build a map of userId → pinHash for quick lookup on selection
  const userPinMap = {};
  sel.innerHTML = '<option value="">— Who are you? —</option>';
  snap.forEach(d => {
    if (d.data().disabled) return;
    if (d.data().isAdminAccount) return;
    const o = document.createElement('option');
    o.value = d.id; o.textContent = d.data().nickname;
    sel.appendChild(o);
    userPinMap[d.id] = d.data().pinHash || '';
  });

  // When user picks a name, toggle first-time vs returning UI
  sel.addEventListener('change', () => {
    const uid = sel.value;
    const confirmGroup = document.getElementById('login-pin-confirm-group');
    const pinLabel     = document.getElementById('login-pin-label');
    const firstMsg     = document.getElementById('login-firsttime-msg');
    const isNew = uid && !userPinMap[uid];
    pinLabel.textContent = isNew ? 'Choose a 4-Digit PIN' : '4-Digit PIN';
    confirmGroup.style.display = isNew ? 'block' : 'none';
    firstMsg.style.display     = isNew ? 'block'  : 'none';
    document.getElementById('login-error').classList.remove('show');
    document.getElementById('login-pin').value = '';
    if (uid) document.getElementById('login-pin').focus();
  });
}

async function handleLogin() {
  const userId = document.getElementById('login-user-select').value;
  const pin    = document.getElementById('login-pin').value.trim();
  const errEl  = document.getElementById('login-error');
  const btn    = document.getElementById('login-btn');
  errEl.classList.remove('show');
  if (!userId) { errEl.textContent = 'Select your name first.'; errEl.classList.add('show'); return; }
  if (!/^\d{4}$/.test(pin)) { errEl.textContent = 'PIN must be exactly 4 digits.'; errEl.classList.add('show'); return; }
  btn.disabled = true; btn.textContent = 'Checking…';
  try {
    const snap = await getDoc(doc(STATE.db, 'users', userId));
    if (!snap.exists()) throw new Error('not found');
    const user = snap.data();
    if (!user.pinHash) {
      // First login — save the PIN they chose
      const confirm = document.getElementById('login-pin-confirm').value.trim();
      if (pin !== confirm) {
        errEl.textContent = 'PINs do not match — try again.'; errEl.classList.add('show');
        btn.disabled = false; btn.textContent = 'Enter 🏟️'; return;
      }
      await updateDoc(doc(STATE.db, 'users', userId), { pinHash: await hashPin(pin) });
    } else {
      if (await hashPin(pin) !== user.pinHash) throw new Error('wrong pin');
    }
    saveSession(userId, user.nickname, user.isAdmin || false);
    document.getElementById('login-pin').value = '';
    document.getElementById('login-pin-confirm').value = '';
    await initApp();
  } catch {
    errEl.textContent = 'Wrong PIN — try again.'; errEl.classList.add('show');
    document.getElementById('login-pin').value = '';
    document.getElementById('login-pin').focus();
  }
  btn.disabled = false; btn.textContent = 'Enter 🏟️';
}

// ── Admin password login (hidden modal) ───────────────
let _adminTapCount = 0, _adminTapTimer = null;
function onTrophyTap() {
  _adminTapCount++;
  clearTimeout(_adminTapTimer);
  _adminTapTimer = setTimeout(() => { _adminTapCount = 0; }, 2000);
  if (_adminTapCount >= 5) {
    _adminTapCount = 0;
    document.getElementById('admin-login-modal').style.display = 'flex';
    document.getElementById('admin-password-input').focus();
  }
}

async function handleAdminLogin() {
  const pw  = document.getElementById('admin-password-input').value;
  const err = document.getElementById('admin-login-error');
  err.style.display = 'none';
  if (!pw) return;
  try {
    const snap = await getDocs(collection(STATE.db, 'users'));
    let adminDoc = null;
    snap.forEach(d => { if (d.data().isAdminAccount) adminDoc = { id: d.id, ...d.data() }; });
    if (!adminDoc) { err.textContent = 'No admin account found.'; err.style.display = 'block'; return; }
    if (await hashPin(pw) !== adminDoc.pinHash) { err.textContent = 'Wrong password.'; err.style.display = 'block'; return; }
    document.getElementById('admin-login-modal').style.display = 'none';
    document.getElementById('admin-password-input').value = '';
    saveSession(adminDoc.id, adminDoc.nickname, true);
    await initApp();
  } catch (e) { err.textContent = 'Error: ' + e.message; err.style.display = 'block'; }
}

const REGISTRATION_OPEN = false;

async function handleRegister() {
  if (!REGISTRATION_OPEN) {
    const errEl = document.getElementById('register-error');
    errEl.textContent = 'Registration is closed — all spots are filled! To request access, contact the admin on WhatsApp.';
    errEl.classList.add('show');
    return;
  }
  const raw      = document.getElementById('reg-nickname').value.trim();
  const pin      = document.getElementById('reg-pin').value.trim();
  const confirm  = document.getElementById('reg-pin-confirm').value.trim();
  const photoFile = document.getElementById('reg-photo-input').files[0];
  const errEl    = document.getElementById('register-error');
  const btn      = document.getElementById('register-btn');
  errEl.classList.remove('show');
  if (!raw) { errEl.textContent = 'Enter a nickname.'; errEl.classList.add('show'); return; }
  // Sentence case
  const nickname   = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  const normalised = nickname.toLowerCase().replace(/\s+/g, '');
  if (!/^\d{4}$/.test(pin)) { errEl.textContent = 'PIN must be exactly 4 digits.'; errEl.classList.add('show'); return; }
  if (pin !== confirm) { errEl.textContent = 'PINs do not match.'; errEl.classList.add('show'); return; }
  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    const existing = await getDocs(collection(STATE.db, 'users'));
    let duplicate = false;
    existing.forEach(d => {
      if ((d.data().nickname || '').toLowerCase().replace(/\s+/g, '') === normalised) duplicate = true;
    });
    if (duplicate) {
      errEl.textContent = `"${nickname}" is already taken — try another.`; errEl.classList.add('show');
      btn.disabled = false; btn.textContent = 'Join the Game 🏆'; return;
    }
    let photoURL = '';
    if (photoFile) {
      btn.textContent = 'Uploading photo…';
      photoURL = await resizeImageToBase64(photoFile, 80);
    }
    const ref = doc(collection(STATE.db, 'users'));
    await setDoc(ref, {
      nickname, pinHash: await hashPin(pin), mobile: '',
      isAdmin: false, totalPoints: 0, exactScores: 0, correctResults: 0,
      championPick: '', goldenBootPick: '', lastMinuteCount: 0,
      photoURL, createdAt: serverTimestamp()
    });
    saveSession(ref.id, nickname, false);
    showToast(`Welcome, ${nickname}! 🎉`, 'success');
    await initApp();
  } catch (e) {
    errEl.textContent = 'Error — try again.'; errEl.classList.add('show'); console.error('Register error:', e);
  }
  btn.disabled = false; btn.textContent = 'Join the Game 🏆';
}

// ═══════════════════════════════════════════════════════
// CHAMPION / GOLDEN BOOT PICKS
// ═══════════════════════════════════════════════════════
function populateTeamSelects() {
  const opts = ALL_TEAMS.map(t => `<option value="${t}">${t}</option>`).join('');
  const blank = '<option value="">— Pick a team —</option>';
  document.getElementById('champion-select').innerHTML    = blank + opts;
  document.getElementById('golden-boot-select').innerHTML = blank + opts;
}

async function openChampionModal(userData = null) {
  populateTeamSelects();
  if (userData?.championPick)   document.getElementById('champion-select').value    = userData.championPick;
  if (userData?.goldenBootPick) document.getElementById('golden-boot-select').value = userData.goldenBootPick;

  const hasPicks = userData?.championPick && userData?.goldenBootPick;
  document.getElementById('skip-champion-btn').textContent = hasPicks ? 'Close' : 'Skip for now';

  document.getElementById('champion-modal').style.display = 'flex';
}

async function saveChampionPick() {
  const champion   = document.getElementById('champion-select').value;
  const goldenBoot = document.getElementById('golden-boot-select').value;
  if (!champion || !goldenBoot) { showToast('Pick both a champion and a top-scorer team', 'error'); return; }
  if (!STATE.session?.userId) { showToast('Not logged in', 'error'); return; }
  const btn = document.getElementById('save-champion-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    await setDoc(doc(STATE.db, 'users', STATE.session.userId), { championPick: champion, goldenBootPick: goldenBoot }, { merge: true });
    showToast(`🏆 ${champion} to win · ⚽ ${goldenBoot} top scorer!`, 'success');
    document.getElementById('champion-modal').style.display = 'none';
  } catch (e) {
    const msg = e?.code || e?.message || String(e);
    showToast(`Save failed: ${msg}`, 'error');
    console.error('saveChampionPick error:', e);
  }
  btn.disabled = false; btn.textContent = 'Save My Picks';
}

// ═══════════════════════════════════════════════════════
// VIEW 2 — HOME / MATCH FEED
// ═══════════════════════════════════════════════════════
let activeDateKey = '';

// Knockout stage keys (used for pill data-date on knockout matches)
const KNOCKOUT_STAGES = ['Round of 32', 'Round of 16', 'Quarter-Final', 'Semi-Final', 'Third Place', 'Final'];
const KNOCKOUT_LABEL  = { 'Round of 32': 'Round of 32', 'Round of 16': 'Round of 16', 'Quarter-Final': 'Quarter Finals', 'Semi-Final': 'Semi Finals', 'Third Place': '3rd Place', 'Final': 'Final' };

// Get US Eastern calendar date string (YYYY-MM-DD) for a match
function getETDate(kickoffUTC) {
  return new Date(kickoffUTC).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

async function initHomeView() {
  await Promise.all([fetchMatches(), fetchMyPredictions()]);
  buildDateNav();
  startCountdownTimers();
}

function buildDateNav() {
  const nav = document.getElementById('date-nav');
  const now = Date.now();

  // All unique ET dates across all matches, sorted
  const allDates = [...new Set(MATCHES.map(m => getETDate(m.kickoffUTC)))].sort();

  // Pre-calculate group stage day number (only counting group stage dates)
  const groupDates = allDates.filter(d =>
    MATCHES.some(m => getETDate(m.kickoffUTC) === d && !KNOCKOUT_STAGES.includes(m.matchDay))
  );

  nav.innerHTML = allDates.map(date => {
    const dt = new Date(date + 'T12:00:00');
    const dateLabel = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    // Determine label: group stage or knockout
    const stagesOnDay = [...new Set(
      MATCHES.filter(m => getETDate(m.kickoffUTC) === date).map(m => m.matchDay)
    )];
    const isKnockout = stagesOnDay.every(s => KNOCKOUT_STAGES.includes(s));
    const mainLabel = isKnockout
      ? KNOCKOUT_LABEL[stagesOnDay[0]] || stagesOnDay[0]
      : `Match Day ${groupDates.indexOf(date) + 1}`;

    return `<button class="date-pill" data-date="${date}">
      <span class="pill-md">${mainLabel}</span>
      <span class="pill-sub">${dateLabel}</span>
    </button>`;
  }).join('');

  nav.querySelectorAll('.date-pill').forEach(btn =>
    btn.addEventListener('click', () => selectDate(btn.dataset.date))
  );

  // Auto-select: earliest upcoming match
  const upcoming = MATCHES
    .filter(m => new Date(m.kickoffUTC) > now)
    .sort((a, b) => new Date(a.kickoffUTC) - new Date(b.kickoffUTC));
  const target = upcoming.length
    ? getETDate(upcoming[0].kickoffUTC)
    : allDates[allDates.length - 1];
  selectDate(target);
}

function selectDate(dateKey) {
  activeDateKey = dateKey;
  document.querySelectorAll('.date-pill').forEach(b =>
    b.classList.toggle('active', b.dataset.date === dateKey));
  const active = document.querySelector(`.date-pill[data-date="${CSS.escape(dateKey)}"]`);
  active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

  const filtered = STATE.matches
    .filter(m => getETDate(m.kickoffUTC) === dateKey)
    .sort((a, b) => new Date(a.kickoffUTC) - new Date(b.kickoffUTC));

  const list = document.getElementById('match-list');
  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚽</div><div class="empty-state-text">No matches on this day</div></div>`;
    return;
  }
  list.innerHTML = filtered.map(renderMatchCard).join('');
  attachCardListeners();
  renderDeadlineBanner();
}

function isToday(iso) {
  const d = new Date(iso), t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

function renderMatchCard(m) {
  const pred      = STATE.predictions[m.matchId];
  const lockMs    = getLockMs(m);
  const locked    = lockMs <= Date.now() || m.status === 'locked' || m.status === 'completed';
  const countdown = timeUntil(lockMs);
  const lastMin   = !locked && isLastMinuteWindow(m);
  const completed = m.status === 'completed' && m.resultA !== null;
  const stageLabel = m.group ? `Group ${m.group}` : m.stage;
  const kickoffStr = new Date(m.kickoffUTC).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });

  // Center — score if done, time if upcoming
  const centerHTML = completed
    ? `<div class="fm-center">
        <div class="fm-score-line">
          <span class="fm-score">${m.resultA}</span>
          <span class="fm-dash">–</span>
          <span class="fm-score">${m.resultB}</span>
        </div>
        <div class="fm-status-label">FT</div>
      </div>`
    : `<div class="fm-center">
        <div class="fm-time">${new Date(m.kickoffUTC).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
        <div class="fm-status-label">${locked ? '🔒' : kickoffStr.split(',')[0]}</div>
      </div>`;

  // Prediction strip at bottom
  let pickStrip = '';
  if (completed) {
    const pts = pred?.pointsAwarded;
    const ptsBadge =
      pts === 13 ? `<span class="fm-pts exact">+13 pts ⚽</span>` :
      pts === 10 ? `<span class="fm-pts winner">+10 pts ✓</span>` :
      pts === 0  ? `<span class="fm-pts wrong">0 pts</span>`      :
      !pred      ? `<span class="fm-pts none">No pick</span>`     : '';
    pickStrip = `<div class="fm-pick-strip">
      ${pred ? `<span class="fm-pick-label">Your pick</span><span class="fm-pick-score">${pred.predictedA}–${pred.predictedB}</span>` : '<span class="fm-pick-label text-muted">No pick made</span>'}
      ${ptsBadge}
    </div>`;
  } else if (locked) {
    pickStrip = `<div class="fm-pick-strip locked">
      🔒 Locked
      ${pred ? `<span class="fm-pick-score">${pred.predictedA}–${pred.predictedB}</span><span style="color:var(--grass);font-size:0.8rem">✓</span>` : '<span style="color:var(--muted);font-size:0.8rem">No pick</span>'}
    </div>`;
  } else {
    const urgentClass = countdown && !countdown.includes('d') && !countdown.includes('h') ? 'urgent' : '';
    const countdownHTML = countdown ? `<span class="fm-countdown ${urgentClass}">${lastMin ? '🔥' : '⏳'} ${countdown}</span>` : '';
    pickStrip = pred
      ? `<div class="fm-pick-strip has-pick">
           <span class="fm-pick-label">Your pick</span>
           <span class="fm-pick-score">${pred.predictedA}–${pred.predictedB}</span>
           <button class="fm-btn-edit" data-match="${m.matchId}">Edit</button>
           ${countdownHTML}
         </div>`
      : `<div class="fm-pick-strip predict-cta">
           <button class="fm-btn-predict" data-match="${m.matchId}">+ Predict</button>
           ${countdownHTML}
         </div>`;
  }

  return `<div class="fm-card" data-stage="${m.stage}" data-match-id="${m.matchId}">
    <div class="fm-header">${stageLabel} · ${kickoffStr}</div>
    <div class="fm-body">
      <div class="fm-team">
        <span class="fm-flag">${getFlag(m.teamA, m.flagA)}</span>
        <span class="fm-name">${m.teamA}</span>
      </div>
      ${centerHTML}
      <div class="fm-team right">
        <span class="fm-flag">${getFlag(m.teamB, m.flagB)}</span>
        <span class="fm-name">${m.teamB}</span>
      </div>
    </div>
    ${pickStrip}
  </div>`;
}

function attachCardListeners() {
  document.querySelectorAll('.fm-btn-edit, .fm-btn-predict').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openPredictView(btn.dataset.match); });
  });
}

function startCountdownTimers() {
  STATE.countdownTimers.forEach(clearInterval);
  STATE.countdownTimers = [];
  STATE.countdownTimers.push(setInterval(() => {
    document.querySelectorAll('.fm-countdown').forEach(el => {
      const card = el.closest('.fm-card');
      if (!card) return;
      const m = STATE.matches.find(x => x.matchId === card.dataset.matchId);
      if (!m) return;
      const lockMs = getLockMs(m);
      const t = timeUntil(lockMs);
      if (!t) { fetchMatches().then(() => selectDate(activeDateKey)); return; }
      const urgent  = !t.includes('d') && !t.includes('h');
      const lastMin = isLastMinuteWindow(m);
      el.textContent = `${lastMin ? '🔥' : '⏳'} Locks in ${t}`;
      el.classList.toggle('urgent', urgent);
    });
    renderDeadlineBanner();
  }, 30000));
}

// ═══════════════════════════════════════════════════════
// VIEW 3 — PREDICT / EDIT
// ═══════════════════════════════════════════════════════
async function openPredictView(matchId) {
  const m = STATE.matches.find(x => x.matchId === matchId);
  if (!m) return;
  STATE.currentPredictMatch = m;
  const pred   = STATE.predictions[matchId];
  const locked = isLocked(m) || m.status === 'locked' || m.status === 'completed';

  document.getElementById('predict-meta').textContent    = matchMetaLabel(m);
  document.getElementById('predict-flag-a').textContent  = getFlag(m.teamA, m.flagA);
  document.getElementById('predict-flag-b').textContent  = getFlag(m.teamB, m.flagB);
  document.getElementById('predict-team-a').textContent  = m.teamA;
  document.getElementById('predict-team-b').textContent  = m.teamB;
  const _ko = new Date(m.kickoffUTC);
  const _koStr = _ko.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  document.getElementById('predict-kickoff').textContent = `${_koStr} · ${m.venue}`;
  document.getElementById('picker-flag-a').textContent   = getFlag(m.teamA, m.flagA);
  document.getElementById('picker-name-a').textContent   = m.teamA;
  document.getElementById('picker-flag-b').textContent   = getFlag(m.teamB, m.flagB);
  document.getElementById('picker-name-b').textContent   = m.teamB;

  const initA = pred?.predictedA ?? 0, initB = pred?.predictedB ?? 0;
  ['a','b'].forEach(t => {
    const el = document.getElementById(`score-${t}`);
    el.textContent = t === 'a' ? initA : initB;
    el.dataset.val = t === 'a' ? initA : initB;
  });

  const lockedMsg = document.getElementById('predict-locked-msg');
  const saveBtn   = document.getElementById('predict-save-btn');
  lockedMsg.style.display = locked ? 'block' : 'none';
  saveBtn.disabled = locked;
  document.querySelectorAll('.stepper-btn').forEach(b => b.disabled = locked);
  showView('view-predict');
}

// ── Steppers ───────────────────────────────────────────

function adjustScore(team, delta) {
  const el = document.getElementById(`score-${team}`);
  const next = Math.max(0, Math.min(20, parseInt(el.dataset.val, 10) + delta));
  el.dataset.val = next; el.textContent = next;
  el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
}

async function savePrediction() {
  const m = STATE.currentPredictMatch;
  if (!m || !STATE.session) return;
  if (isLocked(m)) { showToast('Predictions are closed for this match', 'lock'); return; }

  // Guard against double-submit (numpad done key + save button both firing)
  const btn = document.getElementById('predict-save-btn');
  if (btn.disabled) return;
  btn.disabled = true; btn.textContent = 'Saving…';

  const scoreA   = parseInt(document.getElementById('score-a').dataset.val, 10);
  const scoreB   = parseInt(document.getElementById('score-b').dataset.val, 10);
  const predId   = `${STATE.session.userId}_${m.matchId}`;
  const lastMin  = isLastMinuteWindow(m);
  const existing = STATE.predictions[m.matchId];

  let saved = false;
  try {
    const pred = {
      userId: STATE.session.userId, matchId: m.matchId,
      predictedA: scoreA, predictedB: scoreB,
      updatedAt: serverTimestamp(), lastMinute: lastMin,
    };
    if (!existing) pred.submittedAt = serverTimestamp();
    await setDoc(doc(STATE.db, 'predictions', predId), pred, { merge: true });
    saved = true; // ← primary write succeeded; never show error toast after this point

    // ── Audit trail: record previous score whenever a prediction is changed ──
    if (existing &&
        (existing.predictedA !== scoreA || existing.predictedB !== scoreB)) {
      const auditRef = doc(STATE.db, 'predictionAudit',
        `${predId}_${Date.now()}`);
      setDoc(auditRef, {
        userId:    STATE.session.userId,
        matchId:   m.matchId,
        prevA:     existing.predictedA,
        prevB:     existing.predictedB,
        newA:      scoreA,
        newB:      scoreB,
        changedAt: serverTimestamp(),
        lastMinute: lastMin,
      }).catch(e => console.warn('audit trail:', e)); // fire-and-forget
    }

    // Track last-minute count — fire-and-forget, never blocks UI
    if (lastMin && !existing?.lastMinute) {
      const uRef = doc(STATE.db, 'users', STATE.session.userId);
      getDoc(uRef).then(uSnap => {
        if (uSnap.exists()) updateDoc(uRef, { lastMinuteCount: (uSnap.data().lastMinuteCount || 0) + 1 })
          .catch(e => console.warn('lastMinuteCount:', e));
      }).catch(e => console.warn('lastMinuteCount read:', e));
    }

    STATE.predictions[m.matchId] = { ...pred, pointsAwarded: existing?.pointsAwarded ?? null };
    showToast(lastMin
      ? `🔥 Last-minute pick! ${m.teamA} ${scoreA}–${scoreB} ${m.teamB}`
      : `Saved: ${m.teamA} ${scoreA}–${scoreB} ${m.teamB}`, 'success');
    showView('view-home');
    selectDate(activeDateKey);
  } catch (e) { if (!saved) showToast('Error saving — try again', 'error'); console.error(e); }
  btn.disabled = false; btn.textContent = 'Save Prediction';
}

// ── Deadline banner (matches tab) ─────────────────────
function renderDeadlineBanner() {
  const banner = document.getElementById('deadline-banner');
  if (!banner) return;
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const now = Date.now();

  const soonMatch = STATE.matches
    .filter(m => {
      const lockMs = getLockMs(m);
      return !isLocked(m) && lockMs - now <= TWO_HOURS && lockMs > now && !STATE.predictions[m.matchId];
    })
    .sort((a, b) => getLockMs(a) - getLockMs(b))[0];

  if (!soonMatch) { banner.style.display = 'none'; return; }

  const t = timeUntil(getLockMs(soonMatch));
  banner.style.display = 'flex';
  banner.innerHTML = `⚠️ <span><strong>${soonMatch.teamA} vs ${soonMatch.teamB}</strong> locks in <strong>${t}</strong> — no pick yet</span>
    <button class="banner-predict-btn" id="banner-btn">Predict now →</button>`;
  document.getElementById('banner-btn').addEventListener('click', () => openPredictView(soonMatch.matchId));
}

// ═══════════════════════════════════════════════════════
// VIEW 4 — LEADERBOARD
// ═══════════════════════════════════════════════════════

async function computeUserAccuracy() {
  const snap = await getDocs(collection(STATE.db, 'predictions'));
  const allPreds = {}, finished = {}, scored = {}, exactMap = {}, winnerMap = {};
  snap.forEach(d => {
    const p = d.data();
    allPreds[p.userId] = (allPreds[p.userId] || 0) + 1;
    if (p.pointsAwarded != null) {
      finished[p.userId] = (finished[p.userId] || 0) + 1;
      if (p.pointsAwarded === 13) { exactMap[p.userId]  = (exactMap[p.userId]  || 0) + 1; scored[p.userId] = (scored[p.userId] || 0) + 1; }
      if (p.pointsAwarded === 10) { winnerMap[p.userId] = (winnerMap[p.userId] || 0) + 1; scored[p.userId] = (scored[p.userId] || 0) + 1; }
    }
  });
  STATE.users.forEach(u => {
    const total = finished[u.id] || 0;
    u.predictionsSubmitted = allPreds[u.id]   || 0;
    u.finishedPreds    = total;
    u.computedExact    = exactMap[u.id]  || 0;
    u.computedWinner   = winnerMap[u.id] || 0;
    u.exactAccuracy    = total >= 1 ? Math.round(((exactMap[u.id]  || 0) / total) * 100) : null;
    u.resultAccuracy   = total >= 1 ? Math.round(((winnerMap[u.id] || 0) / total) * 100) : null;
    u.accuracy         = total >= 1 ? Math.round(((scored[u.id]    || 0) / total) * 100) : null;
  });
}

function getCurrentMatchDay() {
  const now = Date.now();
  const upcoming = STATE.matches
    .filter(m => new Date(m.kickoffUTC) > now)
    .sort((a, b) => new Date(a.kickoffUTC) - new Date(b.kickoffUTC));
  if (upcoming.length) return upcoming[0].matchDay;
  return [...STATE.matches].sort((a, b) => new Date(b.kickoffUTC) - new Date(a.kickoffUTC))[0]?.matchDay || null;
}

async function openCompareModal(userId, nickname) {
  const modal = document.getElementById('compare-modal');
  const title = document.getElementById('compare-title');
  const body  = document.getElementById('compare-body');

  title.textContent = `You vs ${nickname}`;
  body.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
  modal.style.display = 'flex';

  const snap = await getDocs(query(
    collection(STATE.db, 'predictions'),
    where('userId', '==', userId)
  ));
  const theirPreds = {};
  snap.forEach(d => { const p = d.data(); theirPreds[p.matchId] = p; });

  const completed = STATE.matches
    .filter(m => m.status === 'completed' && m.resultA !== null)
    .sort((a, b) => new Date(b.kickoffUTC) - new Date(a.kickoffUTC));

  if (completed.length === 0) {
    body.innerHTML = '<p style="text-align:center;color:var(--muted);padding:1.5rem">No completed matches yet</p>';
    return;
  }

  const ptsCls   = p => p === 13 ? 'exact' : p === 10 ? 'winner' : p === 0 ? 'wrong' : 'none';
  const ptsLabel = p => p === 13 ? '+13 ⚽' : p === 10 ? '+10 ✓' : p === 0 ? '0 pts' : '–';

  body.innerHTML = completed.map(m => {
    const mine   = STATE.predictions[m.matchId];
    const theirs = theirPreds[m.matchId];
    const myPts  = mine?.pointsAwarded ?? null;
    const thPts  = theirs ? calculatePoints(theirs.predictedA, theirs.predictedB, m.resultA, m.resultB) : null;

    return `<div class="compare-row">
      <div class="compare-match-label">${getFlag(m.teamA, m.flagA)} ${m.teamA} <strong>${m.resultA}–${m.resultB}</strong> ${m.teamB} ${getFlag(m.teamB, m.flagB)}</div>
      <div class="compare-picks">
        <div class="compare-pick ${ptsCls(myPts)}">
          <span class="compare-who">You</span>
          <span class="compare-score">${mine ? `${mine.predictedA}–${mine.predictedB}` : '–'}</span>
          <span class="compare-pts">${ptsLabel(myPts)}</span>
        </div>
        <div class="compare-pick ${ptsCls(thPts)}">
          <span class="compare-who">${nickname}</span>
          <span class="compare-score">${theirs ? `${theirs.predictedA}–${theirs.predictedB}` : '–'}</span>
          <span class="compare-pts">${ptsLabel(thPts)}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function initLeaderboard() {
  document.getElementById('leaderboard-body').innerHTML =
    '<div class="loading-center"><div class="spinner"></div></div>';
  await fetchUsers();
  await computeUserAccuracy();
  renderLeaderboard('overall');
}

async function renderLeaderboard(filter) {
  if (filter === 'overall') {
    const totalCompleted = STATE.matches.filter(m => m.status === 'completed' && m.resultA != null).length;
    renderLeaderboardTable(STATE.users, null, totalCompleted); return;
  }

  // This Match Day filter
  if (filter === 'this-match-day') {
    const currentDay = getCurrentMatchDay();
    if (!currentDay) { renderLeaderboardTable(STATE.users, null); return; }
    const ids = new Set(STATE.matches.filter(m => m.matchDay === currentDay).map(m => m.matchId));
    await buildFilteredLeaderboard(ids, `📅 ${currentDay}`);
    return;
  }

  // Weekly filter: week-1 through week-6
  if (filter.startsWith('week-')) {
    const week = parseInt(filter.split('-')[1], 10);
    const start = new Date('2026-06-11T00:00:00Z');
    start.setDate(start.getDate() + (week - 1) * 7);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    const ids = new Set(STATE.matches
      .filter(m => { const t = new Date(m.kickoffUTC).getTime(); return t >= start && t < end; })
      .map(m => m.matchId));
    await buildFilteredLeaderboard(ids, filter); return;
  }

  // Match-day filter
  const ids = new Set(STATE.matches.filter(m => m.matchDay === filter).map(m => m.matchId));
  await buildFilteredLeaderboard(ids, filter);
}

async function buildFilteredLeaderboard(matchIds, filter) {
  const snap = await getDocs(collection(STATE.db, 'predictions'));
  const pts = {}, exact = {}, winner = {}, predCount = {};
  snap.forEach(d => {
    const p = d.data();
    if (!matchIds.has(p.matchId)) return;
    predCount[p.userId] = (predCount[p.userId] || 0) + 1;
    pts[p.userId]    = (pts[p.userId]    || 0) + (p.pointsAwarded || 0);
    if (p.pointsAwarded === 13) exact[p.userId]  = (exact[p.userId]  || 0) + 1;
    if (p.pointsAwarded === 10) winner[p.userId] = (winner[p.userId] || 0) + 1;
  });
  const totalCompleted = [...matchIds].filter(id => {
    const m = STATE.matches.find(x => x.matchId === id);
    return m?.status === 'completed' && m.resultA != null;
  }).length;
  const sorted = STATE.users.map(u => ({
    ...u, filteredPoints: pts[u.id] || 0,
    filteredExact: exact[u.id] || 0, filteredWinner: winner[u.id] || 0,
    filteredPredCount: predCount[u.id] || 0,
  })).sort((a, b) => b.filteredPoints - a.filteredPoints);
  renderLeaderboardTable(sorted, filter, totalCompleted);
}

function renderLeaderboardTable(users, filter, totalCompleted = 0) {
  const myId     = STATE.session.userId;
  const rankIcon = ['🥇','🥈','🥉'];
  const container = document.getElementById('leaderboard-body');
  const prevRanks = loadPrevRanks();

  if (users.length === 0) {
    container.innerHTML = '<div class="lb-empty">No data yet</div>';
    return;
  }

  const rows = users.map((u, i) => {
    const pts    = filter ? (u.filteredPoints    || 0) : (u.totalPoints    || 0);
    const exact  = filter ? (u.filteredExact     || 0) : (u.computedExact  || 0);
    const winner = filter ? (u.filteredWinner    || 0) : (u.computedWinner || 0);
    const played = filter ? (u.filteredPredCount || 0) : (u.predictionsSubmitted || 0);
    const isMe   = u.id === myId;
    const rankCls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    const rankNum = i < 3 ? rankIcon[i] : (i + 1);

    // Rank movement
    let moveHTML = '';
    if (prevRanks[u.id] != null) {
      const diff = prevRanks[u.id] - (i + 1);
      if (diff > 0)      moveHTML = `<div class="lb-rank-move up">↑${diff}</div>`;
      else if (diff < 0) moveHTML = `<div class="lb-rank-move down">↓${Math.abs(diff)}</div>`;
      else               moveHTML = `<div class="lb-rank-move same">–</div>`;
    }

    const champ = u.championPick  || '–';
    const boot  = u.goldenBootPick || '–';

    const mainRow = `<tr class="lb-tr ${isMe ? 'lb-me' : ''} ${rankCls}" data-uid="${u.id}" data-nickname="${u.nickname}">
      <td class="lb-td-rank"><div class="lb-rank-num">${rankNum}</div>${moveHTML}</td>
      <td class="lb-td-player">
        <div class="lb-player-wrap">
          ${getAvatarHTML(u, 32)}
          <span class="lb-name-text">${u.nickname}${isMe ? '<span class="me-tag">YOU</span>' : ''}</span>
        </div>
      </td>
      <td class="lb-td-compare">${!isMe ? `<button class="lb-inline-compare" data-uid="${u.id}" data-nickname="${u.nickname}">⇄</button>` : ''}</td>
      <td class="lb-td-num lb-td-total">${totalCompleted}</td>
      <td class="lb-td-num lb-td-played">${played}</td>
      <td class="lb-td-num lb-td-exact">${exact}</td>
      <td class="lb-td-num lb-td-result">${winner}</td>
      <td class="lb-td-pts"><span class="lb-pts">${pts}</span></td>
    </tr>`;

    // Expandable drawer — shows champion/golden boot picks
    const drawerRow = `<tr class="lb-tr-drawer" data-uid="${u.id}">
      <td colspan="8">
        <div class="lb-drawer">
          <div class="lb-drawer-picks">
            <span class="lb-drawer-pick"><span class="lb-drawer-lbl">🏆 Winner</span>${champ}</span>
            <span class="lb-drawer-pick"><span class="lb-drawer-lbl">⚽ Top Scorer</span>${boot}</span>
          </div>
        </div>
      </td>
    </tr>`;

    return mainRow + drawerRow;
  }).join('');

  container.innerHTML = `
    <table class="lb-table">
      <thead>
        <tr>
          <th class="lb-th-rank">#</th>
          <th class="lb-th-player">Player</th>
          <th class="lb-th-compare">⚡</th>
          <th class="lb-th-num">MF</th>
          <th class="lb-th-num">MP</th>
          <th class="lb-th-num">🎯</th>
          <th class="lb-th-num">✅</th>
          <th class="lb-th-pts">Pts</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="lb-legend">
      <span>MF = Matches Finished</span>
      <span>MP = Matches Played</span>
      <span>🎯 = Exact Score (13pts)</span>
      <span>✅ = Correct Result (10pts)</span>
    </div>`;

  document.getElementById('leaderboard-updated').textContent =
    `Updated ${new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}`;

  // Save rank snapshot for next visit (overall only)
  if (!filter) {
    const completedCount = STATE.matches.filter(m => m.resultA !== null).length;
    saveRankSnapshot(users, completedCount);
  }

  // Row tap → toggle expand drawer
  document.querySelectorAll('.lb-tr').forEach(row => {
    row.addEventListener('click', () => {
      const wasOpen = row.classList.contains('expanded');
      // Close all open drawers first
      document.querySelectorAll('.lb-tr.expanded').forEach(r => r.classList.remove('expanded'));
      document.querySelectorAll('.lb-tr-drawer.open').forEach(d => d.classList.remove('open'));
      // Open this one (unless it was already open → toggle off)
      if (!wasOpen) {
        row.classList.add('expanded');
        const drawer = row.nextElementSibling;
        if (drawer?.classList.contains('lb-tr-drawer')) drawer.classList.add('open');
      }
    });
  });

  // Compare buttons (drawer + inline)
  document.querySelectorAll('.lb-drawer-compare, .lb-inline-compare').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openCompareModal(btn.dataset.uid, btn.dataset.nickname);
    });
  });
}

function populateLeaderboardFilter() {
  const sel = document.getElementById('leaderboard-filter');
  const matchDays = [...new Set(STATE.matches.map(m => m.matchDay))];
  sel.innerHTML =
    '<option value="overall">🏅 Overall</option>' +
    '<option value="this-match-day">📅 This Match Day</option>' +
    '<optgroup label="By Week">' +
    ['Jun 11–17','Jun 18–24','Jun 25–Jul 1','Jul 2–8','Jul 9–15','Jul 16–19']
      .map((l, i) => `<option value="week-${i+1}">Week ${i+1} (${l})</option>`).join('') +
    '</optgroup>' +
    '<optgroup label="By Match Day">' +
    matchDays.map(d => `<option value="${d}">${d}</option>`).join('') +
    '</optgroup>';
}

// ═══════════════════════════════════════════════════════
// VIEW 5 — MY PREDICTIONS
// ═══════════════════════════════════════════════════════
async function initMyPredictions() {
  await Promise.all([fetchMatches(), fetchMyPredictions()]);
  renderMyPredictions();
}

let myPredTab = 'upcoming';

function renderMyPredictions(tab) {
  if (tab) myPredTab = tab;
  let totalPts = 0, exact = 0, winner = 0;

  STATE.matches.forEach(m => {
    const p = STATE.predictions[m.matchId];
    if (!p) return;
    if (p.pointsAwarded === 13) { totalPts += 13; exact++; }
    else if (p.pointsAwarded === 10) { totalPts += 10; winner++; }
  });

  const scored = Object.values(STATE.predictions).filter(p => p.pointsAwarded != null);
  const accuracy = scored.length > 0 ? Math.round(((exact + winner) / scored.length) * 100) : 0;

  document.getElementById('stat-pts').textContent    = totalPts;
  document.getElementById('stat-exact').textContent  = exact;
  document.getElementById('stat-winner').textContent = winner;
  document.getElementById('stat-acc').textContent    = accuracy + '%';

  // Split matches into upcoming (no result yet) and finished (result added by admin)
  const upcomingMatches  = STATE.matches.filter(m => m.resultA == null || m.resultB == null);
  const finishedMatches  = STATE.matches.filter(m => m.resultA != null && m.resultB != null);
  const activeList       = myPredTab === 'upcoming' ? upcomingMatches : finishedMatches;

  const groups = {};
  activeList.forEach(m => {
    const p = STATE.predictions[m.matchId];
    if (!p) return;
    if (!groups[m.matchDay]) groups[m.matchDay] = [];
    groups[m.matchDay].push({ m, p });
  });

  const upCount  = upcomingMatches.filter(m => STATE.predictions[m.matchId]).length;
  const finCount = finishedMatches.filter(m => STATE.predictions[m.matchId]).length;

  const tabBar = `
    <div style="display:flex;gap:0.5rem;margin-bottom:1rem">
      <button onclick="renderMyPredictions('upcoming')"
        style="flex:1;padding:.5rem;border-radius:8px;border:1px solid var(--border);cursor:pointer;font-size:0.85rem;font-weight:600;
               background:${myPredTab==='upcoming'?'var(--accent)':'rgba(255,255,255,0.05)'};
               color:${myPredTab==='upcoming'?'#000':'var(--muted)'}">
        ⏳ Upcoming (${upCount})
      </button>
      <button onclick="renderMyPredictions('finished')"
        style="flex:1;padding:.5rem;border-radius:8px;border:1px solid var(--border);cursor:pointer;font-size:0.85rem;font-weight:600;
               background:${myPredTab==='finished'?'var(--accent)':'rgba(255,255,255,0.05)'};
               color:${myPredTab==='finished'?'#000':'var(--muted)'}">
        ✅ Finished (${finCount})
      </button>
    </div>`;

  const container = document.getElementById('my-preds-list');
  if (Object.keys(groups).length === 0) {
    container.innerHTML = tabBar + `<div class="empty-state"><div class="empty-state-icon">${myPredTab==='upcoming'?'⏳':'✅'}</div><div class="empty-state-text">${myPredTab==='upcoming'?'No upcoming predictions yet — go make some!':'No finished matches yet'}</div></div>`;
    return;
  }
  container.innerHTML = tabBar + Object.entries(groups).map(([day, items]) => `
    <div class="matchday-group">
      <div class="matchday-label">${day}</div>
      ${items.map(({ m, p }) => {
        const pts = p.pointsAwarded;
        const ptsCls = pts === 13 ? 'exact' : pts === 10 ? 'winner' : pts === 0 ? 'wrong' : 'none';
        const ptsLabel = pts === 13 ? '+13' : pts === 10 ? '+10' : pts === 0 ? '0' : '–';
        const result = m.resultA != null ? `${m.resultA} – ${m.resultB}` : null;

        return `<div class="pred-fm-card">
          <div class="pred-fm-row">
            <div class="pred-fm-team">
              <span class="pred-fm-flag">${getFlag(m.teamA, m.flagA)}</span>
              <span class="pred-fm-name">${m.teamA}</span>
            </div>
            <div class="pred-fm-center">
              <div class="pred-fm-my-score">${p.predictedA} – ${p.predictedB}</div>
              <div class="pred-fm-score-label">MY PICK</div>
              ${result
                ? `<div class="pred-fm-result">${result}</div><div class="pred-fm-score-label">RESULT</div>`
                : `<div class="pred-fm-result pending">?–?</div><div class="pred-fm-score-label">PENDING</div>`}
            </div>
            <div class="pred-fm-team right">
              <span class="pred-fm-flag">${getFlag(m.teamB, m.flagB)}</span>
              <span class="pred-fm-name">${m.teamB}</span>
            </div>
          </div>
          <div class="pred-fm-pts ${ptsCls}">${ptsLabel} pts</div>
        </div>`;
      }).join('')}
    </div>`).join('');
}
// ═══════════════════════════════════════════════════════
// VIEW 6 — ADMIN PANEL
// ═══════════════════════════════════════════════════════
let adminTab = 'users';

async function initAdminPanel() {
  if (!STATE.session?.isAdmin) { showToast('Admin access only', 'error'); return; }
  setAdminTab('users');
}

function setAdminTab(tab) {
  adminTab = tab;
  document.querySelectorAll('#view-admin .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.admin-section').forEach(s => s.style.display = s.dataset.tab === tab ? 'block' : 'none');
  if (tab === 'users')    renderAdminUsers();
  if (tab === 'matches')  renderAdminMatches();
  if (tab === 'recalc')   renderRecalcSection();
  if (tab === 'backdate') renderBackdateSection();
}

async function renderAdminUsers() {
  await fetchUsers();
  const list = document.getElementById('admin-user-list');
  list.innerHTML = STATE.users.map(u => `
    <div class="user-row">
      <div class="user-info" style="display:flex;align-items:center;gap:.75rem">
        ${getAvatarHTML(u, 32)}
        <div>
          <div class="user-nickname">${u.nickname}</div>
          <div class="user-meta">${u.totalPoints || 0} pts${u.championPick ? ` · 🏆 ${u.championPick}` : ''}${!u.pinHash ? ' · ⚠️ No PIN set' : ''}</div>
        </div>
      </div>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn-sm btn-secondary" data-rename-user="${u.id}" data-nickname="${u.nickname}">✏️ Rename</button>
        <button class="btn-sm btn-secondary" data-resetpin-user="${u.id}" data-nickname="${u.nickname}">🔑 Reset PIN</button>
        <button class="btn-sm btn-danger"    data-delete-user="${u.id}">Delete</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('[data-rename-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid      = btn.dataset.renameUser;
      const current  = btn.dataset.nickname;
      const raw      = prompt(`Rename "${current}" to:`, current);
      if (!raw || raw.trim() === current) return;
      const nickname   = raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1).toLowerCase();
      const normalised = nickname.toLowerCase().replace(/\s+/g, '');
      // Duplicate check (skip disabled users)
      const existing = await getDocs(collection(STATE.db, 'users'));
      let duplicate = false;
      existing.forEach(d => {
        if (d.id !== uid && !d.data().disabled && (d.data().nickname || '').toLowerCase().replace(/\s+/g, '') === normalised) duplicate = true;
      });
      if (duplicate) { showToast(`"${nickname}" already exists`, 'error'); return; }
      await updateDoc(doc(STATE.db, 'users', uid), { nickname });
      showToast(`Renamed to "${nickname}"`, 'success');
      renderAdminUsers();
    });
  });

  list.querySelectorAll('[data-resetpin-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid      = btn.dataset.resetpinUser;
      const nickname = btn.dataset.nickname;
      if (!confirm(`Reset PIN for ${nickname}? They'll set a new one on next login.`)) return;
      await updateDoc(doc(STATE.db, 'users', uid), { pinHash: '' });
      showToast(`PIN reset for ${nickname}`, 'success');
      renderAdminUsers();
    });
  });

  list.querySelectorAll('[data-delete-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this user?')) return;
      await updateDoc(doc(STATE.db, 'users', btn.dataset.deleteUser), { disabled: true });
      showToast('User disabled', 'success'); renderAdminUsers();
    });
  });
}

async function addAdminUser() {
  const raw = document.getElementById('new-nickname').value.trim();
  if (!raw) { showToast('Nickname required', 'error'); return; }
  // Sentence case: capitalise first letter, lowercase the rest
  const nickname   = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  const normalised = nickname.toLowerCase().replace(/\s+/g, '');
  try {
    // Duplicate check — case-insensitive, ignores spaces, skips disabled
    const existing = await getDocs(collection(STATE.db, 'users'));
    let duplicate = false;
    existing.forEach(d => {
      if (!d.data().disabled && (d.data().nickname || '').toLowerCase().replace(/\s+/g, '') === normalised) duplicate = true;
    });
    if (duplicate) { showToast(`"${nickname}" already exists`, 'error'); return; }
    await setDoc(doc(collection(STATE.db, 'users')), {
      nickname, pinHash: '', mobile: '',
      isAdmin: false, totalPoints: 0, exactScores: 0, correctResults: 0,
      championPick: '', goldenBootPick: '', lastMinuteCount: 0,
      photoURL: '', createdAt: serverTimestamp()
    });
    showToast(`${nickname} added! They'll set their PIN on first login.`, 'success');
    document.getElementById('new-nickname').value = '';
    renderAdminUsers();
  } catch (e) { showToast('Error adding user', 'error'); console.error(e); }
}

let adminMatchTab = 'upcoming';

function renderAdminMatches(tab) {
  if (tab) adminMatchTab = tab;
  const container = document.getElementById('admin-match-list');

  const upcoming  = STATE.matches.filter(m => m.resultA == null || m.resultB == null);
  const completed = STATE.matches.filter(m => m.resultA != null && m.resultB != null);
  const list = adminMatchTab === 'upcoming' ? upcoming : completed;

  const byDay = {};
  list.forEach(m => { if (!byDay[m.matchDay]) byDay[m.matchDay] = []; byDay[m.matchDay].push(m); });

  const fetchBtn = `
    <div style="margin-bottom:1rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
      <a href="https://github.com/kpimdad/Kootharas-WC/actions/workflows/fetch-results.yml"
         target="_blank" class="btn btn-primary" style="text-decoration:none;display:inline-flex;align-items:center;gap:.4rem">
        🔄 Run Fetch Now
      </a>
      <span style="font-size:0.78rem;color:var(--muted)">Auto-runs every hour via GitHub Actions · click to trigger manually</span>
    </div>`;

  const tabs = `
    <div style="display:flex;gap:0.5rem;margin-bottom:1rem">
      <button onclick="renderAdminMatches('upcoming')"
        style="flex:1;padding:.5rem;border-radius:8px;border:1px solid var(--border);cursor:pointer;font-size:0.85rem;font-weight:600;
               background:${adminMatchTab==='upcoming'?'var(--accent)':'rgba(255,255,255,0.05)'};
               color:${adminMatchTab==='upcoming'?'#000':'var(--muted)'}">
        ⏳ Upcoming (${upcoming.length})
      </button>
      <button onclick="renderAdminMatches('completed')"
        style="flex:1;padding:.5rem;border-radius:8px;border:1px solid var(--border);cursor:pointer;font-size:0.85rem;font-weight:600;
               background:${adminMatchTab==='completed'?'var(--accent)':'rgba(255,255,255,0.05)'};
               color:${adminMatchTab==='completed'?'#000':'var(--muted)'}">
        ✅ Completed (${completed.length})
      </button>
    </div>`;

  container.innerHTML = fetchBtn + tabs + (Object.keys(byDay).length === 0
    ? `<div class="empty-state"><div class="empty-state-icon">${adminMatchTab==='upcoming'?'⏳':'✅'}</div><div class="empty-state-text">No ${adminMatchTab} matches</div></div>`
    : Object.entries(byDay).map(([day, matches]) => `
    <div class="admin-card" style="margin-bottom:1rem">
      <div class="admin-card-head">${day}</div>
      <div class="admin-card-body" style="padding:0">
        ${matches.map(m => {
          const hasResult = m.resultA != null && m.resultB != null;
          return `
          <div class="match-admin-row" style="padding:.875rem 1rem">
            <div class="match-admin-teams">
              <span>${getFlag(m.teamA, m.flagA)} ${m.teamA} vs ${m.teamB} ${getFlag(m.teamB, m.flagB)}</span>
              <span class="status-badge ${m.status}">${m.status}${hasResult ? ` · ${m.resultA}–${m.resultB}` : ''}</span>
            </div>
            <div class="match-admin-meta">${formatKickoff(m.kickoffUTC)} · ${m.venue}</div>
            <div class="result-entry">
              <input class="result-input" id="res-a-${m.matchId}" type="number" min="0" max="20" placeholder="–" value="${m.resultA ?? ''}">
              <span class="result-dash">–</span>
              <input class="result-input" id="res-b-${m.matchId}" type="number" min="0" max="20" placeholder="–" value="${m.resultB ?? ''}">
              <button class="btn btn-secondary btn-sm" style="width:auto;font-size:0.72rem" onclick="saveMatchResult('${m.matchId}')">
                ${hasResult ? '✏️ Override' : 'Save'}
              </button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`).join(''));
}

// ── Save a single match result (manual or auto) ────────
// Pass rA/rB directly for auto-save; omit to read from DOM inputs
async function saveMatchResult(matchId, autoRA, autoRB) {
  const rA = autoRA !== undefined ? autoRA : parseInt(document.getElementById(`res-a-${matchId}`)?.value, 10);
  const rB = autoRB !== undefined ? autoRB : parseInt(document.getElementById(`res-b-${matchId}`)?.value, 10);
  if (isNaN(rA) || isNaN(rB)) { showToast('Enter valid scores', 'error'); return; }
  try {
    await setDoc(doc(STATE.db, 'matches', matchId), { resultA: rA, resultB: rB, status: 'completed' }, { merge: true });
    const pSnap = await getDocs(query(collection(STATE.db, 'predictions'), where('matchId', '==', matchId)));
    const batch = writeBatch(STATE.db);
    let total = 0, exact = 0, correct = 0;
    const deltas = {};
    pSnap.forEach(d => {
      const p = d.data();
      const pts = calculatePoints(p.predictedA, p.predictedB, rA, rB);
      batch.update(d.ref, { pointsAwarded: pts });
      total++; if (pts === 13) exact++; if (pts === 10) correct++;
      deltas[p.userId] = (deltas[p.userId] || 0) + (pts - (p.pointsAwarded ?? 0));
    });
    await batch.commit();
    const uBatch = writeBatch(STATE.db);
    for (const [uid, delta] of Object.entries(deltas)) {
      if (delta === 0) continue;
      const s = await getDoc(doc(STATE.db, 'users', uid));
      if (s.exists()) uBatch.update(doc(STATE.db, 'users', uid), { totalPoints: (s.data().totalPoints || 0) + delta });
    }
    await uBatch.commit();
    // Only show toast for manual saves (auto-fetch batches its own toast)
    if (autoRA === undefined) showToast(`✅ ${total} predictions scored: ${exact} exact, ${correct} correct`, 'success');
    const m = STATE.matches.find(x => x.matchId === matchId);
    if (m) { m.resultA = rA; m.resultB = rB; m.status = 'completed'; }
  } catch (e) { showToast('Error saving result', 'error'); console.error(e); }
}

function renderRecalcSection() {
  const sel = document.getElementById('recalc-match-select');
  sel.innerHTML = '<option value="">— Select a completed match —</option>' +
    STATE.matches.filter(m => m.status === 'completed')
      .map(m => `<option value="${m.matchId}">${m.teamA} vs ${m.teamB} (${m.matchDay})</option>`).join('');
}

async function recalcMatch() {
  const id = document.getElementById('recalc-match-select').value;
  if (!id) { showToast('Select a match first', 'error'); return; }
  const m = STATE.matches.find(x => x.matchId === id);
  if (!m || m.resultA == null) { showToast('No result for this match', 'error'); return; }
  await saveMatchResult(id);
}

// ── Backdate: Player Prediction Sheet ──────────────────
function renderBackdateSection() {
  const userSel = document.getElementById('backdate-user-select');
  if (!userSel) return;

  userSel.innerHTML = '<option value="">— Select player —</option>' +
    STATE.users.map(u => `<option value="${u.id}">${u.nickname}</option>`).join('');

  userSel.onchange = () => {
    if (userSel.value) loadBackdateSheet(userSel.value);
    else document.getElementById('backdate-sheet').style.display = 'none';
  };
}

async function loadBackdateSheet(userId) {
  const sheet     = document.getElementById('backdate-sheet');
  const container = document.getElementById('backdate-table-container');
  const title     = document.getElementById('backdate-sheet-title');

  const user = STATE.users.find(u => u.id === userId);
  title.textContent = `${user?.nickname || 'Player'}'s Predictions`;
  container.innerHTML = '<p style="padding:1.25rem;color:var(--muted)">Loading…</p>';
  sheet.style.display = 'block';

  // Only matches with kickoff in the past, sorted by date
  const now = new Date();
  const pastMatches = STATE.matches
    .filter(m => new Date(m.kickoffUTC) < now)
    .sort((a, b) => new Date(a.kickoffUTC) - new Date(b.kickoffUTC));

  // Load this user's predictions
  const predsSnap = await getDocs(
    query(collection(STATE.db, 'predictions'), where('userId', '==', userId))
  );
  const predsMap = {};
  predsSnap.forEach(d => { predsMap[d.data().matchId] = d.data(); });

  container.innerHTML = renderBackdateTable(pastMatches, predsMap);
}

function renderBackdateTable(matches, predsMap) {
  if (!matches.length) {
    return '<p style="padding:1.25rem;color:var(--muted)">No completed matches yet.</p>';
  }

  const rows = matches.map(m => {
    const pred      = predsMap[m.matchId];
    const hasPred   = pred != null;
    const pA        = hasPred ? pred.predictedA : '';
    const pB        = hasPred ? pred.predictedB : '';
    const hasResult = m.resultA != null;
    const date      = new Date(m.kickoffUTC).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const resultStr = hasResult ? `${m.resultA}–${m.resultB}` : '–';
    const rowCls    = hasPred ? '' : ' bd-row-missing';
    const stCls     = hasPred ? 'bd-status-saved' : 'bd-status-missing';
    const stLabel   = hasPred ? '✓' : '!';

    return `<div class="bd-row${rowCls}" data-match-id="${m.matchId}">
      <div class="bd-date">${date}</div>
      <div class="bd-match">${getFlag(m.teamA, m.flagA)} ${m.teamA} <span class="bd-vs">vs</span> ${m.teamB} ${getFlag(m.teamB, m.flagB)}</div>
      <div class="bd-inputs">
        <input class="bd-score-input" type="number" min="0" max="20" value="${pA}" data-match-id="${m.matchId}" data-field="a" placeholder="–">
        <span class="bd-dash">–</span>
        <input class="bd-score-input" type="number" min="0" max="20" value="${pB}" data-match-id="${m.matchId}" data-field="b" placeholder="–">
      </div>
      <div class="bd-result">${resultStr}</div>
      <div class="bd-status ${stCls}" id="bd-status-${m.matchId}">${stLabel}</div>
    </div>`;
  }).join('');

  return `<div class="bd-header">
      <div class="bd-date">Date</div>
      <div class="bd-match">Match</div>
      <div class="bd-inputs">Prediction</div>
      <div class="bd-result">Result</div>
      <div class="bd-status"></div>
    </div>${rows}`;
}

async function saveAllBackdatePredictions() {
  const userId = document.getElementById('backdate-user-select').value;
  if (!userId) return;

  // Collect only rows the user has edited (dirty)
  const rowData = {};
  document.querySelectorAll('.bd-row.bd-row-dirty .bd-score-input').forEach(inp => {
    const matchId = inp.dataset.matchId;
    const field   = inp.dataset.field;
    const val     = inp.value.trim();
    if (!rowData[matchId]) rowData[matchId] = {};
    if (val !== '') rowData[matchId][field] = parseInt(val, 10);
  });

  const toSave = Object.entries(rowData).filter(([, v]) => v.a !== undefined && v.b !== undefined);
  if (!toSave.length) { showToast('No predictions to save', 'info'); return; }

  const btn = document.getElementById('backdate-save-all-btn');
  btn.disabled = true;
  btn.textContent = `Saving ${toSave.length}…`;

  let saved = 0, errors = 0;

  for (const [matchId, scores] of toSave) {
    try {
      const m   = STATE.matches.find(x => x.matchId === matchId);
      if (!m) continue;
      const predId = `${userId}_${matchId}`;
      const pA = scores.a, pB = scores.b;
      const pts = m.resultA != null ? calculatePoints(pA, pB, m.resultA, m.resultB) : null;

      const existingSnap = await getDoc(doc(STATE.db, 'predictions', predId));
      const oldPts = existingSnap.exists() ? (existingSnap.data().pointsAwarded ?? 0) : 0;

      await setDoc(doc(STATE.db, 'predictions', predId), {
        userId, matchId, predictedA: pA, predictedB: pB,
        updatedAt: serverTimestamp(),
        ...(existingSnap.exists() ? {} : { submittedAt: serverTimestamp() }),
        lastMinute: false, backdated: true,
        ...(pts !== null ? { pointsAwarded: pts } : {}),
      }, { merge: true });

      if (pts !== null) {
        const delta = pts - oldPts;
        if (delta !== 0) {
          const uSnap = await getDoc(doc(STATE.db, 'users', userId));
          if (uSnap.exists()) {
            await updateDoc(doc(STATE.db, 'users', userId), {
              totalPoints: (uSnap.data().totalPoints || 0) + delta,
            });
          }
        }
      }

      // Update row status to saved
      const statusEl = document.getElementById(`bd-status-${matchId}`);
      if (statusEl) {
        statusEl.textContent = '✓';
        statusEl.className   = 'bd-status bd-status-saved';
        const row = statusEl.closest('.bd-row');
        row?.classList.remove('bd-row-missing', 'bd-row-dirty');
      }
      saved++;
    } catch (e) {
      console.error('Error saving', matchId, e);
      errors++;
    }
  }

  btn.disabled    = false;
  btn.textContent = 'Save All Changes';
  showToast(`✅ Saved ${saved} prediction${saved !== 1 ? 's' : ''}${errors ? ` · ${errors} error(s)` : ''}`, 'success');
}

async function recalcAll() {
  if (!confirm('Rebuild ALL user point totals from scratch?')) return;
  showToast('Rebuilding…', 'info');
  try {
    const uSnap = await getDocs(collection(STATE.db, 'users'));
    const validUids = new Set();
    const totals = {};
    uSnap.forEach(d => { validUids.add(d.id); totals[d.id] = 0; });
    const pSnap = await getDocs(collection(STATE.db, 'predictions'));
    pSnap.forEach(d => {
      const p = d.data();
      if (p.pointsAwarded != null && validUids.has(p.userId))
        totals[p.userId] = (totals[p.userId] || 0) + p.pointsAwarded;
    });
    const batch = writeBatch(STATE.db);
    Object.entries(totals).forEach(([uid, pts]) => batch.update(doc(STATE.db, 'users', uid), { totalPoints: pts }));
    await batch.commit();
    showToast('All totals rebuilt!', 'success');
  } catch (e) { showToast('Error: ' + e.message, 'error'); console.error(e); }
}

// Re-score every prediction for every completed match, then rebuild totals.
// Use this when the scoring formula has changed (e.g. switching to 3/10/0).
async function rescoreAllMatches() {
  if (!confirm('Re-score ALL predictions for ALL completed matches with current scoring (3 / 10 / 0)? This overwrites stored points.')) return;
  showToast('Re-scoring all matches…', 'info');
  try {
    const completedMatches = STATE.matches.filter(m => m.status === 'completed' && m.resultA != null);
    let predCount = 0;

    for (const m of completedMatches) {
      const pSnap = await getDocs(query(collection(STATE.db, 'predictions'), where('matchId', '==', m.matchId)));
      if (pSnap.empty) continue;
      const batch = writeBatch(STATE.db);
      pSnap.forEach(d => {
        const p = d.data();
        const pts = calculatePoints(p.predictedA, p.predictedB, m.resultA, m.resultB);
        batch.update(d.ref, { pointsAwarded: pts });
        predCount++;
      });
      await batch.commit();
    }

    // Now rebuild all user totals from the freshly-scored pointsAwarded values
    const uSnap = await getDocs(collection(STATE.db, 'users'));
    const validUids = new Set();
    const totals = {};
    uSnap.forEach(d => { validUids.add(d.id); totals[d.id] = 0; });
    const allPreds = await getDocs(collection(STATE.db, 'predictions'));
    allPreds.forEach(d => {
      const p = d.data();
      if (p.pointsAwarded != null && validUids.has(p.userId))
        totals[p.userId] = (totals[p.userId] || 0) + p.pointsAwarded;
    });
    const uBatch = writeBatch(STATE.db);
    Object.entries(totals).forEach(([uid, pts]) => uBatch.update(doc(STATE.db, 'users', uid), { totalPoints: pts }));
    await uBatch.commit();

    showToast(`✅ Re-scored ${predCount} predictions across ${completedMatches.length} matches`, 'success');
  } catch (e) { showToast('Error: ' + e.message, 'error'); console.error(e); }
}

// ── Share Standings Card (pure Canvas 2D, 2× HD) ───────
async function shareStandings() {
  const btn = document.getElementById('share-standings-btn');
  btn.textContent = '⏳';
  btn.disabled = true;

  try {
    const rankedUsers = [...STATE.users]
      .filter(u => !u.isAdminAccount)
      .sort((a, b) => {
        if ((b.totalPoints     || 0) !== (a.totalPoints     || 0)) return (b.totalPoints     || 0) - (a.totalPoints     || 0);
        if ((b.computedExact   || 0) !== (a.computedExact   || 0)) return (b.computedExact   || 0) - (a.computedExact   || 0);
        if ((b.computedWinner  || 0) !== (a.computedWinner  || 0)) return (b.computedWinner  || 0) - (a.computedWinner  || 0);
        return (a.predictionsSubmitted || 0) - (b.predictionsSubmitted || 0);
      });

    // ── Layout (logical pixels — canvas is 2× for HD) ──
    const DPR    = 2;
    const W      = 800;
    const PAD    = 36;
    const ROW_H  = 56;
    const HDR_H  = 210;       // taller header to give breathing room above rows
    const FOOT_H = 52;
    const H      = HDR_H + rankedUsers.length * ROW_H + FOOT_H;

    // Column X — spread wide so headers don't crowd each other
    const xRank  = PAD + 20;
    const xName  = PAD + 56;
    const xExact = W - 270;   // 🎯 center
    const xRes   = W - 170;   // ✅ center  (100px gap from exact)
    const xPts   = W - PAD;   // Points right-edge (134px gap from result)

    const canvas  = document.createElement('canvas');
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    const ctx     = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    // ── 1. Background image (26.jpg) full-cover + dark gradient overlay ──
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = '26.jpg';
    });
    const sc = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    ctx.drawImage(img,
      (W - img.naturalWidth  * sc) / 2,
      (H - img.naturalHeight * sc) / 2,
      img.naturalWidth  * sc,
      img.naturalHeight * sc
    );

    // Gradient overlay: stronger at top/bottom, slightly lighter in middle so trophy shows
    const overlay = ctx.createLinearGradient(0, 0, 0, H);
    overlay.addColorStop(0,    'rgba(8,12,20,0.88)');
    overlay.addColorStop(0.35, 'rgba(8,12,20,0.70)');
    overlay.addColorStop(0.65, 'rgba(8,12,20,0.70)');
    overlay.addColorStop(1,    'rgba(8,12,20,0.92)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H);

    // ── 2. Gold accent bars top + bottom ──
    const goldBar = ctx.createLinearGradient(0, 0, W, 0);
    goldBar.addColorStop(0,   'rgba(240,180,41,0)');
    goldBar.addColorStop(0.25,'rgba(240,180,41,0.75)');
    goldBar.addColorStop(0.75,'rgba(240,180,41,0.75)');
    goldBar.addColorStop(1,   'rgba(240,180,41,0)');
    ctx.fillStyle = goldBar;
    ctx.fillRect(0, 0, W, 3);
    ctx.fillRect(0, H - 3, W, 3);

    // ── 3. Header ──
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    ctx.font      = '44px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🏆', W / 2, 50);

    ctx.font         = 'bold 60px "Bebas Neue", Arial Narrow, sans-serif';
    ctx.fillStyle    = '#F0B429';
    ctx.shadowColor  = 'rgba(240,180,41,0.45)';
    ctx.shadowBlur   = 20;
    ctx.fillText('KOOTHARAS WC 2026', W / 2, 112);
    ctx.shadowBlur   = 0;
    ctx.shadowColor  = 'transparent';

    ctx.font      = '22px sans-serif';
    ctx.fillStyle = '#7a8fa8';
    ctx.fillText(new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }), W / 2, 154);

    // Divider
    const divGrad = ctx.createLinearGradient(0, 0, W, 0);
    divGrad.addColorStop(0,   'rgba(240,180,41,0)');
    divGrad.addColorStop(0.2, 'rgba(240,180,41,0.5)');
    divGrad.addColorStop(0.8, 'rgba(240,180,41,0.5)');
    divGrad.addColorStop(1,   'rgba(240,180,41,0)');
    ctx.strokeStyle = divGrad;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, 178); ctx.lineTo(W - PAD, 178);
    ctx.stroke();

    // ── 4. Column headers (on their own band, well above rows) ──
    const colHdrY = 196;       // sits between divider (178) and first row (210)
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = '20px sans-serif';
    ctx.fillStyle    = '#5a7080';
    ctx.fillText('🎯', xExact, colHdrY);
    ctx.fillText('✅', xRes,   colHdrY);
    ctx.textAlign = 'right';
    ctx.font      = 'bold 17px sans-serif';
    ctx.fillText('POINTS', xPts, colHdrY);

    // ── 5. Player rows ──
    rankedUsers.forEach((u, i) => {
      const rowY = HDR_H + i * ROW_H;
      const midY = rowY + ROW_H / 2;

      // Alternating row bg — no isMe highlight (card is shared publicly)
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.roundRect(PAD - 12, rowY + 3, W - (PAD - 12) * 2, ROW_H - 5, 8);
        ctx.fill();
      }

      // Rank
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.font         = 'bold 24px "Bebas Neue", sans-serif';
      ctx.fillStyle    = i < 3 ? ['#FFD700','#C0C0C0','#CD7F32'][i] : '#3a5060';
      ctx.fillText(`${i + 1}`, xRank, midY);

      // Name — same colour for everyone
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.font         = 'bold 32px "Bebas Neue", Arial Narrow, sans-serif';
      ctx.fillStyle    = '#d8e8f5';
      const maxLen     = 13;
      const name       = u.nickname.length > maxLen ? u.nickname.slice(0, maxLen) + '…' : u.nickname;
      ctx.fillText(name, xName, midY);

      // Exact score 🎯
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.font         = 'bold 30px "Bebas Neue", sans-serif';
      ctx.fillStyle    = '#E8B800';
      ctx.fillText(u.computedExact  || 0, xExact, midY);

      // Correct result ✅
      ctx.fillStyle = '#27ae60';
      ctx.fillText(u.computedWinner || 0, xRes, midY);

      // Points
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f0f4f8';
      ctx.font      = 'bold 34px "Bebas Neue", sans-serif';
      ctx.fillText(u.totalPoints || 0, xPts, midY);
    });

    // ── 7. Footer ──
    const footY = H - FOOT_H / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, footY - 16); ctx.lineTo(W - PAD, footY - 16);
    ctx.stroke();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = '19px sans-serif';
    ctx.fillStyle    = '#2a3a4a';
    ctx.fillText('kpimdad.github.io/Kootharas-WC', W / 2, footY + 4);

    // ── 9. Share / download ──
    canvas.toBlob(async blob => {
      const file = new File([blob], 'kootharas-standings.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Kootharas WC 2026 Standings' });
      } else {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href = url; a.download = 'kootharas-standings.png'; a.click();
        URL.revokeObjectURL(url);
      }
    }, 'image/png');

  } catch (e) {
    console.error('Share failed:', e);
    showToast('Could not generate share image', 'error');
  } finally {
    btn.textContent = '📸';
    btn.disabled    = false;
  }
}

// ── Prediction Integrity Audit ─────────────────────────
// Checks for predictions where updatedAt > lock time (kickoff − 5 min)
// and backdated !== true. These were not saved through the admin tool.
async function runIntegrityAudit() {
  const resultsEl = document.getElementById('audit-results');
  resultsEl.innerHTML = '<p style="color:var(--silver);font-size:0.875rem">Running audit…</p>';

  try {
    const [uSnap, pSnap] = await Promise.all([
      getDocs(collection(STATE.db, 'users')),
      getDocs(collection(STATE.db, 'predictions')),
    ]);

    // Build userId → nickname map
    const nickMap = {};
    uSnap.forEach(d => { nickMap[d.id] = d.data().nickname || d.id; });

    // Build matchId → lockMs map
    const lockMap = {};
    STATE.matches.forEach(m => { lockMap[m.matchId] = new Date(m.kickoffUTC).getTime() - 5 * 60 * 1000; });

    const suspicious = [];
    pSnap.forEach(d => {
      const p = d.data();
      if (p.backdated === true) return;                          // admin backdate tool — legit
      if (!p.updatedAt) return;                                  // no timestamp to check
      const lockMs = lockMap[p.matchId];
      if (!lockMs) return;                                       // unknown match
      const updMs = p.updatedAt.toMillis ? p.updatedAt.toMillis() : p.updatedAt.seconds * 1000;
      if (updMs > lockMs) {
        suspicious.push({
          docId: d.id,
          user: nickMap[p.userId] || p.userId,
          matchId: p.matchId,
          score: `${p.predictedA}–${p.predictedB}`,
          pts: p.pointsAwarded ?? '?',
          updatedAt: new Date(updMs).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
          lockTime: new Date(lockMs).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
          minsAfterLock: Math.round((updMs - lockMs) / 60000),
        });
      }
    });

    if (suspicious.length === 0) {
      resultsEl.innerHTML = '<p style="color:#2ecc71;font-size:0.9rem">✅ No suspicious predictions found. All clear.</p>';
      return;
    }

    // Group by user
    const byUser = {};
    suspicious.forEach(s => {
      if (!byUser[s.user]) byUser[s.user] = [];
      byUser[s.user].push(s);
    });

    let html = `<p style="color:#e67e22;font-size:0.875rem;margin-bottom:1rem">⚠️ Found <strong>${suspicious.length}</strong> suspicious prediction(s) across <strong>${Object.keys(byUser).length}</strong> user(s).</p>`;

    Object.entries(byUser).sort((a, b) => b[1].length - a[1].length).forEach(([user, rows]) => {
      const totalSuspectPts = rows.reduce((sum, r) => sum + (typeof r.pts === 'number' ? r.pts : 0), 0);
      html += `<div style="margin-bottom:1.25rem">
        <div style="font-weight:700;color:var(--gold);font-size:0.9rem;margin-bottom:0.5rem">
          ${user} — ${rows.length} suspicious (${totalSuspectPts} pts)
        </div>
        <table style="width:100%;font-size:0.78rem;border-collapse:collapse">
          <thead><tr style="color:var(--muted);text-align:left">
            <th style="padding:0.3rem 0.5rem">Match</th>
            <th style="padding:0.3rem 0.5rem">Score</th>
            <th style="padding:0.3rem 0.5rem">Pts</th>
            <th style="padding:0.3rem 0.5rem">Updated At</th>
            <th style="padding:0.3rem 0.5rem">+min after lock</th>
          </tr></thead>
          <tbody>`;
      rows.forEach(r => {
        html += `<tr style="border-top:1px solid var(--border)">
          <td style="padding:0.3rem 0.5rem;color:var(--silver)">${r.matchId}</td>
          <td style="padding:0.3rem 0.5rem;color:var(--silver)">${r.score}</td>
          <td style="padding:0.3rem 0.5rem;color:${r.pts > 0 ? '#2ecc71' : 'var(--muted)'}">${r.pts}</td>
          <td style="padding:0.3rem 0.5rem;color:var(--silver)">${r.updatedAt}</td>
          <td style="padding:0.3rem 0.5rem;color:#e74c3c">+${r.minsAfterLock}m</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    });

    resultsEl.innerHTML = html;
  } catch (e) {
    resultsEl.innerHTML = `<p style="color:#e74c3c;font-size:0.875rem">Error: ${e.message}</p>`;
    console.error(e);
  }

  // ── Edit History (predictionAudit collection) ──────────
  try {
    const auditSnap = await getDocs(collection(STATE.db, 'predictionAudit'));
    if (auditSnap.empty) {
      resultsEl.innerHTML += `<p style="color:var(--muted);font-size:0.85rem;margin-top:1.5rem">📋 Edit history: none yet — changes from now on will appear here.</p>`;
      return;
    }

    const nickMap2 = {};
    const uSnap2 = await getDocs(collection(STATE.db, 'users'));
    uSnap2.forEach(d => { nickMap2[d.id] = d.data().nickname || d.id; });

    const edits = [];
    auditSnap.forEach(d => {
      const a = d.data();
      const m = STATE.matches.find(x => x.matchId === a.matchId);
      const changedMs = a.changedAt?.toMillis ? a.changedAt.toMillis() : (a.changedAt?.seconds || 0) * 1000;
      const lockMs    = m ? new Date(m.kickoffUTC).getTime() - 5 * 60 * 1000 : null;
      edits.push({
        user:        nickMap2[a.userId] || a.userId,
        match:       m ? `${m.teamA} vs ${m.teamB}` : a.matchId,
        from:        `${a.prevA}–${a.prevB}`,
        to:          `${a.newA}–${a.newB}`,
        changedAt:   new Date(changedMs).toISOString().replace('T',' ').slice(0,19) + ' UTC',
        afterLock:   lockMs ? changedMs > lockMs : false,
        minsAfterLock: lockMs ? Math.round((changedMs - lockMs) / 60000) : null,
        lastMinute:  a.lastMinute,
      });
    });
    edits.sort((a, b) => b.changedAt.localeCompare(a.changedAt));

    let h = `<div style="margin-top:1.5rem">
      <div style="font-weight:700;color:var(--silver);font-size:0.9rem;margin-bottom:0.75rem">📋 Edit History (${edits.length} change${edits.length !== 1 ? 's' : ''})</div>
      <table style="width:100%;font-size:0.78rem;border-collapse:collapse">
        <thead><tr style="color:var(--muted);text-align:left">
          <th style="padding:0.3rem 0.5rem">User</th>
          <th style="padding:0.3rem 0.5rem">Match</th>
          <th style="padding:0.3rem 0.5rem">From</th>
          <th style="padding:0.3rem 0.5rem">To</th>
          <th style="padding:0.3rem 0.5rem">Changed At</th>
          <th style="padding:0.3rem 0.5rem">Status</th>
        </tr></thead><tbody>`;
    edits.forEach(e => {
      const status = e.afterLock
        ? `<span style="color:#e74c3c">⚠️ +${e.minsAfterLock}m after lock</span>`
        : e.lastMinute
        ? `<span style="color:#e67e22">🔥 Last minute</span>`
        : `<span style="color:var(--muted)">Before lock</span>`;
      h += `<tr style="border-top:1px solid var(--border)">
        <td style="padding:0.3rem 0.5rem;color:var(--gold)">${e.user}</td>
        <td style="padding:0.3rem 0.5rem;color:var(--silver)">${e.match}</td>
        <td style="padding:0.3rem 0.5rem;color:var(--muted)">${e.from}</td>
        <td style="padding:0.3rem 0.5rem;color:#2ecc71">${e.to}</td>
        <td style="padding:0.3rem 0.5rem;color:var(--silver)">${e.changedAt}</td>
        <td style="padding:0.3rem 0.5rem">${status}</td>
      </tr>`;
    });
    h += `</tbody></table></div>`;
    resultsEl.innerHTML += h;
  } catch (e) {
    console.warn('Edit history fetch:', e);
  }
}

// ═══════════════════════════════════════════════════════
// APP INIT
// ═══════════════════════════════════════════════════════
async function initApp() {
  const session = STATE.session || loadSession();
  if (!session) { showView('view-login'); await initLoginView(); return; }
  STATE.session = session;
  document.getElementById('admin-nav-btn').style.display = session.isAdmin ? 'flex' : 'none';
  document.getElementById('nav-user-name').textContent = session.nickname;

  // Topbar avatar — fetch user doc for photoURL
  try {
    const uSnap = await getDoc(doc(STATE.db, 'users', session.userId));
    const uData = uSnap.exists() ? uSnap.data() : {};
    document.getElementById('topbar-avatar').innerHTML =
      getAvatarHTML({ nickname: session.nickname, photoURL: uData.photoURL || '' }, 32);
  } catch {
    document.getElementById('topbar-avatar').innerHTML =
      getAvatarHTML({ nickname: session.nickname, photoURL: '' }, 32);
  }

  // Tapping topbar avatar opens Profile modal
  document.getElementById('topbar-avatar-wrap').onclick = () => openProfileModal();
  await initHomeView();
  showView('view-home');
  populateLeaderboardFilter();

  // Show champion/golden boot picker if not set yet
  try {
    const uSnap = await getDoc(doc(STATE.db, 'users', session.userId));
    if (uSnap.exists()) {
      const data = uSnap.data();
      if (!data.championPick || !data.goldenBootPick) {
        setTimeout(() => openChampionModal(data), 900);
      }
    }
  } catch {}
}

// ═══════════════════════════════════════════════════════
// EVENT WIRING
// ═══════════════════════════════════════════════════════
function wireEvents() {
  // Admin hidden login — tap trophy 5× on login page
  document.querySelector('.login-trophy')?.addEventListener('click', onTrophyTap);
  document.getElementById('admin-login-btn')?.addEventListener('click', handleAdminLogin);
  document.getElementById('admin-password-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleAdminLogin(); });
  document.getElementById('admin-login-close')?.addEventListener('click', () => {
    document.getElementById('admin-login-modal').style.display = 'none';
  });

  // Backdate sheet
  document.addEventListener('click', e => {
    if (e.target.id === 'backdate-save-all-btn') saveAllBackdatePredictions();
  });
  document.addEventListener('input', e => {
    if (!e.target.classList.contains('bd-score-input')) return;
    const matchId  = e.target.dataset.matchId;
    const statusEl = document.getElementById(`bd-status-${matchId}`);
    if (statusEl) {
      statusEl.textContent = '✏';
      statusEl.className   = 'bd-status bd-status-dirty';
    }
    const row = e.target.closest('.bd-row');
    row?.classList.add('bd-row-dirty');
    row?.classList.remove('bd-row-missing');
  });

  // Login
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('login-pin').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('pin-toggle').addEventListener('click', () => {
    const pin = document.getElementById('login-pin');
    pin.type = pin.type === 'password' ? 'text' : 'password';
    document.getElementById('pin-toggle').textContent = pin.type === 'password' ? '👁' : '🙈';
  });

  // Register toggle (removed — registration is closed)
  document.getElementById('show-login-btn').addEventListener('click', () => {
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
  });
  document.getElementById('register-btn').addEventListener('click', handleRegister);
  document.getElementById('reg-pin-confirm').addEventListener('keydown', e => { if (e.key === 'Enter') handleRegister(); });

  // Photo preview on file select (registration)
  document.getElementById('reg-photo-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = document.getElementById('avatar-preview');
    preview.innerHTML = '<span style="font-size:0.65rem;color:var(--muted)">Loading…</span>';
    try {
      const b64 = await resizeImageToBase64(file, 80);
      preview.innerHTML = `<img src="${b64}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">`;
    } catch (err) {
      console.error('Photo error:', err);
      preview.innerHTML = '<span class="avatar-cam-icon">❌</span>';
      showToast('Could not load photo — try a JPG or PNG', 'error');
    }
  });

  // Bottom nav
  document.querySelectorAll('.bnav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const view = btn.dataset.view;
      if      (view === 'view-leaderboard') { showView(view); await initLeaderboard(); }
      else if (view === 'view-my-preds')    { showView(view); await initMyPredictions(); }
      else if (view === 'view-admin')       { showView(view); await initAdminPanel(); }
      else if (view === 'view-home')        { showView(view); await initHomeView(); }
    });
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    clearSession(); STATE.countdownTimers.forEach(clearInterval);
    showView('view-login'); initLoginView();
  });

  // Home tabs
  document.querySelectorAll('#view-home .tab-btn').forEach(btn =>
    btn.addEventListener('click', () => selectDate(activeDateKey)));

  // Predict view
  document.getElementById('predict-back-btn').addEventListener('click', () => { showView('view-home'); selectDate(activeDateKey); });
  document.getElementById('predict-save-btn').addEventListener('click', savePrediction);

  // Stepper buttons
  document.getElementById('stepper-minus-a').addEventListener('click', () => adjustScore('a', -1));
  document.getElementById('stepper-plus-a').addEventListener('click',  () => adjustScore('a', +1));
  document.getElementById('stepper-minus-b').addEventListener('click', () => adjustScore('b', -1));
  document.getElementById('stepper-plus-b').addEventListener('click',  () => adjustScore('b', +1));

  // Swipe between dates
  let touchStartX = 0;
  document.getElementById('match-list').addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  document.getElementById('match-list').addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 60) return;
    const dates = [...document.querySelectorAll('.date-pill')].map(b => b.dataset.date);
    const cur = dates.indexOf(activeDateKey);
    const next = dx < 0 ? Math.min(cur + 1, dates.length - 1) : Math.max(cur - 1, 0);
    if (next !== cur) selectDate(dates[next]);
  }, { passive: true });

  // Leaderboard
  document.getElementById('leaderboard-filter').addEventListener('change', e => renderLeaderboard(e.target.value));

  // Admin
  document.querySelectorAll('#view-admin .tab-btn').forEach(btn =>
    btn.addEventListener('click', () => setAdminTab(btn.dataset.tab)));
  document.getElementById('admin-add-user-btn').addEventListener('click', addAdminUser);
  document.getElementById('recalc-match-btn').addEventListener('click', recalcMatch);
  document.getElementById('recalc-all-btn').addEventListener('click', recalcAll);
  document.getElementById('rescore-all-btn').addEventListener('click', rescoreAllMatches);
  document.getElementById('run-audit-btn').addEventListener('click', runIntegrityAudit);
  document.getElementById('share-standings-btn').addEventListener('click', shareStandings);

  // Champion modal
  const closeModal = () => { document.getElementById('champion-modal').style.display = 'none'; };
  document.getElementById('save-champion-btn').addEventListener('click', saveChampionPick);
  document.getElementById('skip-champion-btn').addEventListener('click', closeModal);
  document.getElementById('close-champion-btn').addEventListener('click', closeModal);
  // Tap backdrop to close
  document.getElementById('champion-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('champion-modal')) closeModal();
  });
  document.getElementById('my-picks-btn').addEventListener('click', async () => {
    const s = await getDoc(doc(STATE.db, 'users', STATE.session.userId));
    openChampionModal(s.exists() ? s.data() : null);
  });
}

// ── Profile Modal ───────────────────────────────────────
let _profilePhotoB64 = null;

async function openProfileModal() {
  const modal = document.getElementById('profile-modal');
  const prev   = document.getElementById('profile-avatar-preview');
  const nameEl = document.getElementById('profile-name');
  _profilePhotoB64 = null;

  const s = STATE.session;
  nameEl.textContent = s?.nickname || '';
  try {
    const uSnap = await getDoc(doc(STATE.db, 'users', s.userId));
    const uData = uSnap.exists() ? uSnap.data() : {};
    if (uData.photoURL) {
      prev.innerHTML = `<img src="${uData.photoURL}" style="width:90px;height:90px;object-fit:cover;">`;
    } else {
      prev.innerHTML = getAvatarHTML({ nickname: s.nickname, photoURL: '' }, 90);
    }
  } catch { prev.innerHTML = '👤'; }

  modal.style.display = 'flex';
}

// Compare modal close
document.getElementById('compare-modal-close').addEventListener('click', () => {
  document.getElementById('compare-modal').style.display = 'none';
});
document.getElementById('compare-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('compare-modal')) document.getElementById('compare-modal').style.display = 'none';
});

document.getElementById('profile-modal-close').addEventListener('click', () => {
  document.getElementById('profile-modal').style.display = 'none';
  document.getElementById('profile-photo-input').value = '';
  _profilePhotoB64 = null;
});

document.getElementById('profile-photo-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const prev = document.getElementById('profile-avatar-preview');
  prev.innerHTML = '<div style="font-size:0.8rem;color:var(--muted);padding:1rem">Processing…</div>';
  try {
    _profilePhotoB64 = await resizeImageToBase64(file, 80);
    prev.innerHTML = `<img src="${_profilePhotoB64}" style="width:90px;height:90px;object-fit:cover;">`;
  } catch (err) {
    prev.innerHTML = '❌';
    showToast('Could not load photo — try a JPG or PNG', 'error');
  }
});

document.getElementById('profile-save-btn').addEventListener('click', async () => {
  if (!_profilePhotoB64) { showToast('Pick a photo first', 'error'); return; }
  const btn = document.getElementById('profile-save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await updateDoc(doc(STATE.db, 'users', STATE.session.userId), { photoURL: _profilePhotoB64 });
    document.getElementById('topbar-avatar').innerHTML =
      getAvatarHTML({ nickname: STATE.session.nickname, photoURL: _profilePhotoB64 }, 32);
    showToast('Photo updated!', 'success');
    document.getElementById('profile-modal').style.display = 'none';
    _profilePhotoB64 = null;
  } catch (e) {
    showToast('Save failed: ' + (e?.message || e), 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Photo';
  }
});

// ── PWA Install Prompt ─────────────────────────────────
let _deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredInstallPrompt = e;
  if (!localStorage.getItem('pwa-dismissed'))
    document.getElementById('install-banner').style.display = 'flex';
});
window.addEventListener('appinstalled', () => {
  document.getElementById('install-banner').style.display = 'none';
});

// ═══════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════
async function boot() {
  const app = initializeApp(FIREBASE_CONFIG);
  STATE.db  = getFirestore(app);
  window.saveMatchResult = saveMatchResult;

  document.getElementById('install-btn').addEventListener('click', async () => {
    if (!_deferredInstallPrompt) return;
    _deferredInstallPrompt.prompt();
    const { outcome } = await _deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') document.getElementById('install-banner').style.display = 'none';
    _deferredInstallPrompt = null;
  });
  document.getElementById('install-dismiss').addEventListener('click', () => {
    document.getElementById('install-banner').style.display = 'none';
    localStorage.setItem('pwa-dismissed', '1');
  });

  wireEvents();
  await initApp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
