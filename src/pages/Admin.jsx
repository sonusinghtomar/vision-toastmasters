import { useState } from 'react'
import { useAuth } from '../auth'
import { useList, useMembers, useGuests, col, ref, updateDoc, byName } from '../data'
import { Loading, ErrorNote, Avatar } from '../components/ui'

const ROLE_INFO = {
  superadmin: 'President: full access, grants admin rights',
  admin: 'Officer: manages meetings, members, guests',
  member: 'Member: own profile, speeches, roles',
  guest: 'Guest: own visits only',
  pending: 'Waiting to be linked',
}

// The President (superadmin) decides who gets officer rights. Officers can approve members and guests.
export default function Admin() {
  const { isSuper, user } = useAuth()
  const { data: users, loading, error } = useList(() => col('users'), [])
  const { data: members } = useMembers()
  const { data: guests } = useGuests()
  const [err, setErr] = useState(null)
  const [q, setQ] = useState('')

  const roles = isSuper ? ['superadmin', 'admin', 'member', 'guest', 'pending'] : ['member', 'guest', 'pending']
  const save = (u, patch) => updateDoc(ref('users', u.id), patch).catch(setErr)
  const order = ['pending', 'superadmin', 'admin', 'member', 'guest']
  const list = users
    .filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || byName(a, b))

  if (loading) return <Loading />
  return (
    <>
      <h1>Users &amp; access</h1>
      <ErrorNote error={error || err} />
      <div className="banner info">
        People appear here after their first sign-in. Link each person to their member or guest record.
        {isSuper ? ' As President you can also make officers admins.' : ' Only the President can grant officer (admin) rights.'}
      </div>
      <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: '1rem' }} />
      <div className="card">
        <ul className="list">{list.map((u) => {
          const locked = !isSuper && ['admin', 'superadmin'].includes(u.role)
          const self = u.id === user.uid
          return (
            <li key={u.id} style={{ display: 'block' }}>
              <div className="row">
                <Avatar name={u.name} />
                <span className="grow ellipsis"><b>{u.name}</b><br /><small>{u.email}</small></span>
                {u.role === 'pending' && <span className="chip yellow">New</span>}
              </div>
              <div className="grid2" style={{ marginTop: '.5rem' }}>
                <select value={u.role} disabled={locked || self} title={ROLE_INFO[u.role]} aria-label="Access"
                  onChange={(e) => save(u, { role: e.target.value })}>
                  {(locked ? [u.role] : roles).map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
                </select>
                {u.role === 'guest' ? (
                  <select value={u.guestId || ''} disabled={locked} onChange={(e) => save(u, { guestId: e.target.value })} aria-label="Guest record">
                    <option value="">Link guest record…</option>
                    {[...guests].sort(byName).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                ) : (
                  <select value={u.memberId || ''} disabled={locked && !isSuper} onChange={(e) => save(u, { memberId: e.target.value })} aria-label="Member record">
                    <option value="">Link member record…</option>
                    {[...members].sort(byName).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
              </div>
              <small className="muted">{ROLE_INFO[u.role]}</small>
            </li>
          )
        })}</ul>
      </div>
    </>
  )
}
