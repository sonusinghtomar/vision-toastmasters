import { useEffect, useState } from 'react'
import {
  collection, doc, onSnapshot, query, where, orderBy, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, writeBatch, serverTimestamp, increment,
} from 'firebase/firestore'
import { db } from './firebase'
import { ROLE_LABEL } from './constants'

export const col = (name) => collection(db, name)
export const ref = (name, id) => doc(db, name, id)
export { serverTimestamp, increment, where, orderBy, query, addDoc, setDoc, updateDoc, deleteDoc, getDocs }

const withId = (snap) => ({ id: snap.id, ...snap.data() })

// Live list of documents. `build` returns a query (or null to skip).
export function useList(build, deps) {
  const [state, setState] = useState({ data: [], loading: true, error: null })
  useEffect(() => {
    const q = build()
    if (!q) { setState({ data: [], loading: false, error: null }); return }
    setState((s) => ({ ...s, loading: true }))
    return onSnapshot(
      q,
      (snap) => setState({ data: snap.docs.map(withId), loading: false, error: null }),
      (error) => { console.error(error); setState({ data: [], loading: false, error }) },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

export function useDoc(name, id) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  useEffect(() => {
    if (!id) { setState({ data: null, loading: false, error: null }); return }
    return onSnapshot(
      ref(name, id),
      (snap) => setState({ data: snap.exists() ? withId(snap) : null, loading: false, error: null }),
      (error) => { console.error(error); setState({ data: null, loading: false, error }) },
    )
  }, [name, id])
  return state
}

// Common collections
export const useMembers = () => useList(() => col('members'), [])
export const useGuests = (enabled = true) => useList(() => (enabled ? col('guests') : null), [enabled])
export const useMeetings = () => useList(() => query(col('meetings'), orderBy('date', 'desc')), [])

export const byName = (a, b) => (a.name || '').localeCompare(b.name || '')
export const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '')

// ── Dates ──────────────────────────────────────────────────
export const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
export function fmtDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d) ? iso : d.toLocaleDateString('en-IN', opts)
}
// Toastmasters year runs 1 July to 30 June. Returns e.g. "2026-27".
export function programYear(iso = today()) {
  const [y, m] = iso.split('-').map(Number)
  const start = m >= 7 ? y : y - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}
export function programYearRange(py) {
  const start = Number(py.slice(0, 4))
  return [`${start}-07-01`, `${start + 1}-06-30`]
}

// ── Names ──────────────────────────────────────────────────
export const normEmail = (e) => (e || '').trim().toLowerCase()
const TITLE_RE = /^(tm|dtm|ptm|ctm|acs|acb|acg|als|alb|cl|mr|mrs|ms|dr)\.?\s+/i
export const cleanName = (n) => (n || '').replace(TITLE_RE, '').replace(TITLE_RE, '').replace(/\s+/g, ' ').trim()
const norm = (n) => cleanName(n).toLowerCase().replace(/[^a-z ]/g, '')

// Match a name from an agenda or a voice note to the closest member/guest.
export function matchPerson(name, people) {
  const n = norm(name)
  if (!n || /to be assigned|tba|tbd/.test(n)) return null
  let best = null
  let bestScore = 0
  for (const p of people) {
    const full = norm(p.name)
    const parts = full.split(' ')
    let score = 0
    if (full === n) score = 100
    else if (parts[0] === n || parts.join('') === n.replace(/ /g, '')) score = 80
    else if (full.startsWith(n + ' ') || n.startsWith(full + ' ')) score = 70
    else if (n.split(' ').every((w) => parts.some((x) => x.startsWith(w)))) score = 60
    else if (parts.some((x) => x.length > 2 && n.split(' ').includes(x))) score = 40
    if (score > bestScore) { bestScore = score; best = p }
  }
  return bestScore >= 40 ? best : null
}

// A "person" stored on agenda slots, awards and speeches.
export const personOf = (p, type) => (p ? { type, id: p.id, name: p.name } : null)

