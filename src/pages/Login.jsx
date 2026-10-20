import { useState } from 'react'
import { googleSignIn, emailSignIn, emailSignUp, resetPassword } from '../auth'

const ICON_URL = `${import.meta.env.BASE_URL}icon-192.png`

const friendly = (e) => ({
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account with this email exists. Sign in instead.',
  'auth/weak-password': 'Use at least 6 characters for the password.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/invalid-email': 'Please enter a valid email.',
}[e.code] || e.message)

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn) => {
    setBusy(true); setMsg(null)
    try { await fn() } catch (e) { setMsg({ error: true, text: friendly(e) }) }
    setBusy(false)
  }
  const submit = (e) => {
    e.preventDefault()
    run(async () => {
      if (mode === 'signup') {
        await emailSignUp(name, email, pw)
        setMsg({ text: 'Account created. We sent you a verification email; open the link to finish linking your profile.' })
      } else if (mode === 'reset') {
        await resetPassword(email)
        setMsg({ text: 'Password reset email sent.' })
      } else await emailSignIn(email, pw)
    })
  }

  return (
    <div className="login">
      <div className="brand">
        <img src={ICON_URL} alt="" />
        <h1>Vision Toastmasters</h1>
        <p className="muted center">Attendance, guests, speeches and Pathways in one place</p>
      </div>
      <div className="card">
        <button className="full primary" disabled={busy} onClick={() => run(googleSignIn)}>
          Continue with Google
        </button>
        <div className="divider">or use email</div>
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <div className="field"><label>Full name<input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label></div>
          )}
          <div className="field"><label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label></div>
          {mode !== 'reset' && (
            <div className="field"><label>Password<input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label></div>
          )}
          {msg && <div className={`banner ${msg.error ? 'error' : 'ok'}`}>{msg.text}</div>}
          <button className="full" disabled={busy} type="submit">
            {mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}
          </button>
        </form>
        <div className="row between" style={{ marginTop: '.8rem' }}>
          {mode === 'signin'
            ? <button className="link" onClick={() => setMode('signup')}>New here? Create account</button>
            : <button className="link" onClick={() => setMode('signin')}>Back to sign in</button>}
          {mode === 'signin' && <button className="link" onClick={() => setMode('reset')}>Forgot password?</button>}
        </div>
      </div>
      <p className="footer-note">
        Guests: you do not need an account to check in. Scan the QR code at the meeting.
      </p>
    </div>
  )
}
