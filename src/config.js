// ─────────────────────────────────────────────────────────────
// 1. Paste your Firebase web app config here (see docs/SETUP.md).
//    These values are NOT secrets; they identify your Firebase
//    project. Security comes from firestore.rules.
// ─────────────────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey: 'AIzaSyD8m2S2Ecax94MYK-BNHaNO_-2a3ywtT-o',
  authDomain: 'vision-toastmasters.firebaseapp.com',
  projectId: 'vision-toastmasters',
  storageBucket: 'vision-toastmasters.firebasestorage.app',
  messagingSenderId: '1070111425996',
  appId: '1:1070111425996:web:bb7435b6f866169a3d8969',
}

// 2. Gemini model used for agenda reading and voice logging.
//    "gemini-flash-latest" always points to Google's current Flash model,
//    so it keeps working when older models are retired.
export const GEMINI_MODEL = 'gemini-flash-latest'
// Used automatically when the main model is busy or its free quota is used up.
export const GEMINI_FALLBACK_MODEL = 'gemini-flash-lite-latest'

// `npm run emulators` + `npm run dev:local` runs everything on your computer with fake data.
export const useEmulators = import.meta.env.VITE_EMULATORS === '1'
if (useEmulators) Object.assign(firebaseConfig, { apiKey: 'demo-key', authDomain: 'demo-vtm.firebaseapp.com', projectId: 'demo-vtm', appId: 'demo' })

export const isConfigured = !firebaseConfig.apiKey.startsWith('PASTE_')
