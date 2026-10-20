import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { useMeetings, saveMeeting, today, fmtDate, newSlotKey } from '../data'
import { DEFAULT_SLOTS } from '../constants'
import { Loading, ErrorNote, Modal, useClub } from '../components/ui'

function nextWeekday(dayName) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const target = Math.max(0, days.indexOf(dayName))
  const d = new Date()
  d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7))
  return d.toLocaleDateString('en-CA')
}

export default function Meetings() {
  const { isAdmin } = useAuth()
  const { data: meetings, loading, error } = useMeetings()
  const [params, setParams] = useSearchParams()
  const showNew = params.get('new') === '1'
  const t = today()
  const upcoming = meetings.filter((m) => m.date >= t).reverse()
  const past = meetings.filter((m) => m.date < t)

  return (
    <>
      <div className="row between">
        <h1>Meetings</h1>
        {isAdmin && (
          <div className="row">
            <Link className="btn small" to="/meetings/import">Import agenda</Link>
            <button className="small primary" onClick={() => setParams({ new: '1' })}>＋ New</button>
          </div>
        )}
      </div>
      <ErrorNote error={error} />
      {loading ? <Loading /> : (
        <>
          <MeetingList title="Upcoming" items={upcoming} empty="No upcoming meetings." />
          <MeetingList title="Past" items={past} empty="No past meetings yet." />
        </>
      )}
      {showNew && <NewMeeting meetings={meetings} onClose={() => setParams({})} />}
    </>
  )
}

function MeetingList({ title, items, empty }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {items.length === 0 ? <p className="muted">{empty}</p> : (
        <ul className="list">{items.map((m) => (
          <li key={m.id}><Link className="item" to={`/meetings/${m.id}`}>
            <span className="avatar">{m.number ? String(m.number).slice(-3) : '•'}</span>
            <span className="grow ellipsis">
              <b>{m.theme || 'Club meeting'}</b><br />
              <small>{fmtDate(m.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</small>
            </span>
            {m.awards && Object.keys(m.awards).length > 0 && <span className="chip yellow">Awards</span>}
          </Link></li>))}</ul>
      )}
    </div>
  )
}

function NewMeeting({ meetings, onClose }) {
  const club = useClub()
  const nav = useNavigate()
  const lastNo = Math.max(0, ...meetings.map((m) => Number(m.number) || 0))
  const [form, setForm] = useState({ number: lastNo ? lastNo + 1 : '', date: nextWeekday(club.meetingDay), theme: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const create = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const id = await saveMeeting({
        number: form.number ? Number(form.number) : null, date: form.date, theme: form.theme,
        startTime: club.startTime, endTime: club.endTime, venue: club.venue,
        slots: DEFAULT_SLOTS.map(([role, time]) => ({
          key: newSlotKey(role), role, time, person: null,
          ...(role === 'speaker' ? { duration: '5-7', evaluator: null } : {}),
        })),
        awards: {}, createdAt: new Date().toISOString(),
      })
      nav(`/meetings/${id}`, { replace: true })
    } catch (err) { setError(err); setBusy(false) }
  }
  return (
    <Modal title="New meeting" onClose={onClose}>
      <form onSubmit={create}>
        <ErrorNote error={error} />
        <div className="grid2">
          <div className="field"><label>Meeting #<input type="number" value={form.number} onChange={set('number')} /></label></div>
          <div className="field"><label>Date<input type="date" required value={form.date} onChange={set('date')} /></label></div>
        </div>
        <div className="field"><label>Theme<input value={form.theme} onChange={set('theme')} /></label></div>
        <p className="muted">The standard Vision agenda (SAA, PO, TMOD, GE, support roles, 4 prepared speakers, Table Topics) will be created. You can edit it next.</p>
        <button className="full primary" disabled={busy}>Create meeting</button>
      </form>
    </Modal>
  )
}
