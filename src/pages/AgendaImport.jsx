import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { addDoc } from 'firebase/firestore'
import { parseAgenda } from '../ai'
import {
  useMembers, useMeetings, col, saveMeeting, matchPerson, cleanName, newSlotKey, byName, serverTimestamp, today,
} from '../data'
import { ROLE_LABEL } from '../constants'
import { ErrorNote, PersonPicker, useClub } from '../components/ui'

// Upload an agenda PDF or photo → Gemini reads it → review → save as a meeting.
export default function AgendaImport() {
  const nav = useNavigate()
  const club = useClub()
  const { data: rawMembers } = useMembers()
  const { data: meetings } = useMeetings()
  const [members, setMembers] = useState(null)
  const allMembers = useMemo(() => (members || rawMembers).slice().sort(byName), [members, rawMembers])
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState(null)

  const read = async () => {
    setBusy(true); setError(null)
    try {
      const r = await parseAgenda(file)
      const toPerson = (name) => {
        const n = cleanName(name)
        if (!n) return null
        const m = matchPerson(n, rawMembers)
        return m ? { type: 'member', id: m.id, name: m.name } : { type: 'other', id: '', name: n, unmatched: true }
      }
      const existing = meetings.find((m) => (r.number && m.number === r.number) || (r.date && m.date === r.date))
      setDraft({
        existingId: existing?.id || '',
        number: r.number || null, theme: r.theme || '', date: r.date || today(),
        startTime: r.startTime || club.startTime, endTime: r.endTime || club.endTime, venue: r.venue || club.venue,
        officers: r.officers || [],
        slots: (r.slots || []).map((s) => ({
          key: newSlotKey(s.role), role: s.role, time: s.time || '', person: toPerson(s.person),
          ...(s.role === 'speaker' ? {
            duration: s.duration || '', title: s.title || '', project: s.project || '', path: s.path || '',
            level: s.level || '', evaluator: toPerson(s.evaluator),
          } : {}),
        })),
      })
    } catch (e) {
      setError(e.message?.includes('API') || e.code
        ? { message: `Could not read the agenda: ${e.message}. Check that Firebase AI Logic is enabled (docs/SETUP.md).` } : e)
    }
    setBusy(false)
  }

  const setSlot = (i, patch) => setDraft((d) => ({ ...d, slots: d.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))

  // Create a member record for a name that is not on the roster yet.
  const addMember = async (name) => {
    const officer = draft.officers.find((o) => cleanName(o.name).toLowerCase() === name.toLowerCase())
    const r = await addDoc(col('members'), {
      name, email: '', phone: '', status: 'active', joinDate: '', officerTitle: officer?.title || '',
      pathways: [], createdAt: serverTimestamp(),
    })
    const person = { type: 'member', id: r.id, name }
    setMembers([...(members || rawMembers), { id: r.id, name }])
    setDraft((d) => ({
      ...d,
      slots: d.slots.map((s) => ({
        ...s,
        person: s.person?.unmatched && s.person.name === name ? person : s.person,
        evaluator: s.evaluator?.unmatched && s.evaluator.name === name ? person : s.evaluator,
      })),
    }))
  }

  const save = async () => {
    setBusy(true); setError(null)
    try {
      const strip = (p) => (p ? { type: p.type, id: p.id || '', name: p.name } : null)
      const { existingId, officers, ...m } = draft
      const id = await saveMeeting({
        ...(existingId ? { id: existingId } : { awards: {}, createdAt: new Date().toISOString() }),
        ...m,
        slots: m.slots.map((s) => ({ ...s, person: strip(s.person), ...(s.role === 'speaker' ? { evaluator: strip(s.evaluator) } : {}) })),
        importedAt: new Date().toISOString(),
      })
      nav(`/meetings/${id}`, { replace: true })
    } catch (e) { setError(e); setBusy(false) }
  }

  const unmatched = draft ? [...new Set(draft.slots.flatMap((s) => [s.person, s.evaluator]).filter((p) => p?.unmatched).map((p) => p.name))] : []

  return (
    <>
      <p><Link to="/meetings">← Meetings</Link></p>
      <h1>Import agenda</h1>
      <ErrorNote error={error} />
      {!draft && (
        <div className="card stack">
          <p>Upload the meeting agenda as a PDF or a photo. The app reads the theme, date and every role, then lets you check it before saving.</p>
          <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files[0])} />
          <label className="btn" style={{ color: 'var(--text)' }}>
            📷 Take a photo
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => setFile(e.target.files[0])} />
          </label>
          {file && <p className="muted">Selected: {file.name}</p>}
          <button className="primary" disabled={!file || busy} onClick={read}>{busy ? 'Reading agenda…' : 'Read agenda'}</button>
        </div>
      )}
      {draft && (
        <>
          <div className="card">
            <h2>Check the details</h2>
            {draft.existingId && <div className="banner info">This updates the existing meeting {draft.number ? `#${draft.number}` : ''} on {draft.date}.</div>}
            <div className="grid2">
              <div className="field"><label>Meeting #<input type="number" value={draft.number || ''} onChange={(e) => setDraft({ ...draft, number: Number(e.target.value) || null })} /></label></div>
              <div className="field"><label>Date<input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label></div>
            </div>
            <div className="field"><label>Theme<input value={draft.theme} onChange={(e) => setDraft({ ...draft, theme: e.target.value })} /></label></div>
          </div>
          {unmatched.length > 0 && (
            <div className="card">
              <h2>Names not on the roster</h2>
              <p className="muted">Add them as members, or pick the right person in the list below. Leave visitors as they are.</p>
              <ul className="list">{unmatched.map((n) => (
                <li key={n}><span className="grow">{n}</span><button className="small" onClick={() => addMember(n).catch(setError)}>Add as member</button></li>
              ))}</ul>
            </div>
          )}
          <div className="card">
            <h2>Roles ({draft.slots.length})</h2>
            {draft.slots.map((s, i) => (
              <div className="slot" key={s.key}>
                <div className="row between"><b>{ROLE_LABEL[s.role]}</b><small>{s.time}{s.duration ? ` · ${s.duration} min` : ''}</small></div>
                <PersonPicker value={s.person} onChange={(p) => setSlot(i, { person: p })} members={allMembers} />
                {s.role === 'speaker' && (
                  <div style={{ marginTop: '.4rem' }}>
                    <small>Evaluator</small>
                    <PersonPicker value={s.evaluator} onChange={(p) => setSlot(i, { evaluator: p })} members={allMembers} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="row between">
            <button onClick={() => setDraft(null)}>Start over</button>
            <button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : draft.existingId ? 'Update meeting' : 'Create meeting'}</button>
          </div>
        </>
      )}
    </>
  )
}
