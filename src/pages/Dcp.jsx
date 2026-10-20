import { useEffect, useState } from 'react'
import { useAuth } from '../auth'
import { useDoc, useList, useMembers, col, ref, setDoc, programYear, programYearRange } from '../data'
import { DCP_GOALS } from '../constants'
import { Loading, ErrorNote, Progress } from '../components/ui'

// Distinguished Club Program tracker. Education and membership goals are counted
// automatically; the rest are entered by officers. Always confirm against Club Central.
export default function Dcp() {
  const { isAdmin } = useAuth()
  const py = programYear()
  const [from, to] = programYearRange(py)
  const { data: saved, loading } = useDoc('dcp', py)
  const { data: edu } = useList(() => col('eduAwards'), [])
  const { data: members } = useMembers()
  const [goals, setGoals] = useState(DCP_GOALS)
  const [manual, setManual] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    if (saved?.goals) setGoals(saved.goals)
    if (saved?.manual) setManual(saved.manual)
  }, [saved])

  const inYear = (d) => (d || '') >= from && (d || '') <= to
  const count = (award) => edu.filter((e) => inYear(e.date) && award.includes(e.award)).length
  const l1 = count(['Level 1'])
  const l2 = count(['Level 2'])
  const l3 = count(['Level 3'])
  const l4 = count(['Level 4', 'Level 5', 'Path Completed', 'DTM'])
  const newM = members.filter((m) => inYear(m.joinDate)).length
  const goalOf = (id) => goals.find((g) => g.id === id)?.target || 0
  const auto = {
    L1: l1,
    L2: Math.min(l2, goalOf(2)),
    L2more: Math.max(0, l2 - goalOf(2)),
    L3: l3,
    L4plus: Math.min(l4, goalOf(5)),
    L4plusMore: Math.max(0, l4 - goalOf(5)),
    newMembers: Math.min(newM, goalOf(7)),
    newMembersMore: Math.max(0, newM - goalOf(7)),
  }
  const value = (g) => (g.auto ? auto[g.auto] : Number(manual[g.id] || 0))
  const achieved = goals.filter((g) => value(g) >= g.target).length
  const level = achieved >= 9 ? "President's Distinguished" : achieved >= 7 ? 'Select Distinguished' : achieved >= 5 ? 'Distinguished' : null

  const persist = (next) => setDoc(ref('dcp', py), next, { merge: true }).catch(setError)

  if (loading) return <Loading />
  return (
    <>
      <h1>DCP {py}</h1>
      <ErrorNote error={error} />
      <div className="card accent">
        <div className="row between">
          <div><b style={{ fontSize: '2rem', color: 'var(--blue-2)' }}>{achieved}</b> / {goals.length} goals</div>
          {level ? <span className="chip green">{level}</span> : <span className="chip gray">{5 - achieved} more for Distinguished</span>}
        </div>
        <div style={{ marginTop: '.6rem' }}><Progress value={achieved} max={goals.length} /></div>
        <p className="muted" style={{ marginTop: '.6rem', marginBottom: 0 }}>
          Clubs also need to meet the membership requirement. Official numbers are on Club Central; this page is a planning aid.
        </p>
      </div>
      <div className="card">
        <ul className="list">
          {goals.map((g) => {
            const v = value(g)
            return (
              <li key={g.id} style={{ display: 'block' }}>
                <div className="row between">
                  <span className="grow"><b>{g.id}.</b> {g.label}</span>
                  <span className={`chip ${v >= g.target ? 'green' : 'gray'}`}>{v}/{g.target}{v >= g.target ? ' ✓' : ''}</span>
                </div>
                <div style={{ margin: '.4rem 0' }}><Progress value={v} max={g.target} /></div>
                {isAdmin && (
                  <div className="row">
                    {!g.auto && (
                      <input type="number" min="0" style={{ maxWidth: 100 }} value={manual[g.id] || 0} aria-label="Achieved"
                        onChange={(e) => { const m = { ...manual, [g.id]: Number(e.target.value) }; setManual(m); persist({ manual: m }) }} />
                    )}
                    <small className="muted">Target</small>
                    <input type="number" min="1" style={{ maxWidth: 80 }} value={g.target} aria-label="Target"
                      onChange={(e) => { const next = goals.map((x) => (x.id === g.id ? { ...x, target: Number(e.target.value) } : x)); setGoals(next); persist({ goals: next }) }} />
                    {g.auto && <small className="muted">counted automatically</small>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
