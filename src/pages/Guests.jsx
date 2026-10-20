import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { addDoc } from 'firebase/firestore'
import { useGuests, col, normEmail, serverTimestamp, today, fmtDate, programYear, programYearRange } from '../data'
import { GUEST_SOURCES, GUEST_STATUSES } from '../constants'
import { Loading, ErrorNote, Avatar, Modal } from '../components/ui'

const statusChip = { New: 'yellow', 'Follow up': 'yellow', Interested: 'maroon', Joined: 'green', 'Not interested': 'gray' }

export default function Guests() {
  const { data, loading, error } = useGuests()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('open')
  const [from, to] = programYearRange(programYear())

  const yearGuests = data.filter((g) => (g.firstVisit || '') >= from && (g.firstVisit || '') <= to)
  const list = data
    .filter((g) => status === 'all' || (status === 'open' ? !['Joined', 'Not interested'].includes(g.status) : g.status === status))
    .filter((g) => `${g.name} ${g.phone || ''} ${g.email || ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || ''))

  return (
    <>
      <div className="row between">
        <h1>Guests</h1>
        <button className="small primary" onClick={() => setParams({ new: '1' })}>＋ Add guest</button>
      </div>
      <ErrorNote error={error} />
      <div className="stats">
        <div className="stat"><b>{yearGuests.length}</b><span>Guests this year</span></div>
        <div className="stat"><b>{yearGuests.filter((g) => (g.visits || 0) > 1).length}</b><span>Came back</span></div>
        <div className="stat"><b>{yearGuests.filter((g) => g.status === 'Joined').length}</b><span>Joined</span></div>
        <div className="stat"><b>{yearGuests.length ? Math.round((yearGuests.filter((g) => g.status === 'Joined').length / yearGuests.length) * 100) : 0}%</b><span>Conversion</span></div>
      </div>
      <div className="row" style={{ marginBottom: '1rem' }}>
        <input className="grow" placeholder="Search name, phone, email" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 170 }} aria-label="Status">
          <option value="open">Open (to follow up)</option><option value="all">All</option>
          {GUEST_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {loading ? <Loading /> : (
        <div className="card">
          {list.length === 0 ? <p className="muted">No guests here.</p> : (
            <ul className="list">{list.map((g) => (
              <li key={g.id}><Link className="item" to={`/guests/${g.id}`}>
                <Avatar name={g.name} guest />
                <span className="grow ellipsis"><b>{g.name}</b><br />
                  <small>{g.visits || 0} visit(s) · last {fmtDate(g.lastVisit)}{g.nextFollowUp ? ` · follow up ${fmtDate(g.nextFollowUp)}` : ''}</small></span>
                <span className={`chip ${statusChip[g.status || 'New']}`}>{g.status || 'New'}</span>
              </Link></li>))}</ul>
          )}
        </div>
      )}
      {params.get('new') === '1' && <GuestForm onClose={() => setParams({})} />}
    </>
  )
}

function GuestForm({ onClose }) {
  const nav = useNavigate()
  const [f, setF] = useState({ name: '', phone: '', email: '', source: '', invitedBy: '', interest: '', firstVisit: today(), notes: '' })
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    try {
      const r = await addDoc(col('guests'), {
        ...f, name: f.name.trim(), email: normEmail(f.email), status: 'New', visits: 0, lastVisit: f.firstVisit,
        followUps: [], createdAt: serverTimestamp(),
      })
      nav(`/guests/${r.id}`, { replace: true })
    } catch (err) { setError(err) }
  }
  return (
    <Modal title="Add guest" onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorNote error={error} />
        <div className="field"><label>Name *<input required value={f.name} onChange={set('name')} /></label></div>
        <div className="grid2">
          <div className="field"><label>Phone<input type="tel" value={f.phone} onChange={set('phone')} /></label></div>
          <div className="field"><label>Email<input type="email" value={f.email} onChange={set('email')} /></label></div>
          <div className="field"><label>Source<select value={f.source} onChange={set('source')}><option value="">–</option>{GUEST_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label></div>
          <div className="field"><label>Invited by<input value={f.invitedBy} onChange={set('invitedBy')} /></label></div>
        </div>
        <div className="field"><label>Notes<textarea value={f.notes} onChange={set('notes')} /></label></div>
        <p className="muted">To record a visit, add the guest from the meeting's Attendance tab.</p>
        <button className="full primary">Save</button>
      </form>
    </Modal>
  )
}
