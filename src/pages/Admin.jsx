import { useState } from 'react'
import { useAuth } from '../auth'
import { addDoc } from 'firebase/firestore'
import { useList, useMembers, useGuests, col, ref, updateDoc, byName, normEmail, today, serverTimestamp } from '../data'
import { OFFICER_TITLES } from '../constants'
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
  // Linking a waiting person to a member record also lets them in as a member.
  const linkMember = async (u, value) => {
    try {
      let memberId = value
      if (value === '__new') {
        const r = await addDoc(col('members'), {
          name: u.name || '', email: normEmail(u.email), phone: '', status: 'active', joinDate: today(),
          officerTitle: '', pathways: [], createdAt: serverTimestamp(),
        })
        memberId = r.id
      }
      await updateDoc(ref('users', u.id), { memberId, ...(memberId && u.role === 'pending' ? { role: 'member' } : {}) })
    } catch (e) { setErr(e) }
  }
  // An ExCom title lives on the member record; giving one also grants Admin.
  const setTitle = async (u, title) => {
    try {
      await updateDoc(ref('members', u.memberId), { officerTitle: title })
      if (title && ['member', 'pending'].includes(u.role)) await updateDoc(ref('users', u.id), { role: 'admin' })
    } catch (e) { setErr(e) }
  }
  const order = ['pending', 'superadmin', 'admin', 'member', 'guest']
  const list = users
    .filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || byName(a, b))

  if (loading) return <Loading />
  return (
    <>
      <h1>Users &amp; access</h1>
      <ErrorNote error={error || err} />
      {isSuper && <ExcomAdmin users={users} members={members} onError={setErr} />}
      <div className="banner info">
        People appear here after their first sign-in. <b>Link member record</b> connects their login to their entry on the club roster, so they see their own profile, roles and stats (people whose email is on the roster are linked automatically).
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
                  <select value={u.memberId || ''} disabled={locked && !isSuper} onChange={(e) => linkMember(u, e.target.value)} aria-label="Member record">
                    <option value="">Link member record…</option>
                    <option value="__new">＋ Create member profile for {u.name || u.email}</option>
                    {[...members].sort(byName).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
              </div>
              {isSuper && u.role !== 'guest' && u.memberId && (
                <div className="row" style={{ marginTop: '.4rem', flexWrap: 'nowrap' }}>
                  <small className="muted" style={{ whiteSpace: 'nowrap' }}>ExCom title</small>
                  <select value={members.find((m) => m.id === u.memberId)?.officerTitle || ''} aria-label="ExCom title"
                    onChange={(e) => setTitle(u, e.target.value)}>
                    <option value="">None</option>
                    {OFFICER_TITLES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              )}
              <small className="muted">{ROLE_INFO[u.role]}</small>
            </li>
          )
        })}</ul>
      </div>
    </>
  )
}

// One tap: everyone linked to a member with an officer title becomes Admin.
function ExcomAdmin({ users, members, onError }) {
  const [done, setDone] = useState(0)
  const officers = members.filter((m) => m.officerTitle && m.status !== 'inactive')
  const linked = officers.map((m) => ({ m, u: users.find((u) => u.memberId === m.id) }))
  const toPromote = linked.filter(({ u }) => u && ['member', 'pending'].includes(u.role))
  const notSignedIn = linked.filter(({ u }) => !u)
  if (!officers.length) return null
  const promote = async () => {
    for (const { u } of toPromote) await updateDoc(ref('users', u.id), { role: 'admin' }).catch(onError)
    setDone(toPromote.length)
  }
  return (
    <div className="card">
      <h2>ExCom access</h2>
      {done > 0 && <div className="banner ok">{done} officer{done === 1 ? '' : 's'} can now manage meetings, attendance and guests.</div>}
      {toPromote.length > 0
        ? <><p>{toPromote.map(({ m }) => `${m.name} (${m.officerTitle})`).join(', ')}</p>
            <button className="primary" onClick={promote}>Make {toPromote.length} ExCom officer{toPromote.length === 1 ? '' : 's'} Admin</button></>
        : <p className="muted" style={{ margin: 0 }}>All signed-in ExCom officers already have Admin access.</p>}
      {notSignedIn.length > 0 && <p className="muted" style={{ marginBottom: 0 }}>Not signed in yet: {notSignedIn.map(({ m }) => `${m.name} (${m.officerTitle})`).join(', ')}.</p>}
    </div>
  )
}
