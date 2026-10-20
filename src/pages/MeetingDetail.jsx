import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { addDoc, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../auth'
import {
  useDoc, useMembers, useGuests, useList, col, ref, query, where, saveMeeting, updateDoc, setDoc,
  markAttendance, unmarkAttendance, processCheckins, fmtDate, byName, newSlotKey, serverTimestamp, normEmail, today,
} from '../data'
import { ROLES, ROLE_LABEL, MEETING_AWARDS, PATHS, COMMON_PROJECTS } from '../constants'
import { downloadIcs, rolesMessage, whatsappLink } from '../notify'
import { Loading, ErrorNote, Tabs, PersonPicker, Avatar, Modal, useClub } from '../components/ui'

export default function MeetingDetail() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { isAdmin, isMember } = useAuth()
  const { data: meeting, loading, error } = useDoc('meetings', id)
  const { data: members } = useList(() => (isMember ? col('members') : null), [isMember])
  const { data: guests } = useGuests(isAdmin)
  const tab = params.get('tab') || 'agenda'

  const active = useMemo(() => members.filter((m) => m.status !== 'inactive').sort(byName), [members])
  const sortedGuests = useMemo(() => [...guests].sort(byName), [guests])

  if (loading) return <Loading />
  if (!meeting) return <><ErrorNote error={error} /><p>Meeting not found.</p></>

  const tabs = [['agenda', 'Agenda'], ['awards', 'Awards']]
  if (isAdmin) tabs.splice(1, 0, ['attendance', 'Attendance'], ['qr', 'QR check-in'])
  tabs.push(['share', 'Share'])

  return (
    <>
      <p><Link to="/meetings">← Meetings</Link></p>
      <div className="card accent">
        <small>{meeting.number ? `Meeting #${meeting.number}` : 'Meeting'}</small>
        <h1>{meeting.theme || 'Club meeting'}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {fmtDate(meeting.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {meeting.startTime ? ` · ${meeting.startTime}–${meeting.endTime || ''}` : ''}
        </p>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={(t) => setParams({ tab: t })} />
      {tab === 'agenda' && (isAdmin
        ? <AgendaEditor meeting={meeting} members={active} guests={sortedGuests} />
        : <AgendaView meeting={meeting} />)}
      {tab === 'attendance' && isAdmin && <Attendance meeting={meeting} members={active} guests={sortedGuests} />}
      {tab === 'qr' && isAdmin && <QrPanel meeting={meeting} />}
      {tab === 'awards' && <Awards meeting={meeting} members={active} guests={sortedGuests} editable={isAdmin} />}
      {tab === 'share' && <Share meeting={meeting} />}
    </>
  )
}

// ── Agenda ─────────────────────────────────────────────────
function AgendaView({ meeting }) {
  return (
    <div className="card">
      <ul className="list">
        {(meeting.slots || []).map((s) => (
          <li key={s.key} style={{ alignItems: 'flex-start' }}>
            <small style={{ width: 44, flex: 'none' }}>{s.time}</small>
            <span className="grow">
              <b>{ROLE_LABEL[s.role] || s.role}</b>{s.duration ? <small> ({s.duration} min)</small> : null}<br />
              {s.person?.name || <span className="muted">To be assigned</span>}
              {s.title && <><br /><small>“{s.title}”{s.project ? ` · ${s.project}` : ''}</small></>}
              {s.role === 'speaker' && <><br /><small>Evaluator: {s.evaluator?.name || 'To be assigned'}</small></>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AgendaEditor({ meeting, members, guests }) {
  const nav = useNavigate()
  const { isSuper } = useAuth()
  const [draft, setDraft] = useState(meeting)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  useEffect(() => { if (!dirty) setDraft(meeting) }, [meeting, dirty])

  const update = (patch) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true) }
  const setSlot = (i, patch) => update({ slots: draft.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const move = (i, dir) => {
    const slots = [...draft.slots]
    const j = i + dir
    if (j < 0 || j >= slots.length) return
    ;[slots[i], slots[j]] = [slots[j], slots[i]]
    update({ slots })
  }
  const remove = (i) => update({ slots: draft.slots.filter((_, j) => j !== i) })
  const add = (role) => update({
    slots: [...(draft.slots || []), { key: newSlotKey(role), role, time: '', person: null, ...(role === 'speaker' ? { duration: '5-7', evaluator: null } : {}) }],
  })

  const save = async () => {
    setBusy(true); setMsg(null)
    try {
      await saveMeeting(draft)
      setDirty(false)
      setMsg({ ok: true, text: 'Saved. Speech log and role history updated.' })
    } catch (e) { setMsg({ error: e }) }
    setBusy(false)
  }
  const del = async () => {
    if (!confirm('Delete this meeting, its agenda and its attendance? This cannot be undone.')) return
    setBusy(true)
    try {
      const batch = writeBatch(db)
      for (const c of ['speeches', 'roleLog', 'attendance']) {
        const snap = await getDocs(query(col(c), where('meetingId', '==', meeting.id)))
        snap.docs.filter((d) => c === 'attendance' || d.data().source === 'agenda').forEach((d) => batch.delete(d.ref))
      }
      batch.delete(ref('meetings', meeting.id))
      await batch.commit()
      nav('/meetings', { replace: true })
    } catch (e) { setMsg({ error: e }); setBusy(false) }
  }

  return (
    <>
      <div className="card">
        <h2>Details</h2>
        <div className="grid2">
          <div className="field"><label>Meeting #<input type="number" value={draft.number || ''} onChange={(e) => update({ number: e.target.value ? Number(e.target.value) : null })} /></label></div>
          <div className="field"><label>Date<input type="date" value={draft.date || ''} onChange={(e) => update({ date: e.target.value })} /></label></div>
          <div className="field"><label>Start<input type="time" value={draft.startTime || ''} onChange={(e) => update({ startTime: e.target.value })} /></label></div>
          <div className="field"><label>End<input type="time" value={draft.endTime || ''} onChange={(e) => update({ endTime: e.target.value })} /></label></div>
        </div>
        <div className="field"><label>Theme<input value={draft.theme || ''} onChange={(e) => update({ theme: e.target.value })} /></label></div>
        <div className="field"><label>Word of the Day<input value={draft.wod || ''} onChange={(e) => update({ wod: e.target.value })} /></label></div>
      </div>

      <div className="card">
        <h2>Roles and speakers</h2>
        <datalist id="paths">{PATHS.map((p) => <option key={p} value={p} />)}</datalist>
        <datalist id="projects">{COMMON_PROJECTS.map((p) => <option key={p} value={p} />)}</datalist>
        {(draft.slots || []).map((s, i) => (
          <div className="slot" key={s.key}>
            <div className="row">
              <input type="time" value={s.time || ''} onChange={(e) => setSlot(i, { time: e.target.value })} style={{ width: 135, flex: 'none' }} aria-label="Time" />
              <select value={s.role} onChange={(e) => setSlot(i, { role: e.target.value })} aria-label="Role">
                {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
            <div style={{ marginTop: '.4rem' }}>
              <PersonPicker value={s.person} onChange={(p) => setSlot(i, { person: p })} members={members} guests={guests} />
            </div>
            {s.role === 'speaker' && (
              <div className="stack" style={{ marginTop: '.4rem' }}>
                <div className="row">
                  <input placeholder="Speech title" value={s.title || ''} onChange={(e) => setSlot(i, { title: e.target.value })} />
                  <input placeholder="Time window e.g. 5-7" value={s.duration || ''} onChange={(e) => setSlot(i, { duration: e.target.value })} style={{ maxWidth: 140 }} />
                </div>
                <div className="row">
                  <input list="paths" placeholder="Pathways path" value={s.path || ''} onChange={(e) => setSlot(i, { path: e.target.value })} />
                  <select value={s.level || ''} onChange={(e) => setSlot(i, { level: e.target.value })} style={{ maxWidth: 120 }} aria-label="Level">
                    <option value="">Level</option>{[1, 2, 3, 4, 5].map((l) => <option key={l} value={`Level ${l}`}>Level {l}</option>)}
                  </select>
                </div>
                <div className="row">
                  <input list="projects" placeholder="Project" value={s.project || ''} onChange={(e) => setSlot(i, { project: e.target.value })} />
                  <input placeholder="Actual time e.g. 6:40" value={s.actualTime || ''} onChange={(e) => setSlot(i, { actualTime: e.target.value })} style={{ maxWidth: 160 }} />
                </div>
                <div><small>Evaluator</small>
                  <PersonPicker value={s.evaluator} onChange={(p) => setSlot(i, { evaluator: p })} members={members} guests={guests} allowGuests={false} />
                </div>
                <textarea placeholder="Evaluation notes" value={s.notes || ''} onChange={(e) => setSlot(i, { notes: e.target.value })} />
              </div>
            )}
            <div className="row" style={{ marginTop: '.4rem', justifyContent: 'flex-end' }}>
              <button className="small" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
              <button className="small" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
              <button className="small danger" onClick={() => remove(i)}>Remove</button>
            </div>
          </div>
        ))}
        <div className="row">
          <button className="small" onClick={() => add('speaker')}>＋ Speaker</button>
          <button className="small" onClick={() => add('ttspeaker')}>＋ Table Topics speaker</button>
          <select value="" onChange={(e) => e.target.value && add(e.target.value)} style={{ maxWidth: 200 }} aria-label="Add role">
            <option value="">＋ Other role…</option>
            {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {msg && (msg.error ? <ErrorNote error={msg.error} /> : <div className="banner ok">{msg.text}</div>)}
      <div className="row between" style={{ position: 'sticky', bottom: 70, background: 'var(--bg)', padding: '.5rem 0' }}>
        {isSuper ? <button className="danger small" onClick={del} disabled={busy}>Delete meeting</button> : <span />}
        <button className="primary" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : dirty ? 'Save agenda' : 'Saved'}</button>
      </div>
    </>
  )
}

// ── Attendance ─────────────────────────────────────────────
function Attendance({ meeting, members, guests }) {
  const { data: att } = useList(() => query(col('attendance'), where('meetingId', '==', meeting.id)), [meeting.id])
  const { data: pending } = useList(() => query(col('checkins'), where('meetingId', '==', meeting.id)), [meeting.id])
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState('')
  const processing = useRef(false)
  const present = new Set(att.map((a) => a.personId))

  // Merge guest QR check-ins as they arrive.
  useEffect(() => {
    if (!pending.length || processing.current) return
    processing.current = true
    processCheckins(meeting, [...guests]).catch(setError).finally(() => { processing.current = false })
  }, [pending.length, meeting, guests])

  const toggle = (p, type) => (present.has(p.id) ? unmarkAttendance(meeting, p, type) : markAttendance(meeting, p, type)).catch(setError)
  const markRoleHolders = async () => {
    const people = (meeting.slots || []).flatMap((s) => [s.person, s.evaluator]).filter((p) => p?.id && p.type !== 'other')
    for (const p of people) if (!present.has(p.id)) await markAttendance(meeting, p, p.type).catch(setError)
  }

  const memberCount = att.filter((a) => a.personType === 'member').length
  const guestAtt = att.filter((a) => a.personType === 'guest')
  const shown = members.filter((m) => m.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <>
      <ErrorNote error={error} />
      <div className="stats">
        <div className="stat"><b>{memberCount}/{members.length}</b><span>Members present</span></div>
        <div className="stat"><b>{guestAtt.length}</b><span>Guests</span></div>
        <div className="stat"><b>{att.filter((a) => a.method === 'qr').length}</b><span>Checked in by QR</span></div>
      </div>
      <div className="card">
        <div className="row between">
          <h2>Members</h2>
          <button className="small" onClick={markRoleHolders}>Mark all role-holders present</button>
        </div>
        <input placeholder="Search members" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ margin: '.5rem 0' }} />
        <ul className="list">
          {shown.map((m) => (
            <li key={m.id}>
              <label className="check grow" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={present.has(m.id)} onChange={() => toggle(m, 'member')} />
                <Avatar name={m.name} /> <span className="ellipsis">{m.name}</span>
              </label>
              {att.find((a) => a.personId === m.id)?.method === 'qr' && <span className="chip gray">QR</span>}
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <div className="row between">
          <h2>Guests</h2>
          <button className="small primary" onClick={() => setAdding(true)}>＋ Add guest</button>
        </div>
        {pending.length > 0 && <p className="muted">Processing {pending.length} QR check-in(s)…</p>}
        {guestAtt.length === 0 ? <p className="muted">No guests yet.</p> : (
          <ul className="list">{guestAtt.map((a) => {
            const g = guests.find((x) => x.id === a.personId) || { id: a.personId, name: a.name }
            return (
              <li key={a.id}>
                <Link className="item" to={`/guests/${g.id}`}><Avatar name={g.name} guest /><span className="grow ellipsis">{g.name}<br /><small>{g.visits || 1} visit(s){a.method === 'qr' ? ' · QR' : ''}</small></span></Link>
                <button className="small danger" onClick={() => toggle(g, 'guest')}>Remove</button>
              </li>
            )
          })}</ul>
        )}
      </div>
      {adding && <AddGuest meeting={meeting} guests={guests} present={present} onClose={() => setAdding(false)} onError={setError} />}
    </>
  )
}

function AddGuest({ meeting, guests, present, onClose, onError }) {
  const [q, setQ] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', email: '', source: '' })
  const matches = q ? guests.filter((g) => !present.has(g.id) && (g.name.toLowerCase().includes(q.toLowerCase()) || (g.phone || '').includes(q))).slice(0, 8) : []

  const addExisting = async (g) => { await markAttendance(meeting, g, 'guest').catch(onError); onClose() }
  const addNew = async (e) => {
    e.preventDefault()
    try {
      const r = await addDoc(col('guests'), {
        name: form.name.trim(), phone: form.phone.trim(), email: normEmail(form.email), source: form.source,
        status: 'New', visits: 0, firstVisit: meeting.date || today(), lastVisit: meeting.date || today(),
        notes: '', followUps: [], createdAt: serverTimestamp(),
      })
      await markAttendance(meeting, { id: r.id, name: form.name.trim() }, 'guest')
      onClose()
    } catch (err) { onError(err) }
  }
  return (
    <Modal title="Add guest" onClose={onClose}>
      <div className="field"><label>Returning guest? Search by name or phone<input value={q} onChange={(e) => setQ(e.target.value)} /></label></div>
      <ul className="list">{matches.map((g) => (
        <li key={g.id}><span className="grow">{g.name}<br /><small>{g.phone} · {g.visits || 0} visit(s)</small></span>
          <button className="small primary" onClick={() => addExisting(g)}>Add</button></li>))}</ul>
      <div className="divider">or new guest</div>
      <form onSubmit={addNew}>
        <div className="field"><label>Name *<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label></div>
        <div className="grid2">
          <div className="field"><label>Phone<input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label></div>
          <div className="field"><label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label></div>
        </div>
        <button className="full primary">Add and mark present</button>
      </form>
    </Modal>
  )
}

// ── QR check-in ────────────────────────────────────────────
function QrPanel({ meeting }) {
  const { data: codeDoc, loading } = useDoc('checkinCodes', meeting.id)
  const [img, setImg] = useState('')
  const [big, setBig] = useState(false)
  const [error, setError] = useState(null)
  const url = codeDoc?.code
    ? `${location.origin}${import.meta.env.BASE_URL}#/checkin/${meeting.id}?c=${codeDoc.code}` : ''

  useEffect(() => {
    if (url) QRCode.toDataURL(url, { width: 720, margin: 1, color: { dark: '#004165' } }).then(setImg)
  }, [url])

  const open = () => {
    const code = codeDoc?.code || Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12)
    setDoc(ref('checkinCodes', meeting.id), { meetingId: meeting.id, code, open: true, openedAt: serverTimestamp() }).catch(setError)
  }
  const close = () => updateDoc(ref('checkinCodes', meeting.id), { open: false }).catch(setError)
  const regenerate = () => setDoc(ref('checkinCodes', meeting.id), {
    meetingId: meeting.id, open: true, openedAt: serverTimestamp(),
    code: Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(36)).join('').slice(0, 12),
  }).catch(setError)

  if (loading) return <Loading />
  return (
    <div className="card stack">
      <ErrorNote error={error} />
      {!codeDoc?.open ? (
        <>
          <p>Open check-in to show a QR code. Members and guests scan it with their phone camera to mark themselves present.</p>
          <button className="primary" onClick={open}>Open check-in</button>
        </>
      ) : (
        <>
          <div className="qr">
            {img && <img src={img} alt="Check-in QR code" onClick={() => setBig(true)} />}
            <p className="muted">Tap the code to show it full screen.</p>
          </div>
          <div className="row">
            <button onClick={() => navigator.clipboard?.writeText(url)}>Copy link</button>
            <a className="btn" href={whatsappLink(`Check in to today's meeting: ${url}`)} target="_blank" rel="noreferrer">Share on WhatsApp</a>
            <button onClick={regenerate}>New code</button>
            <button className="maroon" onClick={close}>Close check-in</button>
          </div>
        </>
      )}
      {big && img && (
        <div className="modal-back" onClick={() => setBig(false)} style={{ background: '#fff' }}>
          <div className="qr"><img src={img} alt="Check-in QR code" style={{ width: 'min(92vw, 92vh)' }} /><h2 style={{ color: '#004165' }}>Scan to check in</h2></div>
        </div>
      )}
    </div>
  )
}

// ── Meeting awards ─────────────────────────────────────────
function Awards({ meeting, members, guests, editable }) {
  const [awards, setAwards] = useState(meeting.awards || {})
  const [saved, setSaved] = useState(true)
  const [error, setError] = useState(null)
  useEffect(() => { if (saved) setAwards(meeting.awards || {}) }, [meeting.awards, saved])
  const save = () => updateDoc(ref('meetings', meeting.id), { awards }).then(() => setSaved(true)).catch(setError)

  return (
    <div className="card">
      <ErrorNote error={error} />
      <ul className="list">
        {MEETING_AWARDS.map((a) => (
          <li key={a.key} style={{ display: 'block' }}>
            <b>🏆 {a.label}</b>
            {editable
              ? <div style={{ marginTop: '.3rem' }}><PersonPicker value={awards[a.key] || null} placeholder="Not decided"
                  onChange={(p) => { setAwards({ ...awards, [a.key]: p }); setSaved(false) }} members={members} guests={guests} /></div>
              : <div>{awards[a.key]?.name || <span className="muted">Not decided</span>}</div>}
          </li>
        ))}
      </ul>
      {editable && <button className="primary full" disabled={saved} onClick={save}>{saved ? 'Saved' : 'Save awards'}</button>}
    </div>
  )
}

// ── Share ──────────────────────────────────────────────────
function Share({ meeting }) {
  const club = useClub()
  const text = rolesMessage(meeting, club)
  return (
    <div className="card stack">
      <h2>Share the agenda</h2>
      <textarea readOnly value={text} rows={10} />
      <div className="row">
        <a className="btn primary" href={whatsappLink(text)} target="_blank" rel="noreferrer">Send on WhatsApp</a>
        <button onClick={() => navigator.clipboard?.writeText(text)}>Copy</button>
        <button onClick={() => downloadIcs(meeting, club)}>Add to calendar</button>
      </div>
    </div>
  )
}
