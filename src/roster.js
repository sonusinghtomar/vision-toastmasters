// Reading a member roster file (e.g. the Club Central roster download) into member records.
// Column names vary between exports, so columns are detected from their headers and
// the officer can correct the mapping before importing.
import { normEmail, cleanName } from './names.js'

export const FIELDS = [
  ['name', 'Full name'],
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['email', 'Email'],
  ['phone', 'Mobile / phone'],
  ['joinDate', 'Member since'],
  ['position', 'Officer position'],
  ['tmId', 'Member / customer ID'],
  ['paidUntil', 'Paid until'],
]

// Header words → field. The first matching rule wins for each column.
const RULES = [
  ['email', /e-?mail/],
  ['tmId', /(customer|member)\s*(id|number|no)|^id$/],
  ['firstName', /first\s*name|given/],
  ['lastName', /last\s*name|surname|family/],
  ['name', /^(full\s*)?name$|member\s*name|^name\b/],
  ['phone', /mobile|cell|phone|whatsapp/],
  ['joinDate', /club\s*since|join|member since|start/],
  ['position', /position|officer|office|role/],
  ['paidUntil', /paid\s*(until|thru|through)|expir/],
]

export function parseCsv(text) {
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',' || c === '\t' || c === ';') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((x) => String(x).trim()))
}

export async function readRosterFile(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xls')) throw new Error('This is an old-style .xls file. Open it in Excel or Google Sheets and save it as .xlsx or .csv, then try again.')
  if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser')
    return readSheet(file)
  }
  return parseCsv((await file.text()).replace(/^﻿/, ''))
}

// Find the header row (the first row naming at least two known fields) and map its columns.
export function detectColumns(rows) {
  for (let h = 0; h < Math.min(rows.length, 15); h++) {
    const map = {}
    rows[h].forEach((cell, i) => {
      const t = String(cell ?? '').trim().toLowerCase()
      if (!t) return
      const rule = RULES.find(([f, re]) => re.test(t) && !(f in map))
      if (rule) map[rule[0]] = i
    })
    const named = 'name' in map || ('firstName' in map && 'lastName' in map) || 'firstName' in map
    if (named && Object.keys(map).length >= 2) return { headerRow: h, map }
  }
  return { headerRow: 0, map: {} }
}

const pad = (n) => String(n).padStart(2, '0')
export function toIsoDate(v) {
  if (v == null || v === '') return ''
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`
  // Toastmasters exports use month/day/year.
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    let [mo, d] = [Number(m[1]), Number(m[2])]
    if (mo > 12) [mo, d] = [d, mo] // clearly day/month
    return `${y}-${pad(mo)}-${pad(d)}`
  }
  return ''
}

// "Club Vice President Education" → "VP Education", etc.
export function officerTitle(position) {
  const p = String(position || '').toLowerCase()
  if (!p.trim()) return ''
  if (/immediate\s*past|ipp/.test(p)) return 'Immediate Past President'
  if (/education|vpe\b/.test(p)) return 'VP Education'
  if (/membership|vpm\b/.test(p)) return 'VP Membership'
  if (/public\s*relations|vppr\b|\bpr\b/.test(p)) return 'VP Public Relations'
  if (/secretary/.test(p)) return 'Secretary'
  if (/treasurer/.test(p)) return 'Treasurer'
  if (/sergeant|saa\b/.test(p)) return 'Sergeant at Arms'
  if (/president/.test(p)) return 'President'
  return ''
}

const titleCase = (s) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase())

export function rowsToPeople(rows, headerRow, map) {
  const get = (r, f) => (f in map ? r[map[f]] : '')
  const out = []
  for (const r of rows.slice(headerRow + 1)) {
    let name = String(get(r, 'name') ?? '').trim()
    if (!name) name = [get(r, 'firstName'), get(r, 'lastName')].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ')
    // "Last, First" → "First Last"
    if (/^[^,]+,\s*[^,]+$/.test(name)) name = name.split(',').map((x) => x.trim()).reverse().join(' ')
    name = cleanName(name)
    if (!name) continue
    if (name === name.toUpperCase()) name = titleCase(name)
    out.push({
      name,
      email: normEmail(get(r, 'email')),
      phone: String(get(r, 'phone') ?? '').trim(),
      joinDate: toIsoDate(get(r, 'joinDate')),
      officerTitle: officerTitle(get(r, 'position')),
      tmId: String(get(r, 'tmId') ?? '').trim(),
      paidUntil: toIsoDate(get(r, 'paidUntil')),
    })
  }
  return out
}

const key = (n) => cleanName(n).toLowerCase().replace(/[^a-z]/g, '')

// Compare file rows with the roster: what will be added, what will change.
export function planImport(people, members) {
  return people.map((p) => {
    const m = members.find((x) => (p.tmId && x.tmId === p.tmId) || (p.email && x.email === p.email))
      || members.find((x) => key(x.name) === key(p.name))
    if (!m) return { person: p, action: 'add', changes: [] }
    const changes = ['email', 'phone', 'joinDate', 'officerTitle', 'tmId', 'paidUntil']
      .filter((f) => p[f] && p[f] !== (m[f] || ''))
    // Keep an existing officer title if the file has none; clear titles only from the file's own column.
    return { person: p, member: m, action: changes.length ? 'update' : 'same', changes }
  })
}