// ── Meeting sync ───────────────────────────────────────────
// A meeting's agenda (`slots`) is the source of truth for that meeting.
// On save we mirror it into `speeches` and `roleLog` so per-member history is a simple query.
export async function saveMeeting(meeting) {
  const { id, ...data } = meeting
  const meetingRef = id ? ref('meetings', id) : doc(col('meetings'))
  const mid = meetingRef.id
  const batch = writeBatch(db)
  batch.set(meetingRef, { ...data, updatedAt: serverTimestamp() }, { merge: true })

  const [oldSpeeches, oldRoles] = await Promise.all([
    getDocs(query(col('speeches'), where('meetingId', '==', mid))),
    getDocs(query(col('roleLog'), where('meetingId', '==', mid))),
  ])
  const keepS = new Set()
  const keepR = new Set()
  const base = { meetingId: mid, meetingNo: data.number || null, date: data.date || '', source: 'agenda' }

  for (const s of data.slots || []) {
    const p = s.person
    if (!p?.name) continue
    const rid = `${mid}__${s.key}`
    keepR.add(rid)
    batch.set(ref('roleLog', rid), {
      ...base, role: s.role, roleLabel: ROLE_LABEL[s.role] || s.role,
      personType: p.type, personId: p.id || '', name: p.name,
    })
    if (s.role === 'speaker' && p.type === 'member') {
      keepS.add(rid)
      batch.set(ref('speeches', rid), {
        ...base, memberId: p.id, name: p.name,
        title: s.title || '', path: s.path || '', level: s.level || '', project: s.project || '',
        timing: s.duration || '', actualTime: s.actualTime || '',
        evaluatorId: s.evaluator?.id || '', evaluatorName: s.evaluator?.name || '',
        notes: s.notes || '',
      }, { merge: true })
    }
    if (s.role === 'speaker' && s.evaluator?.name) {
      const eid = `${mid}__${s.key}_eval`
      keepR.add(eid)
      batch.set(ref('roleLog', eid), {
        ...base, role: 'evaluator', roleLabel: ROLE_LABEL.evaluator,
        personType: s.evaluator.type, personId: s.evaluator.id || '', name: s.evaluator.name,
        evaluates: p.name,
      })
    }
  }
  oldSpeeches.docs.filter((d) => d.data().source === 'agenda' && !keepS.has(d.id)).forEach((d) => batch.delete(d.ref))
  oldRoles.docs.filter((d) => d.data().source === 'agenda' && !keepR.has(d.id)).forEach((d) => batch.delete(d.ref))
  await batch.commit()
  return mid
}

let slotSeq = 0
export const newSlotKey = (role) => `${role}_${Date.now().toString(36)}${(slotSeq++).toString(36)}`

// ── Attendance ─────────────────────────────────────────────
export const attendanceId = (meetingId, personId) => `${meetingId}_${personId}`

export async function markAttendance(meeting, person, type, method = 'officer') {
  const id = attendanceId(meeting.id, person.id)
  // Guests carry a visit counter, so never count the same meeting twice.
  if (type === 'guest') {
    const existing = await getDoc(ref('attendance', id)).catch(() => null)
    if (existing?.exists()) return
  }
  await setDoc(ref('attendance', id), {
    meetingId: meeting.id, date: meeting.date || '', meetingNo: meeting.number || null,
    personType: type, personId: person.id, name: person.name, method, at: serverTimestamp(),
  })
  if (type === 'guest') {
    await updateDoc(ref('guests', person.id), {
      visits: increment(1), lastVisit: meeting.date || today(), updatedAt: serverTimestamp(),
    })
  }
}

export async function unmarkAttendance(meeting, person, type) {
  await deleteDoc(ref('attendance', attendanceId(meeting.id, person.id)))
  if (type === 'guest') await updateDoc(ref('guests', person.id), { visits: increment(-1) })
}

// Merge pending guest QR check-ins into guests + attendance (runs on an officer's device).
export async function processCheckins(meeting, guests) {
  const snap = await getDocs(query(col('checkins'), where('meetingId', '==', meeting.id)))
  let added = 0
  for (const d of snap.docs) {
    const c = d.data()
    const email = normEmail(c.email)
    const phone = (c.phone || '').replace(/\D/g, '').slice(-10)
    let guest = (c.guestId && guests.find((g) => g.id === c.guestId))
      || guests.find((g) => (email && g.email === email) || (phone && (g.phone || '').replace(/\D/g, '').slice(-10) === phone))
    if (!guest) {
      const gref = await addDoc(col('guests'), {
        name: cleanName(c.name), phone: c.phone || '', email, source: c.source || '',
        invitedBy: c.invitedBy || '', interest: c.interest || '', status: 'New', visits: 0,
        firstVisit: meeting.date || today(), lastVisit: meeting.date || today(), notes: '',
        followUps: [], createdAt: serverTimestamp(),
      })
      guest = { id: gref.id, name: cleanName(c.name) }
      guests.push({ ...guest, email, phone: c.phone || '' })
    }
    await markAttendance(meeting, guest, 'guest', 'qr')
    await deleteDoc(d.ref)
    added++
  }
  return added
}

// Member self check-in from the QR code. The rules check the code against checkinCodes/{meetingId}.
export async function markAttendanceSelf(meeting, memberId, name, code) {
  const existing = await getDoc(ref('attendance', attendanceId(meeting.id, memberId))).catch(() => null)
  if (existing?.exists()) return
  await setDoc(ref('attendance', attendanceId(meeting.id, memberId)), {
    meetingId: meeting.id, date: meeting.date || '', meetingNo: meeting.number || null,
    personType: 'member', personId: memberId, name: name || '', method: 'qr', code, at: serverTimestamp(),
  })
}
