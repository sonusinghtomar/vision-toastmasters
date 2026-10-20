import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { addDoc } from 'firebase/firestore'
import { useAuth } from '../auth'
import { useDoc, useList, col, ref, query, where, updateDoc, deleteDoc, fmtDate, today, serverTimestamp, byDateDesc } from '../data'
import { GUEST_SOURCES, GUEST_STATUSES } from '../constants'
import { whatsappLink } from '../notify'
import { Loading, ErrorNote, Avatar, useClub } from '../components/ui'

export default function GuestDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { isAdmin, profile } = useAuth()
  const club = useClub()
  const { data: g, loading, error } = useDoc('guests', id)
  const { data: visits } = useList(
    () => query(col('attendance'), where('personType', '==', 'guest'), where('personId', '==', id)), [id])
  const [note, setNote] = useState('')
  const [err, setErr] = useState(null)

  if (loading) return <Loading />
  if (!g) return <><ErrorNote error={error} /><p>Guest not found.</p></>

  const save = (patch) => updateDoc(ref('guests', id), { ...patch, updatedAt: serverTimestamp() }).catch(setErr)
  const addNote = () => {
    if (!note.trim()) return
    save({ followUps: [...(g.followUps || []), { date: today(), note: note.trim(), by: profile?.name || '' }], status: g.status === 'New' ? 'Follow up' : g.status })
    setNote('')
  }
  const convert = async () => {
    if (!confirm(`Create a member profile for ${g.name}?`)) return
    try {
      const r = await addDoc(col('members'), {
        name: g.name, email: g.email || '', phone: g.phone || '', joinDate: today(), status: 'active',
        officerTitle: '', pathways: [], fromGuestId: id, createdAt: serverTimestamp(),
      })
      await save({ status: 'Joined', convertedMemberId: r.id })
      nav(`/members/${r.id}`)
    } catch (e) { setErr(e) }
  }
  const msg = `Hi ${g.name.split(' ')[0]}, thank you for visiting ${club.name}! We meet every ${club.meetingDay} at ${club.startTime}. We would love to see you again.`

  if (!isAdmin) {
    return (
      <div className="card">
        <h1>{g.name}</h1>
        <p>{g.visits || visits.length} visit(s) · first {fmtDate(g.firstVisit)}</p>
      </div>
    )
  }
  return (
    <>
      <p><Link to="/guests">← Guests</Link></p>
      <ErrorNote error={err} />
      <div className="card">
        <div className="row">
          <Avatar name={g.name} guest />
          <div className="grow"><h1 style={{ margin: 0 }}>{g.name}</h1>
            <small>{g.visits || 0} visit(s) · first {fmtDate(g.firstVisit)} · last {fmtDate(g.lastVisit)}</small></div>
        </div>
        <div className="row" style={{ marginTop: '.8rem' }}>
          {g.phone && <a className="btn small" href={`tel:${g.phone}`}>📞 Call</a>}
          {g.phone && <a className="btn small" href={whatsappLink(msg, g.phone)} target="_blank" rel="noreferrer">WhatsApp</a>}
          {g.email && <a className="btn small" href={`mailto:${g.email}?subject=${encodeURIComponent(club.name)}&body=${encodeURIComponent(msg)}`}>Email</a>}
          {g.status !== 'Joined' && <button className="small maroon" onClick={convert}>Convert to member</button>}
          {g.convertedMemberId && <Link className="btn small" to={`/members/${g.convertedMemberId}`}>Member profile</Link>}
        </div>
      </div>

      <div className="card">
        <h2>Follow-up</h2>
        <div className="grid2">
          <div className="field"><label>Status
            <select value={g.status || 'New'} onChange={(e) => save({ status: e.target.value })}>{GUEST_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label></div>
          <div className="field"><label>Next follow-up
            <input type="date" value={g.nextFollowUp || ''} onChange={(e) => save({ nextFollowUp: e.target.value })} /></label></div>
        </div>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input placeholder="Add a note (e.g. called, will come next week)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="primary" onClick={addNote}>Add</button>
        </div>
        <ul className="list">{[...(g.followUps || [])].reverse().map((f, i) => (
          <li key={i}><span className="grow">{f.note}<br /><small>{fmtDate(f.date)}{f.by ? ` · ${f.by}` : ''}</small></span></li>))}</ul>
      </div>

      <div className="card">
        <h2>Details</h2>
        <GuestFields g={g} save={save} />
      </div>

      <div className="card">
        <h2>Visits</h2>
        {visits.length === 0 ? <p className="muted">No visits recorded.</p> : (
          <ul className="list">{[...visits].sort(byDateDesc).map((v) => (
            <li key={v.id}><Link className="item" to={`/meetings/${v.meetingId}`}>{fmtDate(v.date)}{v.meetingNo ? ` · Meeting #${v.meetingNo}` : ''}{v.method === 'qr' ? ' · QR' : ''}</Link></li>))}</ul>
        )}
      </div>
      <button className="danger small" onClick={() => confirm('Delete this guest permanently?') && deleteDoc(ref('guests', id)).then(() => nav('/guests'))}>Delete guest</button>
    </>
  )
}

function GuestFields({ g, save }) {
  const [f, setF] = useState({ name: g.name || '', phone: g.phone || '', email: g.email || '', source: g.source || '', invitedBy: g.invitedBy || '', interest: g.interest || '', notes: g.notes || '' })
  const [dirty, setDirty] = useState(false)
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setDirty(true) }
  return (
    <>
      <div className="grid2">
        <div className="field"><label>Name<input value={f.name} onChange={set('name')} /></label></div>
        <div className="field"><label>Phone<input type="tel" value={f.phone} onChange={set('phone')} /></label></div>
        <div className="field"><label>Email<input type="email" value={f.email} onChange={set('email')} /></label></div>
        <div className="field"><label>Source<select value={f.source} onChange={set('source')}><option value="">–</option>{GUEST_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label></div>
        <div className="field"><label>Invited by<input value={f.invitedBy} onChange={set('invitedBy')} /></label></div>
        <div className="field"><label>Interest<input value={f.interest} onChange={set('interest')} /></label></div>
      </div>
      <div className="field"><label>Notes<textarea value={f.notes} onChange={set('notes')} /></label></div>
      <button className="primary" disabled={!dirty} onClick={() => { save({ ...f, email: f.email.trim().toLowerCase() }); setDirty(false) }}>Save details</button>
    </>
  )
}
