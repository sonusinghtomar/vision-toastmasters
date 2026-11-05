import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { doc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { useMembers, col, ref, serverTimestamp, today } from '../data'
import { FIELDS, readRosterFile, detectColumns, rowsToPeople, planImport } from '../roster'
import { ErrorNote } from '../components/ui'

const LABEL = { add: ['New', 'green'], update: ['Update', 'yellow'], same: ['No change', 'gray'] }

// Import the member roster (e.g. Club Central's roster download) in one go.
export default function MembersImport() {
  const { data: members } = useMembers()
  const [rows, setRows] = useState(null)
  const [headerRow, setHeaderRow] = useState(0)
  const [map, setMap] = useState({})
  const [inactive, setInactive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const read = async (file) => {
    setError(null); setResult(null)
    try {
      const r = await readRosterFile(file)
      const d = detectColumns(r)
      setRows(r); setHeaderRow(d.headerRow); setMap(d.map)
    } catch (e) { setError(e); setRows(null) }
  }

  const headers = rows ? rows[headerRow].map((h, i) => String(h ?? '').trim() || `Column ${i + 1}`) : []
  const people = useMemo(() => (rows ? rowsToPeople(rows, headerRow, map) : []), [rows, headerRow, map])
  const plan = useMemo(() => planImport(people, members), [people, members])
  const matchedIds = new Set(plan.filter((p) => p.member).map((p) => p.member.id))
  const missing = members.filter((m) => m.status !== 'inactive' && !matchedIds.has(m.id))
  const adds = plan.filter((p) => p.action === 'add')
  const updates = plan.filter((p) => p.action === 'update')
  const named = 'name' in map || 'firstName' in map

  const run = async () => {
    setBusy(true); setError(null)
    try {
      const writes = []
      for (const p of adds) {
        writes.push([doc(col('members')), { ...p.person, status: 'active', joinDate: p.person.joinDate || today(), pathways: [], createdAt: serverTimestamp() }, false])
      }
      for (const p of updates) {
        writes.push([ref('members', p.member.id), Object.fromEntries(p.changes.map((f) => [f, p.person[f]])), true])
      }
      if (inactive) for (const m of missing) writes.push([ref('members', m.id), { status: 'inactive' }, true])
      for (let i = 0; i < writes.length; i += 400) {
        const batch = writeBatch(db)
        for (const [r, data, merge] of writes.slice(i, i + 400)) batch.set(r, { ...data, updatedAt: serverTimestamp() }, { merge })
        await batch.commit()
      }
      setResult({ added: adds.length, updated: updates.length, inactivated: inactive ? missing.length : 0 })
      setRows(null)
    } catch (e) { setError(e) }
    setBusy(false)
  }

  return (
    <>
      <p><Link to="/members">← Members</Link></p>
      <h1>Import member roster</h1>
      <ErrorNote error={error} />
      {result && (
        <div className="banner ok">
          Done: {result.added} added, {result.updated} updated{result.inactivated ? `, ${result.inactivated} marked inactive` : ''}.
          Members who sign in with the email on the roster are now linked to their profile automatically.
        </div>
      )}
      {!rows && (
        <div className="card stack">
          <p style={{ margin: 0 }}>Download the club roster from <b>Toastmasters Club Central</b> (Excel or CSV) and choose the file here. Names, emails, phone numbers, join dates and officer positions are read from it.</p>
          <p className="muted" style={{ margin: 0 }}>Existing members are matched by member ID, email or name and updated, never duplicated. You will see everything before anything is saved.</p>
          <input type="file" accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => e.target.files[0] && read(e.target.files[0])} />
        </div>
      )}
      {rows && (
        <>
          <div className="card">
            <h2>Columns</h2>
            <p className="muted">Detected from the file's headings. Fix any that are wrong.</p>
            <div className="grid2">
              {FIELDS.map(([f, label]) => (
                <div className="field" key={f}><label>{label}
                  <select value={f in map ? map[f] : ''} onChange={(e) => {
                    const next = { ...map }
                    if (e.target.value === '') delete next[f]; else next[f] = Number(e.target.value)
                    setMap(next)
                  }}>
                    <option value="">Not in file</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select></label></div>
              ))}
            </div>
            {!named && <div className="banner">Choose which column holds the member names.</div>}
          </div>
          <div className="card">
            <h2>Preview</h2>
            <p><b>{adds.length}</b> new · <b>{updates.length}</b> to update · {plan.length - adds.length - updates.length} unchanged
              {plan.filter((p) => !p.person.email).length > 0 && <> · <span className="muted">{plan.filter((p) => !p.person.email).length} without email (they will need approval when they sign in)</span></>}</p>
            <div className="tablewrap" style={{ maxHeight: 380, overflow: 'auto' }}>
              <table>
                <thead><tr><th></th><th>Name</th><th>Email</th><th>Officer</th></tr></thead>
                <tbody>{plan.map((p, i) => (
                  <tr key={i}>
                    <td><span className={`chip ${LABEL[p.action][1]}`}>{LABEL[p.action][0]}</span></td>
                    <td>{p.person.name}{p.action === 'update' && <><br /><small className="muted">{p.changes.join(', ')}</small></>}</td>
                    <td><small>{p.person.email || <span className="muted">none</span>}</small></td>
                    <td><small>{p.person.officerTitle}</small></td>
                  </tr>))}</tbody>
              </table>
            </div>
            {missing.length > 0 && (
              <label className="check" style={{ marginTop: '.8rem' }}>
                <input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} />
                Mark the {missing.length} member{missing.length === 1 ? '' : 's'} not in this file as inactive
              </label>
            )}
          </div>
          <div className="row between">
            <button onClick={() => setRows(null)}>Choose another file</button>
            <button className="primary" disabled={busy || !named || !(adds.length + updates.length + (inactive ? missing.length : 0))} onClick={run}>
              {busy ? 'Importing…' : `Import ${adds.length + updates.length} member${adds.length + updates.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}
    </>
  )
}
