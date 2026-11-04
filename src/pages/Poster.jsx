import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { useDoc, useMeetings, ref, setDoc, updateDoc, serverTimestamp, checkinWindow, todayIST, CHECKIN_MARGIN_MIN, fmtDate } from '../data'
import { download } from '../export'
import { meetsText } from '../schedule'
import { Loading, ErrorNote, useClub } from '../components/ui'

const LOGO_URL = `${import.meta.env.BASE_URL}club-logo.webp`
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16)

// One printed QR for the venue. On meeting days it checks people into that day's meeting,
// from an hour before the start until an hour after the end (enforced by firestore.rules).
export default function Poster() {
  const club = useClub()
  const { data: poster, loading } = useDoc('checkinCodes', '_club')
  const { data: meetings } = useMeetings()
  const [img, setImg] = useState('')
  const [error, setError] = useState(null)
  const url = poster?.code ? `${location.origin}${import.meta.env.BASE_URL}#/checkin/today?c=${poster.code}` : ''

  useEffect(() => {
    if (url) QRCode.toDataURL(url, { width: 900, margin: 1, color: { dark: '#004165' } }).then(setImg)
  }, [url])

  // Meetings saved before the poster existed have no check-in window yet.
  useEffect(() => {
    for (const m of meetings) {
      if (m.date >= todayIST() && !m.checkinStart) {
        updateDoc(ref('meetings', m.id), checkinWindow(m.date, m.startTime || club.startTime, m.endTime || club.endTime)).catch(setError)
      }
    }
  }, [meetings, club.startTime, club.endTime])

  const create = () => setDoc(ref('checkinCodes', '_club'), { code: newCode(), enabled: true, createdAt: serverTimestamp() }).catch(setError)
  const replace = () => confirm('Make a new poster code? Posters already printed will stop working.') && create()
  const toggle = () => updateDoc(ref('checkinCodes', '_club'), { enabled: !poster.enabled }).catch(setError)
  const saveImage = async () => download(await (await fetch(img)).blob(), 'vision-tm-checkin-qr.png')

  const t = todayIST()
  const next = meetings.filter((m) => m.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0]
  if (loading) return <Loading />
  return (
    <>
      <div className="no-print">
        <p><Link to="/more">← More</Link></p>
        <h1>Check-in poster</h1>
        <ErrorNote error={error} />
        <div className="card stack">
          <p style={{ margin: 0 }}>Print this once and keep it at the venue. On meeting days, members and guests scan it to check in to that day's meeting. No one needs to open check-in on their phone.</p>
          <p className="muted" style={{ margin: 0 }}>It works from {CHECKIN_MARGIN_MIN} minutes before the meeting starts until {CHECKIN_MARGIN_MIN} minutes after it ends, and does nothing on other days.</p>
          {next && <p className="muted" style={{ margin: 0 }}>Next meeting: {fmtDate(next.date, { weekday: 'long', day: 'numeric', month: 'long' })}{next.startTime ? `, ${next.startTime}` : ''}.</p>}
          {!poster && <button className="primary" onClick={create}>Create poster QR</button>}
          {poster && (
            <div className="row">
              <button className="primary" onClick={() => window.print()} disabled={!poster.enabled}>🖨️ Print poster</button>
              <button onClick={saveImage} disabled={!img}>Save QR image</button>
              <button onClick={toggle}>{poster.enabled ? 'Turn off' : 'Turn on'}</button>
              <button className="danger" onClick={replace}>New code</button>
            </div>
          )}
          {poster && !poster.enabled && <div className="banner">The poster is turned off. Scans are refused until you turn it on.</div>}
        </div>
      </div>

      {poster && img && (
        <div className="poster">
          <img src={LOGO_URL} alt="Vision Toastmasters" className="poster-logo" />
          <h2>Welcome! Please check in</h2>
          <img src={img} alt="Check-in QR code" className="poster-qr" />
          <ol>
            <li>Open your phone camera and point it at the code.</li>
            <li><b>Members:</b> tap “Check me in”.</li>
            <li><b>Guests:</b> tap “I am a guest” and fill in your name.</li>
          </ol>
          <p className="poster-foot">{club.name} · Club {club.number} · {meetsText(club)}, {club.startTime}</p>
        </div>
      )}
    </>
  )
}
