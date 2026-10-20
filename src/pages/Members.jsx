import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addDoc } from 'firebase/firestore'
import { useAuth } from '../auth'
import { useMembers, col, byName, normEmail, serverTimestamp, today } from '../data'
import { OFFICER_TITLES } from '../constants'
import { Loading, ErrorNote, Avatar, Modal } from '../components/ui'

export default function Members() {
  const { isAdmin } = useAuth()
  const { data, loading, error } = useMembers()
  const [q, setQ] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [adding, setAdding] = useState(false)

  const list = data
    .filter((m) => showInactive || m.status !== 'inactive')
    .filter((m) => m.name?.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (OFFICER_TITLES.indexOf(a.officerTitle) + 1 || 99) - (OFFICER_TITLES.indexOf(b.officerTitle) + 1 || 99) || byName(a, b))

  return (
    <>
      <div className="row between">
        <h1>Members ({data.filter((m) => m.status !== 'inactive').length})</h1>
        {isAdmin && <button className="small primary" onClick={() => setAdding(true)}>＋ Add member</button>}
      </div>
      <ErrorNote error={error} />
      <div className="row" style={{ marginBottom: '1rem' }}>
        <input className="grow" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />Inactive</label>
      </div>
      {loading ? <Loading /> : (
        <div className="card">
          <ul className="list">{list.map((m) => {
            const path = (m.pathways || []).find((p) => !p.completed)
            return (
              <li key={m.id}><Link className="item" to={`/members/${m.id}`}>
                <Avatar name={m.name} />
                <span className="grow ellipsis"><b>{m.name}</b><br />
                  <small>{path ? `${path.path} · Level ${path.level || 1}` : 'No path recorded'}</small></span>
                {m.officerTitle && <span className="chip maroon">{m.officerTitle}</span>}
                {m.status === 'inactive' && <span className="chip gray">Inactive</span>}
              </Link></li>
            )
          })}</ul>
        </div>
      )}
      {adding && <MemberForm onClose={() => setAdding(false)} />}
    </>
  )
}

export function MemberForm({ onClose, initial = {}, onSave }) {
  const nav = useNavigate()
  const [f, setF] = useState({ name: '', email: '', phone: '', joinDate: today(), officerTitle: '', status: 'active', ...initial })
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    const data = { ...f, name: f.name.trim(), email: normEmail(f.email), phone: f.phone.trim() }
    try {
      if (onSave) { await onSave(data); onClose(); return }
      const r = await addDoc(col('members'), { ...data, pathways: [], createdAt: serverTimestamp() })
      nav(`/members/${r.id}`)
    } catch (err) { setError(err) }
  }
  return (
    <Modal title={initial.name ? 'Edit member' : 'Add member'} onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorNote error={error} />
        <div className="field"><label>Full name *<input required value={f.name} onChange={set('name')} /></label></div>
        <div className="field"><label>Email (used to link their login)<input type="email" value={f.email} onChange={set('email')} /></label></div>
        <div className="grid2">
          <div className="field"><label>Phone<input type="tel" value={f.phone} onChange={set('phone')} /></label></div>
          <div className="field"><label>Joined on<input type="date" value={f.joinDate} onChange={set('joinDate')} /></label></div>
          <div className="field"><label>Officer role
            <select value={f.officerTitle} onChange={set('officerTitle')}>
              <option value="">None</option>{OFFICER_TITLES.map((t) => <option key={t}>{t}</option>)}
            </select></label></div>
          <div className="field"><label>Status
            <select value={f.status} onChange={set('status')}><option value="active">Active</option><option value="inactive">Inactive</option></select>
          </label></div>
        </div>
        <button className="full primary">Save</button>
      </form>
    </Modal>
  )
}
