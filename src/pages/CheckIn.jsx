import { useEffect, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { addDoc, getDoc, getDocs } from 'firebase/firestore'
import { useAuth, anonymousSignIn, googleSignIn } from '../auth'
import { col, ref, query, where, fmtDate, markAttendanceSelf, normEmail, serverTimestamp, todayIST } from '../data'
import { GUEST_SOURCES } from '../constants'
import { Loading, ErrorNote } from '../components/ui'

// Opened by scanning a QR code: #/checkin/<meetingId>?c=<code> for one meeting, or
// #/checkin/today?c=<club code> from the permanent poster, which finds today's meeting.
export default function CheckIn() {
  const { meetingId } = useParams()
  const code = new URLSearchParams(useLocation().search).get('c') || ''
  const { user, isMember, memberId, guestId, profile } = useAuth()
  const [meeting, setMeeting] = useState(null)
  const [who, setWho] = useState(null) // 'member' | 'guest'
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', source: '', invitedBy: '', interest: 'Just exploring', firstVisit: true, consent: false })

  useEffect(() => {
    if (user === null) anonymousSignIn().catch(setError)
  }, [user])
  useEffect(() => {
    if (!user) return
    if (meetingId === 'today') {
      getDocs(query(col('meetings'), where('date', '==', todayIST()))).then((s) => {
        const list = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
        setMeeting(list[0] || 'none')
      }).catch(setError)
      return
    }
    getDoc(ref('meetings', meetingId)).then((s) => setMeeting(s.exists() ? { id: s.id, ...s.data() } : false)).catch(setError)
  }, [user, meetingId])
  useEffect(() => { if (isMember && memberId) setWho('member') }, [isMember, memberId])

  const run = async (fn) => {
    setBusy(true); setError(null)
    try { await fn(); setDone(true) } catch (e) { setError(e) }
    setBusy(false)
  }
  const memberCheckIn = () => run(() => markAttendanceSelf(meeting, memberId, profile?.name, code))
  const guestCheckIn = (e) => {
    e.preventDefault()
    run(() => addDoc(col('checkins'), {
      meetingId: meeting.id, code, uid: user.uid, at: serverTimestamp(),
      name: form.name.trim(), phone: form.phone.trim(), email: normEmail(form.email),
      source: form.source, invitedBy: form.invitedBy.trim(), interest: form.interest,
      firstVisit: form.firstVisit, consent: form.consent, guestId: guestId || '',
    }))
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  if (!user || meeting === null) return error ? <ErrorNote error={error} /> : <Loading />
  if (meeting === false) return <div className="card">This check-in link is not valid. Please scan the QR code again.</div>
  if (meeting === 'none') {
    return <div className="card stack"><h1>Welcome!</h1><p>There is no club meeting today. This QR code works on meeting days.</p><Link className="btn" to="/about">About the club app</Link></div>
  }
  // Poster check-in is only accepted from an hour before the meeting to an hour after it.
  const opens = meetingId === 'today' && meeting.checkinStart?.toDate?.()
  const closes = meetingId === 'today' && meeting.checkinEnd?.toDate?.()
  const time = (d) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
  if (opens && Date.now() < opens.getTime()) {
    return <div className="card stack"><h1>Welcome!</h1><p>Check-in for today's meeting opens at <b>{time(opens)}</b>. Please scan again then.</p></div>
  }
  if (closes && Date.now() > closes.getTime()) {
    return <div className="card stack"><h1>Thank you!</h1><p>Check-in for today's meeting closed at {time(closes)}. Please speak to the Sergeant at Arms.</p></div>
  }

  const header = (
    <div className="card accent">
      <h1>Welcome!</h1>
      <p style={{ margin: 0 }}>Meeting {meeting.number ? `#${meeting.number}` : ''} · {fmtDate(meeting.date)}</p>
      {meeting.theme && <p className="muted" style={{ margin: 0 }}>Theme: {meeting.theme}</p>}
    </div>
  )
  if (done) {
    return (
      <>{header}
        <div className="card center stack">
          <h2>You are checked in ✓</h2>
          <p>Enjoy the meeting!</p>
          {who === 'guest' && <p className="muted">Want to see your visits later? <Link to="/">Create an account</Link> with the same email.</p>}
          {isMember && <Link className="btn" to="/">Open the app</Link>}
        </div>
      </>
    )
  }
  const closedMsg = error?.code === 'permission-denied'
    ? { message: 'Check-in is closed or the QR code has changed. Please scan the current QR code or ask the SAA.' } : error

  return (
    <>
      {header}
      <ErrorNote error={closedMsg} />
      {!who && (
        <div className="card stack">
          <h2>Who are you?</h2>
          <button className="full primary" onClick={() => setWho('member')}>I am a club member</button>
          <button className="full" onClick={() => setWho('guest')}>I am a guest</button>
        </div>
      )}
      {who === 'member' && (
        <div className="card stack">
          {isMember && memberId
            ? <button className="full primary" disabled={busy} onClick={memberCheckIn}>Check me in as {profile?.name}</button>
            : (
              <>
                <p>Sign in with your member account to check in.</p>
                <button className="full primary" onClick={() => googleSignIn().catch(setError)}>Continue with Google</button>
                <p className="muted">Using email and password? <Link to="/">Sign in here</Link>, then scan the QR again.</p>
                {user && !user.isAnonymous && !memberId && <div className="banner">Your account is not linked to a member profile yet. Ask an officer to link it, or check in as a guest.</div>}
              </>
            )}
          <button className="link" onClick={() => setWho(null)}>Back</button>
        </div>
      )}
      {who === 'guest' && (
        <form className="card" onSubmit={guestCheckIn}>
          <h2>Guest check-in</h2>
          <div className="field"><label>Full name *<input required maxLength={80} value={form.name} onChange={set('name')} autoComplete="name" /></label></div>
          <div className="field"><label>Mobile number<input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" /></label></div>
          <div className="field"><label>Email<input type="email" value={form.email} onChange={set('email')} autoComplete="email" /></label></div>
          <div className="field"><label>How did you hear about us?
            <select value={form.source} onChange={set('source')}>
              <option value="">Choose…</option>
              {GUEST_SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select></label></div>
          <div className="field"><label>Invited by (member name)<input value={form.invitedBy} onChange={set('invitedBy')} /></label></div>
          <div className="field"><label>Are you interested in joining?
            <select value={form.interest} onChange={set('interest')}>
              <option>Just exploring</option><option>Interested in joining</option><option>Please call me</option>
            </select></label></div>
          <div className="field"><label className="check"><input type="checkbox" checked={form.firstVisit} onChange={set('firstVisit')} />This is my first visit</label></div>
          <div className="field"><label className="check"><input type="checkbox" required checked={form.consent} onChange={set('consent')} />
            The club may contact me about meetings. *</label></div>
          <button className="full primary" disabled={busy} type="submit">Check in</button>
          <p style={{ marginTop: '.6rem' }}><button type="button" className="link" onClick={() => setWho(null)}>Back</button></p>
        </form>
      )}
    </>
  )
}
