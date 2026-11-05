import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { useInbox } from '../inbox'
import { useMeetings, decideRequest, fmtDate } from '../data'
import { Loading, ErrorNote, Avatar } from '../components/ui'

// Everything waiting for an officer: role requests and people waiting for access.
export default function Requests() {
  const { profile } = useAuth()
  const { pendingUsers, roleRequests, loading } = useInbox(true)
  const { data: meetings } = useMeetings()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState(null)

  const decide = async (r, approve) => {
    setBusy(r.id); setError(null)
    try { await decideRequest(r, approve, profile?.name || '') } catch (e) { setError(e) }
    setBusy('')
  }
  const current = (r) => {
    const s = meetings.find((m) => m.id === r.meetingId)?.slots?.find((x) => x.key === r.slotKey)
    return r.part === 'evaluator' ? s?.evaluator?.name : s?.person?.name
  }

  if (loading) return <Loading />
  return (
    <>
      <h1>Requests</h1>
      <ErrorNote error={error} />
      <div className="card">
        <h2>Role requests ({roleRequests.length})</h2>
        {roleRequests.length === 0 ? <p className="muted">No role requests waiting.</p> : (
          <ul className="list">{roleRequests.map((r) => {
            const taken = current(r)
            return (
              <li key={r.id} style={{ display: 'block' }}>
                <div className="row">
                  <Avatar name={r.name} />
                  <span className="grow"><b>{r.name}</b> asked for <b>{r.roleLabel}</b><br />
                    <small><Link to={`/meetings/${r.meetingId}`}>{fmtDate(r.date, { weekday: 'short', day: 'numeric', month: 'short' })}{r.meetingNo ? ` · #${r.meetingNo}` : ''}</Link></small></span>
                </div>
                {r.note && <p className="muted" style={{ margin: '.3rem 0 0 2.6rem' }}>“{r.note}”</p>}
                {taken && <p style={{ margin: '.3rem 0 0 2.6rem' }}><span className="chip yellow">Now assigned to {taken}</span> Approving replaces them.</p>}
                <div className="row" style={{ justifyContent: 'flex-end', marginTop: '.4rem' }}>
                  <button className="small" disabled={busy === r.id} onClick={() => decide(r, false)}>Decline</button>
                  <button className="small primary" disabled={busy === r.id} onClick={() => decide(r, true)}>Approve</button>
                </div>
              </li>
            )
          })}</ul>
        )}
      </div>
      <div className="card">
        <h2>Waiting for access ({pendingUsers.length})</h2>
        {pendingUsers.length === 0 ? <p className="muted">Nobody is waiting.</p> : (
          <>
            <ul className="list">{pendingUsers.map((u) => (
              <li key={u.id}><Avatar name={u.name} /><span className="grow ellipsis"><b>{u.name}</b><br /><small>{u.email}</small></span></li>))}</ul>
            <Link className="btn primary" to="/admin">Approve in Users and access</Link>
            <p className="muted" style={{ marginTop: '.6rem' }}>Tip: people whose email is on the member roster are linked automatically and never wait here.</p>
          </>
        )}
      </div>
    </>
  )
}
