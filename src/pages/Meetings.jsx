import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { useMeetings, saveMeeting, today, fmtDate, newSlotKey, programYear, programYearRange } from '../data'
import { DEFAULT_SLOTS } from '../constants'
import { DAYS, ORD, parseWeeks, meetingDates, nextMeetingDate } from '../schedule'
import { Loading, ErrorNote, Modal, useClub } from '../components/ui'

// A new meeting with the standard Vision agenda.
const standardMeeting = (club, fields) => ({
  startTime: club.startTime, endTime: club.endTime, venue: club.venue, theme: '',
  slots: DEFAULT_SLOTS.map(([role, time]) => ({
    key: newSlotKey(role), role, time, person: null,
    ...(role === 'speaker' ? { duration: '5-7', evaluator: null } : {}),
  })),
  awards: {}, createdAt: new Date().toISOString(),
  ...fields,
})

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
            <button className="small" onClick={() => setParams({ plan: '1' })}>Plan meetings</button>
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
      {/* Both forms suggest numbers and dates from existing meetings, so wait for the list. */}
      {showNew && !loading && <NewMeeting meetings={meetings} onClose={() => setParams({})} />}
      {params.get('plan') === '1' && !loading && <PlanMeetings meetings={meetings} onClose={() => setParams({})} />}
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
  const [form, setForm] = useState({ number: lastNo ? lastNo + 1 : '', date: nextMeetingDate(club, today()), theme: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const create = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const id = await saveMeeting(standardMeeting(club, {
        number: form.number ? Number(form.number) : null, date: form.date, theme: form.theme,
      }))
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

// Create a season of meetings in one go, e.g. every 1st, 3rd and 5th Sunday until 30 June.
// Dates that already have a meeting are left alone; numbering continues from them.
function PlanMeetings({ meetings, onClose }) {
  const club = useClub()
  const nav = useNavigate()
  const t = today()
  const lastNo = Math.max(0, ...meetings.map((m) => Number(m.number) || 0))
  const latest = meetings.map((m) => m.date).filter((d) => d >= t).sort().pop()
  const [f, setF] = useState({
    number: lastNo ? lastNo + 1 : '',
    from: nextMeetingDate(club, latest ? nextDay(latest) : t),
    until: programYearRange(programYear())[1],
    day: club.meetingDay, weeks: parseWeeks(club.meetingWeeks),
    startTime: club.startTime, endTime: club.endTime,
  })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const toggleWeek = (w) => setF({ ...f, weeks: f.weeks.includes(w) ? f.weeks.filter((x) => x !== w) : [...f.weeks, w].sort() })

  const byDate = Object.fromEntries(meetings.map((m) => [m.date, m]))
  const plan = []
  let n = Number(f.number) || null
  for (const date of f.from && f.until ? meetingDates(f.from, f.until, f.day, f.weeks) : []) {
    const existing = byDate[date]
    plan.push({ date, number: existing ? existing.number : n, existing })
    n = n == null ? null : (existing?.number ? Number(existing.number) : n) + 1
  }
  const toCreate = plan.filter((p) => !p.existing)

  const create = async () => {
    setBusy(true); setError(null)
    try {
      for (const p of toCreate) {
        await saveMeeting(standardMeeting(club, { number: p.number, date: p.date, startTime: f.startTime, endTime: f.endTime }))
        setDone((d) => d + 1)
      }
      nav('/meetings', { replace: true })
      onClose()
    } catch (e) { setError(e); setBusy(false) }
  }

  return (
    <Modal title="Plan meetings" onClose={onClose}>
      <ErrorNote error={error} />
      <p className="muted">Creates meetings with the standard agenda on every matching date. Import each agenda later to fill in the roles. The check-in poster then works on all of them.</p>
      <div className="grid2">
        <div className="field"><label>First meeting #<input type="number" value={f.number} onChange={set('number')} /></label></div>
        <div className="field"><label>Day<select value={f.day} onChange={set('day')}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select></label></div>
        <div className="field"><label>From<input type="date" value={f.from} onChange={set('from')} /></label></div>
        <div className="field"><label>Until<input type="date" value={f.until} onChange={set('until')} /></label></div>
        <div className="field"><label>Start<input type="time" value={f.startTime} onChange={set('startTime')} /></label></div>
        <div className="field"><label>End<input type="time" value={f.endTime} onChange={set('endTime')} /></label></div>
      </div>
      <div className="field">
        <label>Weeks of the month (none ticked = every week)</label>
        <div className="row">{[1, 2, 3, 4, 5].map((w) => (
          <label key={w} className="check"><input type="checkbox" checked={f.weeks.includes(w)} onChange={() => toggleWeek(w)} />{ORD[w]}</label>
        ))}</div>
      </div>
      <p><b>{toCreate.length} new meeting{toCreate.length === 1 ? '' : 's'}</b>{plan.length > toCreate.length ? ` (${plan.length - toCreate.length} date${plan.length - toCreate.length === 1 ? '' : 's'} already have a meeting)` : ''}</p>
      <ul className="list" style={{ maxHeight: 260, overflow: 'auto' }}>
        {plan.map((p) => (
          <li key={p.date} style={{ padding: '.35rem 0' }}>
            <span style={{ width: 52 }}><b>{p.number ? `#${p.number}` : '–'}</b></span>
            <span className="grow">{fmtDate(p.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
            {p.existing ? <span className="chip gray">Already exists</span> : <span className="chip green">New</span>}
          </li>
        ))}
      </ul>
      <button className="full primary" style={{ marginTop: '.8rem' }} disabled={busy || !toCreate.length} onClick={create}>
        {busy ? `Creating… ${done}/${toCreate.length}` : `Create ${toCreate.length} meeting${toCreate.length === 1 ? '' : 's'}`}
      </button>
    </Modal>
  )
}

function nextDay(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d + 1).toLocaleDateString('en-CA')
}
