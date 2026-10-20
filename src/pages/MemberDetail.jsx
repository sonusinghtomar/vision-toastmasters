import { useMemo, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { addDoc } from 'firebase/firestore'
import { useAuth } from '../auth'
import {
  useDoc, useList, useMeetings, col, ref, query, where, updateDoc, deleteDoc, fmtDate, today,
  programYear, programYearRange, byDateDesc, serverTimestamp,
} from '../data'
import { PATHS, COMMON_PROJECTS, ROLES, ROLE_LABEL, AWARD_LABEL, EDU_LEVELS } from '../constants'
import { Loading, ErrorNote, Tabs, Modal, Progress, Avatar } from '../components/ui'
import { MemberForm } from './Members'

export default function MemberDetail() {
  const { id } = useParams()
  const { isAdmin, memberId } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'pathways'
  const { data: m, loading, error } = useDoc('members', id)
  const [editing, setEditing] = useState(false)
  const isSelf = id === memberId
  const canEdit = isAdmin || isSelf

  if (loading) return <Loading />
  if (!m) return <><ErrorNote error={error} /><p>Member not found.</p></>

  return (
    <>
      <p><Link to="/members">← Members</Link></p>
      <div className="card">
        <div className="row">
          <Avatar name={m.name} />
          <div className="grow">
            <h1 style={{ margin: 0 }}>{m.name}</h1>
            <small>{[m.officerTitle, m.joinDate && `Member since ${fmtDate(m.joinDate)}`].filter(Boolean).join(' · ')}</small>
          </div>
          {isAdmin && <button className="small" onClick={() => setEditing(true)}>Edit</button>}
        </div>
        {(isAdmin || isSelf) && (m.email || m.phone) && <p className="muted" style={{ margin: '.5rem 0 0' }}>{m.email} {m.phone && `· ${m.phone}`}</p>}
        {isSelf && <SelfContact m={m} />}
      </div>
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })}
        tabs={[['pathways', 'Pathways'], ['speeches', 'Speeches'], ['roles', 'Roles'], ['attendance', 'Attendance'], ['awards', 'Awards']]} />
      {tab === 'pathways' && <Pathways m={m} canEdit={canEdit} />}
      {tab === 'speeches' && <Speeches m={m} canEdit={canEdit} />}
      {tab === 'roles' && <Roles m={m} canEdit={canEdit} />}
      {tab === 'attendance' && <MemberAttendance m={m} />}
      {tab === 'awards' && <MemberAwards m={m} />}
      {editing && <MemberForm initial={m} onClose={() => setEditing(false)}
        onSave={({ name, email, phone, joinDate, officerTitle, status }) =>
          updateDoc(ref('members', m.id), { name, email, phone, joinDate, officerTitle, status })} />}
    </>
  )
}

function SelfContact({ m }) {
  const [phone, setPhone] = useState(m.phone || '')
  const [saved, setSaved] = useState(true)
  return (
    <div className="row" style={{ marginTop: '.6rem' }}>
      <input type="tel" placeholder="My phone" value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false) }} className="grow" />
      <button className="small" disabled={saved}
        onClick={() => updateDoc(ref('members', m.id), { phone, updatedAt: serverTimestamp() }).then(() => setSaved(true))}>Save</button>
    </div>
  )
}

