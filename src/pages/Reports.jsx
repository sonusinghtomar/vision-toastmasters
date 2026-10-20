import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { useList, useMembers, useGuests, useMeetings, col, programYear, programYearRange, today, fmtDate, byName } from '../data'
import { ROLES, ROLE_LABEL, AWARD_LABEL } from '../constants'
import { exportXlsx, exportCsv } from '../export'
import { Loading, ErrorNote, Tabs } from '../components/ui'

function yearOptions(meetings) {
  const set = new Set([programYear(), ...meetings.map((m) => programYear(m.date))])
  return [...set].sort().reverse()
}

export default function Reports() {
  const { isAdmin } = useAuth()
  const { data: members, loading } = useMembers()
  const { data: meetings } = useMeetings()
  const { data: guests } = useGuests(isAdmin)
  const { data: att } = useList(() => col('attendance'), [])
  const { data: speeches } = useList(() => col('speeches'), [])
  const { data: roles } = useList(() => col('roleLog'), [])
  const { data: edu } = useList(() => col('eduAwards'), [])
  const [py, setPy] = useState(programYear())
  const [tab, setTab] = useState('attendance')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const [from, to] = programYearRange(py)
  const inYear = (x) => (x.date || '') >= from && (x.date || '') <= to
  const t = today()
  const yMeetings = meetings.filter((m) => inYear(m) && m.date <= t).sort((a, b) => a.date.localeCompare(b.date))
  const active = members.filter((m) => m.status !== 'inactive').sort(byName)

  const attRows = useMemo(() => {
    const present = new Set(att.map((a) => `${a.meetingId}|${a.personId}`))
    return active.map((m) => {
      const eligible = yMeetings.filter((x) => !m.joinDate || x.date >= m.joinDate)
      const n = eligible.filter((x) => present.has(`${x.id}|${m.id}`)).length
      return { m, n, total: eligible.length, pct: eligible.length ? Math.round((n / eligible.length) * 100) : 0, present }
    }).sort((a, b) => b.pct - a.pct)
  }, [att, active, yMeetings])

  const exportAll = async () => {
    setBusy(true); setError(null)
    try {
      const present = new Set(att.map((a) => `${a.meetingId}|${a.personId}`))
      const sheets = [
        { sheet: 'Attendance summary', rows: attRows.map((r) => ({ Member: r.m.name, Attended: r.n, Meetings: r.total, 'Attendance %': r.pct })) },
        {
          sheet: 'Attendance grid',
          rows: active.map((m) => ({
            Member: m.name,
            ...Object.fromEntries(yMeetings.map((x) => [`${x.number ? '#' + x.number + ' ' : ''}${x.date}`, present.has(`${x.id}|${m.id}`) ? 'P' : ''])),
          })),
        },
        { sheet: 'Members', rows: members.map((m) => ({ Name: m.name, Email: m.email || '', Phone: m.phone || '', Joined: m.joinDate || '', Officer: m.officerTitle || '', Status: m.status || 'active', Paths: (m.pathways || []).map((p) => `${p.path} (L${p.level || 1}${p.completed ? ', done' : ''})`).join('; ') })) },
        { sheet: 'Meetings', rows: meetings.filter(inYear).map((x) => ({ Number: x.number || '', Date: x.date, Theme: x.theme || '', ...Object.fromEntries(Object.entries(x.awards || {}).map(([k, p]) => [AWARD_LABEL[k] || k, p?.name || ''])) })) },
        { sheet: 'Speeches', rows: speeches.filter(inYear).sort((a, b) => a.date.localeCompare(b.date)).map((s) => ({ Date: s.date, Meeting: s.meetingNo || '', Speaker: s.name, Title: s.title || '', Path: s.path || '', Level: s.level || '', Project: s.project || '', Target: s.timing || '', Actual: s.actualTime || '', Evaluator: s.evaluatorName || '' })) },
        { sheet: 'Roles', rows: roles.filter(inYear).sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ Date: r.date, Meeting: r.meetingNo || '', Role: r.roleLabel || ROLE_LABEL[r.role], Name: r.name, Type: r.personType })) },
        { sheet: 'Education awards', rows: edu.filter(inYear).map((e) => ({ Date: e.date, Member: e.memberName, Award: e.award, Path: e.path || '' })) },
      ]
      if (isAdmin) {
        sheets.push({ sheet: 'Guests', rows: guests.map((g) => ({ Name: g.name, Phone: g.phone || '', Email: g.email || '', Source: g.source || '', 'Invited by': g.invitedBy || '', Visits: g.visits || 0, 'First visit': g.firstVisit || '', 'Last visit': g.lastVisit || '', Status: g.status || 'New', Notes: g.notes || '' })) })
      }
      await exportXlsx(`vision-tm-${py}.xlsx`, sheets)
    } catch (e) { setError(e) }
    setBusy(false)
  }

  if (loading) return <Loading />
  const roleCounts = active.map((m) => {
    const mine = roles.filter((r) => r.personId === m.id && inYear(r))
    return { m, total: mine.length, by: mine.reduce((c, r) => ({ ...c, [r.role]: (c[r.role] || 0) + 1 }), {}) }
  })
  const speechCounts = active.map((m) => ({ m, n: speeches.filter((s) => s.memberId === m.id && inYear(s)).length })).sort((a, b) => b.n - a.n)

  return (
    <>
      <div className="row between">
        <h1>Reports</h1>
        <select value={py} onChange={(e) => setPy(e.target.value)} style={{ maxWidth: 130 }} aria-label="Program year">
          {yearOptions(meetings).map((y) => <option key={y}>{y}</option>)}
        </select>
      </div>
      <ErrorNote error={error} />
      <div className="stats">
        <div className="stat"><b>{yMeetings.length}</b><span>Meetings held</span></div>
        <div className="stat"><b>{yMeetings.length ? Math.round(att.filter((a) => a.personType === 'member' && inYear(a)).length / yMeetings.length) : 0}</b><span>Avg members / meeting</span></div>
        <div className="stat"><b>{att.filter((a) => a.personType === 'guest' && inYear(a)).length}</b><span>Guest visits</span></div>
        <div className="stat"><b>{speeches.filter(inYear).length}</b><span>Speeches</span></div>
      </div>
      <div className="card row">
        <button className="primary" disabled={busy} onClick={exportAll}>{busy ? 'Preparing…' : '⬇ Download Excel (all data)'}</button>
        <button onClick={() => exportCsv(`attendance-${py}.csv`, attRows.map((r) => ({ Member: r.m.name, Attended: r.n, Meetings: r.total, Percent: r.pct })))}>Attendance CSV</button>
        <Link className="btn" to="/dcp">DCP progress</Link>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['attendance', 'Attendance'], ['speeches', 'Speeches'], ['roles', 'Roles']]} />
      {tab === 'attendance' && (
        <div className="card tablewrap">
          <table>
            <thead><tr><th>Member</th><th>Attended</th><th>%</th></tr></thead>
            <tbody>{attRows.map((r) => (
              <tr key={r.m.id}><td><Link to={`/members/${r.m.id}?tab=attendance`}>{r.m.name}</Link></td><td>{r.n}/{r.total}</td>
                <td style={{ color: r.pct < 50 ? 'var(--danger)' : undefined }}>{r.pct}%</td></tr>))}</tbody>
          </table>
        </div>
      )}
      {tab === 'speeches' && (
        <>
          <div className="card tablewrap">
            <table><thead><tr><th>Member</th><th>Speeches {py}</th></tr></thead>
              <tbody>{speechCounts.map(({ m, n }) => <tr key={m.id}><td><Link to={`/members/${m.id}?tab=speeches`}>{m.name}</Link></td><td>{n || <span className="muted">0</span>}</td></tr>)}</tbody></table>
          </div>
          <div className="card">
            <h2>Recent speeches</h2>
            <ul className="list">{speeches.filter(inYear).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25).map((s) => (
              <li key={s.id}><span className="grow"><b>{s.name}</b> · {s.title || s.project || 'Speech'}<br /><small>{fmtDate(s.date)} {s.project && `· ${s.project}`} {s.evaluatorName && `· eval ${s.evaluatorName}`}</small></span></li>))}</ul>
          </div>
        </>
      )}
      {tab === 'roles' && (
        <div className="card tablewrap">
          <table>
            <thead><tr><th>Member</th><th>Total</th>{ROLES.filter((r) => r.key !== 'ttspeaker').map((r) => <th key={r.key} title={r.label}>{r.label.split(' ').map((w) => w[0]).join('')}</th>)}</tr></thead>
            <tbody>{roleCounts.map(({ m, total, by }) => (
              <tr key={m.id}><td>{m.name}</td><td><b>{total}</b></td>
                {ROLES.filter((r) => r.key !== 'ttspeaker').map((r) => <td key={r.key}>{by[r.key] || ''}</td>)}</tr>))}</tbody>
          </table>
          <p className="muted" style={{ marginTop: '.5rem' }}>Hover a column header for the role name. Use this to give everyone a fair rotation.</p>
        </div>
      )}
    </>
  )
}
