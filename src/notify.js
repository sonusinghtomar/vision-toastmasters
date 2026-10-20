import { download } from './export'
import { ROLE_LABEL } from './constants'

// ── Calendar (.ics) ────────────────────────────────────────
const icsDate = (date, time) => `${date.replace(/-/g, '')}T${(time || '09:45').replace(':', '')}00`
export function downloadIcs(meeting, club, extra = '') {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vision TM//EN', 'BEGIN:VEVENT',
    `UID:${meeting.id}@vision-tm`,
    `DTSTART;TZID=Asia/Kolkata:${icsDate(meeting.date, meeting.startTime || club.startTime)}`,
    `DTEND;TZID=Asia/Kolkata:${icsDate(meeting.date, meeting.endTime || club.endTime)}`,
    `SUMMARY:${club.name} meeting${meeting.number ? ' #' + meeting.number : ''}`,
    `DESCRIPTION:${[meeting.theme && 'Theme: ' + meeting.theme, extra].filter(Boolean).join('\\n')}`,
    `LOCATION:${(meeting.venue || club.venue || '').replace(/,/g, '\\,')}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Toastmasters meeting tomorrow', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ]
  download(new Blob([lines.join('\r\n')], { type: 'text/calendar' }), `meeting-${meeting.number || meeting.date}.ics`)
}

// ── WhatsApp ───────────────────────────────────────────────
export const whatsappLink = (text, phone = '') => {
  const p = phone.replace(/\D/g, '')
  const num = p.length === 10 ? '91' + p : p
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`
}

export function rolesMessage(meeting, club) {
  const lines = [`*${club.name}* meeting${meeting.number ? ' #' + meeting.number : ''}`,
    `${meeting.date}${meeting.theme ? ' | Theme: ' + meeting.theme : ''}`, '']
  for (const s of meeting.slots || []) {
    let line = `${ROLE_LABEL[s.role] || s.role}: ${s.person?.name || 'To be assigned'}`
    if (s.role === 'speaker' && s.evaluator?.name) line += ` (Evaluator: ${s.evaluator.name})`
    lines.push(line)
  }
  lines.push('', 'Please confirm your role. See you there!')
  return lines.join('\n')
}

// ── Local reminders ────────────────────────────────────────
// Shows a notification when the app is opened and the user has a role in the next 3 days.
// True background push needs Firebase Cloud Messaging + Cloud Functions (see docs/SETUP.md).
export async function enableNotifications() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.requestPermission()
}

export async function remindUpcoming(myRoles) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  let shown = {}
  try { shown = JSON.parse(localStorage.getItem('remindersShown') || '{}') } catch { /* ignore */ }
  const reg = await navigator.serviceWorker?.getRegistration()
  for (const r of myRoles) {
    const key = `${r.meetingId}_${r.role}`
    if (shown[key]) continue
    const body = `${r.roleLabel} on ${r.date}${r.theme ? ' | ' + r.theme : ''}`
    if (reg) reg.showNotification('Your Toastmasters role is coming up', { body, icon: 'icon-192.png', tag: key })
    else new Notification('Your Toastmasters role is coming up', { body })
    shown[key] = Date.now()
  }
  try { localStorage.setItem('remindersShown', JSON.stringify(shown)) } catch { /* ignore */ }
}