// ── Pathways ───────────────────────────────────────────────
function Pathways({ m, canEdit }) {
  const { isAdmin } = useAuth()
  const { data: speeches } = useList(() => query(col('speeches'), where('memberId', '==', m.id)), [m.id])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const paths = m.pathways || []

  const savePaths = (next) => updateDoc(ref('members', m.id), { pathways: next, updatedAt: serverTimestamp() }).catch(setError)
  const completeLevel = async (i) => {
    const p = paths[i]
    const level = p.level || 1
    const date = today()
    const next = paths.map((x, j) => (j === i ? {
      ...x, levels: { ...(x.levels || {}), [level]: date },
      level: level < 5 ? level + 1 : 5, completed: level >= 5 ? date : x.completed || '',
    } : x))
    await savePaths(next)
    // Education awards feed the DCP page.
    await addDoc(col('eduAwards'), { memberId: m.id, memberName: m.name, path: p.path, award: `Level ${level}`, date })
    if (level >= 5) await addDoc(col('eduAwards'), { memberId: m.id, memberName: m.name, path: p.path, award: 'Path Completed', date })
  }

  return (
    <>
      <ErrorNote error={error} />
      {paths.length === 0 && <div className="card muted">No Pathways path recorded yet.</div>}
      {paths.map((p, i) => {
        const done = Object.keys(p.levels || {}).length
        const pathSpeeches = speeches.filter((s) => !s.path || s.path === p.path).sort(byDateDesc)
        return (
          <div className="card" key={p.path + i}>
            <div className="row between">
              <h2 style={{ margin: 0 }}>{p.path}</h2>
              {p.completed ? <span className="chip green">Completed</span> : <span className="chip">Level {p.level || 1}</span>}
            </div>
            <div style={{ margin: '.6rem 0' }}><Progress value={done} max={5} /></div>
            <div className="row" style={{ gap: '.3rem' }}>
              {[1, 2, 3, 4, 5].map((l) => (
                <span key={l} className={`chip ${p.levels?.[l] ? 'green' : 'gray'}`} title={p.levels?.[l] ? `Completed ${fmtDate(p.levels[l])}` : ''}>
                  L{l}{p.levels?.[l] ? ' ✓' : ''}
                </span>
              ))}
            </div>
            {pathSpeeches.length > 0 && (
              <details style={{ marginTop: '.6rem' }}>
                <summary>{pathSpeeches.length} speech(es) logged</summary>
                <ul className="list">{pathSpeeches.map((s) => (
                  <li key={s.id}><span className="grow"><b>{s.project || s.title || 'Speech'}</b><br />
                    <small>{fmtDate(s.date)} {s.level && `· ${s.level}`} {s.title && `· “${s.title}”`}</small></span></li>))}</ul>
              </details>
            )}
            {canEdit && !p.completed && (
              <div className="row" style={{ marginTop: '.6rem' }}>
                <select value={p.level || 1} style={{ width: 170 }} aria-label="Current level"
                  onChange={(e) => savePaths(paths.map((x, j) => (j === i ? { ...x, level: Number(e.target.value) } : x)))}>
                  {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>Working on L{l}</option>)}
                </select>
                {isAdmin && <button className="small primary" onClick={() => completeLevel(i).catch(setError)}>Mark Level {p.level || 1} complete</button>}
                <button className="small danger" onClick={() => confirm(`Remove ${p.path}?`) && savePaths(paths.filter((_, j) => j !== i))}>Remove</button>
              </div>
            )}
          </div>
        )
      })}
      {canEdit && <button className="primary" onClick={() => setAdding(true)}>＋ Add path</button>}
      {!isAdmin && canEdit && <p className="muted" style={{ marginTop: '.6rem' }}>Completed a level? Tell the VP Education, who confirms it in Base Camp and here.</p>}
      {adding && (
        <Modal title="Add a Pathways path" onClose={() => setAdding(false)}>
          <form onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.target)
            savePaths([...paths, { path: f.get('path'), level: Number(f.get('level')), started: today(), levels: {} }])
            setAdding(false)
          }}>
            <div className="field"><label>Path<input name="path" list="pathlist" required /></label></div>
            <datalist id="pathlist">{PATHS.map((p) => <option key={p} value={p} />)}</datalist>
            <div className="field"><label>Currently on
              <select name="level">{[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>Level {l}</option>)}</select></label></div>
            <button className="full primary">Add</button>
          </form>
        </Modal>
      )}
    </>
  )
}

