import { useEffect, useState } from 'react'
import { useAuth } from '../auth'
import { ref, setDoc } from '../data'
import { enableNotifications } from '../notify'
import { ErrorNote, useClub } from '../components/ui'

export default function Settings() {
  const { isSuper, profile, user } = useAuth()
  const club = useClub()
  const [f, setF] = useState(club)
  const [saved, setSaved] = useState(true)
  const [error, setError] = useState(null)
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
  useEffect(() => { if (saved) setF(club) }, [JSON.stringify(club)]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setSaved(false) }
  const save = () => setDoc(ref('settings', 'club'), f, { merge: true }).then(() => setSaved(true)).catch(setError)
  const fields = [
    ['name', 'Club name'], ['number', 'Club number'], ['area', 'Area'], ['division', 'Division'], ['district', 'District'],
    ['venue', 'Venue'], ['meetingDay', 'Meeting day'], ['startTime', 'Start time'], ['endTime', 'End time'],
    ['meetupUrl', 'Meetup link'], ['rsvpName', 'RSVP contact name'], ['rsvpPhone', 'RSVP phone'],
  ]
  return (
    <>
      <h1>Settings</h1>
      <ErrorNote error={error} />
      <div className="card">
        <h2>My account</h2>
        <p>{profile?.name}<br /><small>{user.email} · {profile?.role}</small></p>
        {perm === 'granted' ? <p className="muted">Role reminders are on for this device.</p>
          : perm === 'unsupported' ? <p className="muted">This browser does not support notifications. On iPhone, install the app to the home screen first.</p>
          : <button onClick={async () => setPerm(await enableNotifications())}>Turn on role reminders</button>}
      </div>
      <InstallCard />
      {isSuper && (
        <div className="card">
          <h2>Club details</h2>
          {fields.map(([k, label]) => (
            <div className="field" key={k}><label>{label}<input value={f[k] || ''} onChange={set(k)} /></label></div>
          ))}
          <button className="primary" disabled={saved} onClick={save}>{saved ? 'Saved' : 'Save club details'}</button>
        </div>
      )}
    </>
  )
}

function InstallCard() {
  const [prompt, setPrompt] = useState(null)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])
  if (standalone) return null
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  return (
    <div className="card">
      <h2>Install the app</h2>
      {prompt ? <button className="primary" onClick={() => prompt.prompt()}>Install Vision TM</button>
        : ios ? <p>In Safari, tap <b>Share</b> then <b>Add to Home Screen</b>.</p>
        : <p>Open your browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>.</p>}
    </div>
  )
}
