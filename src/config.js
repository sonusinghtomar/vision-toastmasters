// ─────────────────────────────────────────────────────────────
// 1. Paste your Firebase web app config here (see docs/SETUP.md).
//    These values are NOT secrets; they identify your Firebase
//    project. Security comes from firestore.rules.
// ─────────────────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey: 'PASTE_API_KEY',
  authDomain: 'PASTE_PROJECT_ID.firebaseapp.com',
  projectId: 'PASTE_PROJECT_ID',
  storageBucket: 'PASTE_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'PASTE_SENDER_ID',
  appId: 'PASTE_APP_ID',
}

// 2. Gemini model used for agenda reading and voice logging.
//    If Google retires this model, change it to a current "flash" model.
export const GEMINI_MODEL = 'gemini-2.5-flash'

// `npm run emulators` + `npm run dev:local` runs everything on your computer with fake data.
export const useEmulators = import.meta.env.VITE_EMULATORS === '1'
if (useEmulators) Object.assign(firebaseConfig, { apiKey: 'demo-key', authDomain: 'demo-vtm.firebaseapp.com', projectId: 'demo-vtm', appId: 'demo' })

export const isConfigured = !firebaseConfig.apiKey.startsWith('PASTE_')
