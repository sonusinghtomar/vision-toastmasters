import { useEffect, useState } from 'react'
import { useDoc } from '../data'
import { CLUB_DEFAULTS } from '../constants'

export function useClub() {
  const { data } = useDoc('settings', 'club')
  return { ...CLUB_DEFAULTS, ...(data || {}) }
}

const ICONS = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  people: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM22 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  more: 'M4 6h16M4 12h16M4 18h16',
  user: 'M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
}
export function Icon({ name, size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'

export function Avatar({ name, guest }) {
  return <span className={`avatar${guest ? ' guest' : ''}`}>{initials(name)}</span>
}

export function Loading({ text = 'Loading…' }) {
  return <p className="muted center" style={{ padding: '2rem 0' }}>{text}</p>
}

export function ErrorNote({ error }) {
  if (!error) return null
  const msg = error.code === 'permission-denied'
    ? 'You do not have permission for this. Ask the President or an officer to update your access.'
    : error.message || String(error)
  return <div className="banner error">{msg}</div>
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="row between" style={{ marginBottom: '.6rem' }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="small" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  )
}

// Choose a member, a guest, or type a name (e.g. a visiting Toastmaster from another club).
// Value shape: { type: 'member'|'guest'|'other', id, name } or null.
export function PersonPicker({ value, onChange, members, guests = [], placeholder = 'To be assigned', allowGuests = true }) {
  const [typing, setTyping] = useState(value?.type === 'other')
  useEffect(() => { if (value?.type && value.type !== 'other') setTyping(false) }, [value?.type])
  const key = value ? (value.type === 'other' ? '__other' : `${value.type}:${value.id}`) : ''
  if (typing) {
    return (
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input value={value?.name || ''} placeholder="Name (visitor)"
          onChange={(e) => onChange(e.target.value ? { type: 'other', id: '', name: e.target.value } : null)} />
        <button className="small" type="button" onClick={() => { setTyping(false); onChange(null) }}>List</button>
      </div>
    )
  }
  return (
    <select value={key} onChange={(e) => {
      const v = e.target.value
      if (v === '__other') { setTyping(true); onChange(null); return }
      if (!v) return onChange(null)
      const [type, id] = v.split(':')
      const p = (type === 'member' ? members : guests).find((x) => x.id === id)
      onChange(p ? { type, id, name: p.name } : null)
    }}>
      <option value="">{placeholder}</option>
      <optgroup label="Members">
        {members.map((m) => <option key={m.id} value={`member:${m.id}`}>{m.name}</option>)}
      </optgroup>
      {allowGuests && guests.length > 0 && (
        <optgroup label="Guests">
          {guests.map((g) => <option key={g.id} value={`guest:${g.id}`}>{g.name}</option>)}
        </optgroup>
      )}
      <option value="__other">Someone else (type name)…</option>
    </select>
  )
}

export function Field({ label, children }) {
  return <div className="field"><label>{label}{children}</label></div>
}

export function Progress({ value, max }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0
  return <div className={`progress${pct >= 100 ? ' done' : ''}`}><i style={{ width: pct + '%' }} /></div>
}
