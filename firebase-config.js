// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIREBASE CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. Go to console.firebase.google.com
// 2. Create a project → Add a web app → copy the config below
// 3. Replace every value below with your own config
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAsQbFzvSwNOwSwPyBmTEjvAj-Bz9y6BPM",
  authDomain:        "kootharas-wc.firebaseapp.com",
  projectId:         "kootharas-wc",
  storageBucket:     "kootharas-wc.firebasestorage.app",
  messagingSenderId: "543573001108",
  appId:             "1:543573001108:web:e9d7e7d64c08080b408581"
};

// ── football-data.org API key ──────────────────────────
// Used only by the GitHub Actions backend script (scripts/fetch-results.js).
// Set it as a GitHub Secret (FOOTBALL_API_KEY) — never put it here.
