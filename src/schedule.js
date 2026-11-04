// Club meeting pattern, e.g. the 1st, 3rd and 5th Sunday of each month.
// Settings store it as club.meetingDay ('Sunday') and club.meetingWeeks ('1,3,5'; blank = every week).
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th']

export const parseWeeks = (s) => [...new Set(String(s || '').split(/[^1-5]+/).filter(Boolean).map(Number))].sort()

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }

export function isMeetingDate(dateIso, day, weeks) {
  const d = parse(dateIso)
  if (d.getDay() !== Math.max(0, DAYS.indexOf(day))) return false
  return !weeks.length || weeks.includes(Math.ceil(d.getDate() / 7))
}

// All meeting dates from `from` to `until` (inclusive), as YYYY-MM-DD.
export function meetingDates(from, until, day, weeks) {
  const out = []
  for (let d = parse(from); iso(d) <= until; d.setDate(d.getDate() + 1)) {
    if (isMeetingDate(iso(d), day, weeks)) out.push(iso(d))
  }
  return out
}

export function nextMeetingDate(club, from) {
  const end = parse(from); end.setDate(end.getDate() + 60)
  return meetingDates(from, iso(end), club.meetingDay, parseWeeks(club.meetingWeeks))[0] || from
}

const list = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`)
// "meets on the 1st, 3rd and 5th Sunday" or "meets every Sunday"
export function meetsText(club) {
  const weeks = parseWeeks(club.meetingWeeks)
  return weeks.length && weeks.length < 5
    ? `meets on the ${list(weeks.map((w) => ORD[w]))} ${club.meetingDay} of the month`
    : `meets every ${club.meetingDay}`
}
export { DAYS, ORD }