// ── Speeches ───────────────────────────────────────────────
function Speeches({ m, canEdit }) {
  const { data, error } = useList(() => query(col('speeches'), where('memberId', '==', m.id)), [m.id])
  const [editing, setEditing] = useState(null)
  const list = [...data].sort(byDateDesc)
  return (
    <>
      <ErrorNote error={error} />
      {canEdit && <button className="primary" style={{ marginBottom: '1rem' }} onClick={() => setEditing({})}>＋ Log a speech</button>}
      <div className="card">
        {list.length === 0 ? <p className="muted">No speeches logged yet.</p> : (
          <ul className="list">{list.map((s) => (
            <li key={s.id} style={{ alignItems: 'flex-start' }}>
              <span className="grow">
                <b>{s.title || s.project || 'Speech'}</b>
                <br /><small>{fmtDate(s.date)}{s.meetingNo ? ` · Meeting #${s.meetingNo}` : s.venue ? ` · ${s.venue}` : ''}</small>
                <br /><small>{[s.path, s.level, s.project].filter(Boolean).join(' · ')}</small>
                {(s.actualTime || s.timing) && <><br /><small>Time: {s.actualTime || '–'}{s.timing ? ` (target ${s.timing})` : ''}</small></>}
                {s.evaluatorName && <><br /><small>Evaluator: {s.evaluatorName}</small></>}
                {s.notes && <p className="muted" style={{ whiteSpace: 'pre-wrap', margin: '.3rem 0 0' }}>{s.notes}</p>}
              </span>
              {canEdit && <button className="small" onClick={() => setEditing(s)}>Edit</button>}
            </li>))}</ul>
        )}
      </div>
      {editing && <SpeechForm m={m} speech={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function SpeechForm({ m, speech, onClose }) {
  const [f, setF] = useState({
    date: today(), title: '', path: (m.pathways || []).find((p) => !p.completed)?.path || '', level: '', project: '',
    timing: '5-7', actualTime: '', evaluatorName: '', notes: '', venue: '', ...speech,
  })
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const fromAgenda = speech.source === 'agenda'
  const submit = async (e) => {
    e.preventDefault()
    const { id, ...data } = f
    try {
      if (id) await updateDoc(ref('speeches', id), { ...data, updatedAt: serverTimestamp() })
      else await addDoc(col('speeches'), { ...data, memberId: m.id, name: m.name, source: 'manual', createdAt: serverTimestamp() })
      onClose()
    } catch (err) { setError(err) }
  }
  return (
    <Modal title={speech.id ? 'Edit speech' : 'Log a speech'} onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorNote error={error} />
        {fromAgenda && <div className="banner info">This speech comes from a meeting agenda. Officers editing that agenda may overwrite title and timing.</div>}
        <div className="grid2">
          <div className="field"><label>Date<input type="date" required value={f.date} onChange={set('date')} disabled={fromAgenda} /></label></div>
          {!fromAgenda && <div className="field"><label>Club / event<input placeholder="Vision TM" value={f.venue} onChange={set('venue')} /></label></div>}
        </div>
        <div className="field"><label>Title<input value={f.title} onChange={set('title')} /></label></div>
        <div className="grid2">
          <div className="field"><label>Path<input list="pl" value={f.path} onChange={set('path')} /></label></div>
          <div className="field"><label>Level
            <select value={f.level} onChange={set('level')}><option value="">–</option>{[1, 2, 3, 4, 5].map((l) => <option key={l}>{`Level ${l}`}</option>)}</select></label></div>
        </div>
        <datalist id="pl">{PATHS.map((p) => <option key={p} value={p} />)}</datalist>
        <datalist id="pj">{COMMON_PROJECTS.map((p) => <option key={p} value={p} />)}</datalist>
        <div className="field"><label>Project<input list="pj" value={f.project} onChange={set('project')} /></label></div>
        <div className="grid2">
          <div className="field"><label>Target time<input placeholder="5-7" value={f.timing} onChange={set('timing')} /></label></div>
          <div className="field"><label>Actual time<input placeholder="6:30" value={f.actualTime} onChange={set('actualTime')} /></label></div>
        </div>
        <div className="field"><label>Evaluator<input value={f.evaluatorName} onChange={set('evaluatorName')} /></label></div>
        <div className="field"><label>Evaluation notes<textarea value={f.notes} onChange={set('notes')} /></label></div>
        <div className="row between">
          {speech.id && !fromAgenda
            ? <button type="button" className="danger" onClick={() => confirm('Delete this speech?') && deleteDoc(ref('speeches', speech.id)).then(onClose).catch(setError)}>Delete</button>
            : <span />}
          <button className="primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Roles ──────────────────────────────────────────────────
function Roles({ m, canEdit }) {
  const { data, error } = useList(() => query(col('roleLog'), where('personId', '==', m.id)), [m.id])
  const [adding, setAdding] = useState(false)
  const counts = useMemo(() => data.reduce((c, r) => ({ ...c, [r.role]: (c[r.role] || 0) + 1 }), {}), [data])
  const list = [...data].sort(byDateDesc)
  return (
    <>
      <ErrorNote error={error} />
      <div className="card">
        <h2>Role summary</h2>
        <div className="row" style={{ gap: '.4rem' }}>
          {ROLES.filter((r) => counts[r.key]).map((r) => <span key={r.key} className="chip">{r.label} × {counts[r.key]}</span>)}
          {data.length === 0 && <span className="muted">No roles yet.</span>}
        </div>
        {data.length > 0 && (
          <p className="muted" style={{ marginTop: '.6rem' }}>
            Not yet tried: {ROLES.filter((r) => !counts[r.key] && !['ttspeaker', 'saa', 'po'].includes(r.key)).map((r) => r.label).join(', ') || 'none. Well done!'}
          </p>
        )}
      </div>
      {canEdit && <button className="primary" style={{ marginBottom: '1rem' }} onClick={() => setAdding(true)}>＋ Log a role</button>}
      <div className="card">
        <ul className="list">{list.map((r) => (
          <li key={r.id}>
            <span className="grow"><b>{r.roleLabel || ROLE_LABEL[r.role]}</b>{r.evaluates && <small> for {r.evaluates}</small>}<br />
              <small>{fmtDate(r.date)}{r.meetingNo ? ` · Meeting #${r.meetingNo}` : r.venue ? ` · ${r.venue}` : ''}</small></span>
            {canEdit && r.source === 'manual' && <button className="small danger" onClick={() => deleteDoc(ref('roleLog', r.id))}>✕</button>}
          </li>))}</ul>
      </div>
      {adding && (
        <Modal title="Log a role" onClose={() => setAdding(false)}>
          <form onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.target)
            const role = f.get('role')
            addDoc(col('roleLog'), {
              role, roleLabel: ROLE_LABEL[role], date: f.get('date'), venue: f.get('venue'),
              personType: 'member', personId: m.id, name: m.name, source: 'manual', meetingId: '',
            }).then(() => setAdding(false))
          }}>
            <div className="field"><label>Role<select name="role">{ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></label></div>
            <div className="grid2">
              <div className="field"><label>Date<input type="date" name="date" defaultValue={today()} required /></label></div>
              <div className="field"><label>Club / event<input name="venue" placeholder="e.g. another club" /></label></div>
            </div>
            <button className="full primary">Save</button>
          </form>
        </Modal>
      )}
    </>
  )
}

// ── Attendance ─────────────────────────────────────────────
function MemberAttendance({ m }) {
  const { data: att } = useList(() => query(col('attendance'), where('personId', '==', m.id)), [m.id])
  const { data: meetings } = useMeetings()
  const py = programYear()
  const [from, to] = programYearRange(py)
  const t = today()
  const since = m.joinDate && m.joinDate > from ? m.joinDate : from
  const held = meetings.filter((x) => x.date >= since && x.date <= to && x.date <= t)
  const attended = new Set(att.map((a) => a.meetingId))
  const count = held.filter((x) => attended.has(x.id)).length
  return (
    <>
      <div className="stats">
        <div className="stat"><b>{held.length ? Math.round((count / held.length) * 100) : 0}%</b><span>Attendance {py}</span></div>
        <div className="stat"><b>{count}/{held.length}</b><span>Meetings this year</span></div>
        <div className="stat"><b>{att.length}</b><span>All-time</span></div>
      </div>
      <div className="card">
        <ul className="list">{meetings.filter((x) => x.date <= t && (!m.joinDate || x.date >= m.joinDate)).slice(0, 30).map((x) => (
          <li key={x.id}>
            <span className="grow">{fmtDate(x.date)}{x.number ? ` · #${x.number}` : ''}</span>
            {attended.has(x.id) ? <span className="chip green">Present</span> : <span className="chip gray">Absent</span>}
          </li>))}</ul>
      </div>
    </>
  )
}

// ── Awards ─────────────────────────────────────────────────
function MemberAwards({ m }) {
  const { isAdmin } = useAuth()
  const { data: edu } = useList(() => query(col('eduAwards'), where('memberId', '==', m.id)), [m.id])
  const { data: meetings } = useMeetings()
  const [adding, setAdding] = useState(false)
  const won = meetings.flatMap((x) => Object.entries(x.awards || {})
    .filter(([, p]) => p?.id === m.id).map(([k]) => ({ key: x.id + k, label: AWARD_LABEL[k] || k, date: x.date, no: x.number })))
  return (
    <>
      <div className="card">
        <div className="row between"><h2>Education awards</h2>{isAdmin && <button className="small" onClick={() => setAdding(true)}>＋ Add</button>}</div>
        {edu.length === 0 ? <p className="muted">None recorded yet.</p> : (
          <ul className="list">{[...edu].sort(byDateDesc).map((a) => (
            <li key={a.id}><span className="grow"><b>{a.award}</b> {a.path && <small>· {a.path}</small>}<br /><small>{fmtDate(a.date)}</small></span>
              {isAdmin && <button className="small danger" onClick={() => confirm('Remove this award?') && deleteDoc(ref('eduAwards', a.id))}>✕</button>}</li>))}</ul>
        )}
      </div>
      <div className="card">
        <h2>Meeting awards ({won.length})</h2>
        {won.length === 0 ? <p className="muted">No meeting awards yet.</p> : (
          <ul className="list">{won.sort(byDateDesc).map((w) => (
            <li key={w.key}>🏆 <span className="grow">{w.label}<br /><small>{fmtDate(w.date)}{w.no ? ` · #${w.no}` : ''}</small></span></li>))}</ul>
        )}
      </div>
      {adding && (
        <Modal title="Add education award" onClose={() => setAdding(false)}>
          <form onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.target)
            addDoc(col('eduAwards'), { memberId: m.id, memberName: m.name, award: f.get('award'), path: f.get('path'), date: f.get('date') })
              .then(() => setAdding(false))
          }}>
            <div className="field"><label>Award<select name="award">{EDU_LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label></div>
            <div className="field"><label>Path<input name="path" list="pl2" /></label></div>
            <datalist id="pl2">{PATHS.map((p) => <option key={p} value={p} />)}</datalist>
            <div className="field"><label>Date<input type="date" name="date" defaultValue={today()} required /></label></div>
            <button className="full primary">Save</button>
          </form>
        </Modal>
      )}
    </>
  )
}
