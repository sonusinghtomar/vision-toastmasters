import { useEffect, useMemo, useRef, useState } from 'react'
import { addDoc } from 'firebase/firestore'
import { useAuth } from '../auth'
import { parseNote } from '../ai'
import {
  useMembers, useGuests, useMeetings, col, saveMeeting, markAttendance, matchPerson, cleanName,
  newSlotKey, today, fmtDate, byName, serverTimestamp, normEmail,
} from '../data'
import { ROLE_LABEL, AWARD_LABEL } from '../constants'
import { ErrorNote, PersonPicker } from '../components/ui'

const MAX_SECONDS = 180

// Gemini does not accept every browser's recording format, so convert to 16 kHz mono WAV.
async function toWav(blob) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
  ctx.close()
  const rate = 16000
  const off = new OfflineAudioContext(1, Math.ceil(buf.duration * rate), rate)
  const src = off.createBufferSource()
  src.buffer = buf
  src.connect(off.destination)
  src.start()
  const pcm = (await off.startRendering()).getChannelData(0)
  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2))
  const str = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  str(36, 'data'); view.setUint32(40, pcm.length * 2, true)
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true)
  return new Blob([view], { type: 'audio/wav' })
}

export default function VoiceLog() {
  const { isAdmin, memberId, profile } = useAuth()
  const { data: rawMembers } = useMembers()
  const { data: rawGuests } = useGuests(isAdmin)
  const { data: meetings } = useMeetings()
  const members = useMemo(() => [...rawMembers].sort(byName), [rawMembers])
  const guests = useMemo(() => [...rawGuests].sort(byName), [rawGuests])
  const me = members.find((m) => m.id === memberId)

  // Default to today's meeting, else the most recent one.
  const [meetingId, setMeetingId] = useState('')
  useEffect(() => {
    if (meetingId || !meetings.length) return
    setMeetingId((meetings.find((m) => m.date <= today()) || meetings[meetings.length - 1]).id)
  }, [meetings, meetingId])
  const meeting = meetings.find((m) => m.id === meetingId)

  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [audio, setAudio] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [done, setDone] = useState(null)
  const rec = useRef(null)
  const timer = useRef(null)

  const start = async () => {
    setError(null); setAudio(null); setResult(null); setDone(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks = []
      const r = new MediaRecorder(stream)
      r.ondataavailable = (e) => chunks.push(e.data)
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setAudio(new Blob(chunks, { type: r.mimeType }))
      }
      r.start()
      rec.current = r
      setRecording(true); setSeconds(0)
      timer.current = setInterval(() => setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stop()
        return s + 1
      }), 1000)
    } catch (e) { setError({ message: 'Microphone not available: ' + e.message }) }
  }
  const stop = () => {
    clearInterval(timer.current)
    if (rec.current?.state === 'recording') rec.current.stop()
    setRecording(false)
  }
  useEffect(() => () => clearInterval(timer.current), [])

  const analyse = async () => {
    setBusy(true); setError(null); setDone(null)
    try {
      const wav = audio ? await toWav(audio) : null
      const r = await parseNote({
        audio: wav, text,
        context: {
          members: members.map((m) => m.name), guests: guests.map((g) => g.name),
          meeting, self: isAdmin ? '' : me?.name || profile?.name,
        },
      })
      const resolve = (name, type) => {
        const n = cleanName(name)
        if (!n) return null
        const pool = type === 'guest' ? guests : members
        const m = matchPerson(n, pool) || matchPerson(n, type === 'guest' ? members : guests)
        if (m) return { type: members.includes(m) ? 'member' : 'guest', id: m.id, name: m.name }
        return { type: 'other', id: '', name: n }
      }
      setResult({
        transcript: r.transcript,
        actions: (r.actions || []).map((a, i) => ({
          ...a, i, apply: true,
          who: a.type === 'guest' ? null : resolve(a.person, a.personType),
          evalBy: a.evaluator ? resolve(a.evaluator, 'member') : null,
        })),
      })
    } catch (e) { setError(e) }
    setBusy(false)
  }

  // Members (non-officers) may only log speeches and roles for themselves.
  const allowed = (a) => isAdmin || (['speech', 'role'].includes(a.type) && a.who?.id === memberId)
  const setAction = (i, patch) => setResult((r) => ({ ...r, actions: r.actions.map((a) => (a.i === i ? { ...a, ...patch } : a)) }))

  const apply = async () => {
    setBusy(true); setError(null)
    const log = []
    try {
      const todo = result.actions.filter((a) => a.apply && allowed(a))
      let draft = meeting ? { ...meeting, slots: [...(meeting.slots || [])], awards: { ...(meeting.awards || {}) } } : null
      let changed = false
      const guestList = [...guests]

      for (const a of todo) {
        const p = a.who
        if (a.type === 'guest') {
          const name = cleanName(a.person)
          let g = matchPerson(name, guestList)
          if (!g) {
            const r = await addDoc(col('guests'), {
              name, phone: a.phone || '', email: normEmail(a.email), source: a.source || '', notes: a.text || '',
              status: 'New', visits: 0, firstVisit: meeting?.date || today(), lastVisit: meeting?.date || today(),
              followUps: [], createdAt: serverTimestamp(),
            })
            g = { id: r.id, name }
            guestList.push(g)
            log.push(`Added guest ${name}`)
          }
          if (meeting) { await markAttendance(meeting, g, 'guest', 'voice'); log.push(`${name} marked present`) }
          continue
        }
        if (!p) continue
        if (a.type === 'attendance' && meeting && p.id) {
          await markAttendance(meeting, p, p.type, 'voice'); log.push(`${p.name} marked present`)
        } else if (a.type === 'award' && draft && a.award) {
          draft.awards[a.award] = { type: p.type, id: p.id, name: p.name }; changed = true
          log.push(`${AWARD_LABEL[a.award]}: ${p.name}`)
        } else if ((a.type === 'speech' || a.type === 'evaluation') && draft && isAdmin) {
          let idx = draft.slots.findIndex((s) => s.role === 'speaker' && s.person?.name === p.name)
          if (idx < 0) {
            if (a.type === 'evaluation') { log.push(`No speech found for ${p.name}; evaluation skipped`); continue }
            idx = draft.slots.findIndex((s) => s.role === 'speaker' && !s.person)
            if (idx < 0) { draft.slots.push({ key: newSlotKey('speaker'), role: 'speaker', time: '' }); idx = draft.slots.length - 1 }
          }
          const s = draft.slots[idx]
          draft.slots[idx] = {
            ...s, person: s.person || p,
            ...(a.title && { title: a.title }), ...(a.project && { project: a.project }), ...(a.path && { path: a.path }),
            ...(a.level && { level: a.level }), ...(a.actualTime && { actualTime: a.actualTime }),
            ...(a.evalBy && { evaluator: a.evalBy }),
            ...(a.text && { notes: [s.notes, a.text].filter(Boolean).join('\n') }),
          }
          changed = true
          log.push(a.type === 'speech' ? `Speech by ${p.name} updated` : `Evaluation notes for ${p.name} saved`)
        } else if (a.type === 'speech') {
          await addDoc(col('speeches'), {
            memberId: p.id, name: p.name, date: meeting?.date || today(), meetingId: meeting?.id || '', meetingNo: meeting?.number || null,
            title: a.title || '', path: a.path || '', level: a.level || '', project: a.project || '', actualTime: a.actualTime || '',
            evaluatorName: a.evalBy?.name || '', notes: a.text || '', source: 'manual', createdAt: serverTimestamp(),
          })
          log.push(`Speech logged for ${p.name}`)
        } else if (a.type === 'role' && a.role && draft && isAdmin) {
          const idx = draft.slots.findIndex((s) => s.role === a.role && (!s.person || s.person.name === p.name))
          if (idx >= 0) draft.slots[idx] = { ...draft.slots[idx], person: p }
          else draft.slots.push({ key: newSlotKey(a.role), role: a.role, time: '', person: p })
          changed = true
          log.push(`${ROLE_LABEL[a.role]}: ${p.name}`)
        } else if (a.type === 'role' && a.role) {
          await addDoc(col('roleLog'), {
            role: a.role, roleLabel: ROLE_LABEL[a.role], date: meeting?.date || today(), meetingId: '', meetingNo: meeting?.number || null,
            personType: 'member', personId: p.id, name: p.name, source: 'manual',
          })
          log.push(`Role logged: ${ROLE_LABEL[a.role]}`)
        } else if (a.type === 'note' && draft && isAdmin) {
          draft.notes = [draft.notes, a.text].filter(Boolean).join('\n'); changed = true
          log.push('Note added to meeting')
        }
      }
      if (changed) await saveMeeting(draft)
      setDone(log); setResult(null); setAudio(null); setText('')
    } catch (e) { setError(e) }
    setBusy(false)
  }

  return (
    <>
      <h1>Voice log</h1>
      <p className="muted">
        {isAdmin
          ? 'Speak naturally: "Present today: Deepika, Sultana and Swetha. Guest Ravi Kumar, phone 98xxxxxx, found us on Meetup. Suhair spoke on Ice Breaker for 6 minutes 40, evaluated by Prasad. Best speaker Pavani."'
          : 'Log your own speech or role: "I gave my Level 2 speech, Understanding Your Communication Style, 6 minutes, evaluated by Prasad."'}
      </p>
      <ErrorNote error={error} />
      {done && <div className="banner ok">Saved:<ul>{done.map((l, i) => <li key={i}>{l}</li>)}</ul></div>}

      <div className="card">
        <div className="field"><label>Meeting
          <select value={meetingId} onChange={(e) => setMeetingId(e.target.value)}>
            <option value="">No meeting (general log)</option>
            {meetings.map((m) => <option key={m.id} value={m.id}>{fmtDate(m.date)}{m.number ? ` · #${m.number}` : ''}{m.theme ? ` · ${m.theme}` : ''}</option>)}
          </select></label></div>
        <div className="center stack">
          <button className={`rec ${recording ? 'on' : 'primary'}`} onClick={recording ? stop : start} aria-label={recording ? 'Stop recording' : 'Start recording'}>
            {recording ? `■ ${seconds}s` : '🎙️ Record'}
          </button>
          {audio && !recording && <audio controls src={URL.createObjectURL(audio)} style={{ width: '100%' }} />}
        </div>
        <div className="divider">or type</div>
        <textarea placeholder="Type or paste notes" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="full primary" style={{ marginTop: '.6rem' }} disabled={busy || recording || (!audio && !text.trim())} onClick={analyse}>
          {busy && !result ? 'Understanding…' : 'Understand my note'}
        </button>
      </div>

      {result && (
        <div className="card">
          <h2>Review before saving</h2>
          {result.transcript && <p className="muted">“{result.transcript}”</p>}
          {result.actions.length === 0 && <p>Nothing to log was found.</p>}
          {result.actions.map((a) => (
            <div className="slot" key={a.i} style={{ opacity: allowed(a) ? 1 : 0.5 }}>
              <label className="check">
                <input type="checkbox" checked={a.apply && allowed(a)} disabled={!allowed(a)} onChange={(e) => setAction(a.i, { apply: e.target.checked })} />
                <b>{describe(a)}</b>
              </label>
              {a.type !== 'guest' && a.type !== 'note' && (
                <div style={{ marginTop: '.4rem' }}>
                  <PersonPicker value={a.who} onChange={(p) => setAction(a.i, { who: p })} members={members} guests={guests} />
                </div>
              )}
              {a.type === 'guest' && <small>{[a.phone, a.email, a.source].filter(Boolean).join(' · ')}</small>}
              {a.text && <p className="muted" style={{ margin: '.3rem 0 0' }}>{a.text}</p>}
              {!allowed(a) && <small>Only officers can save this.</small>}
            </div>
          ))}
          <button className="full primary" disabled={busy} onClick={apply}>{busy ? 'Saving…' : 'Save selected'}</button>
        </div>
      )}
    </>
  )
}

function describe(a) {
  switch (a.type) {
    case 'attendance': return `Present: ${a.person}`
    case 'speech': return `Speech: ${a.person}${a.title ? ` “${a.title}”` : ''}${a.project ? ` · ${a.project}` : ''}${a.actualTime ? ` · ${a.actualTime}` : ''}${a.evaluator ? ` · evaluator ${a.evaluator}` : ''}`
    case 'role': return `${ROLE_LABEL[a.role] || a.role}: ${a.person}`
    case 'award': return `${AWARD_LABEL[a.award] || a.award}: ${a.person}`
    case 'guest': return `New guest: ${a.person}`
    case 'evaluation': return `Evaluation for ${a.person}${a.evaluator ? ` by ${a.evaluator}` : ''}`
    default: return 'Note'
  }
}
