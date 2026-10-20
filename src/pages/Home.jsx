import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { reload } from 'firebase/auth'
import { useAuth, resendVerification } from '../auth'
import { useMeetings, useList, useGuests, col, query, where, today, fmtDate, programYear, programYearRange, useDoc } from '../data'
import { ROLE_LABEL } from '../constants'
import { enableNotifications, remindUpcoming } from '../notify'
import { Loading, useClub } from '../components/ui'

export default function Home() {
  const { role } = useAuth()
  if (role === 'pending') return <Pending />
  if (role === 'guest') return <GuestHome />
  return <MemberHome />
}

function Pending() {
  const { user, profile } = useAuth()
  const [sent, setSent] = useState(false)
  return (
    <div className="card stack">
      <h1>Welcome, {profile?.name}</h1>
      {!user.emailVerified && (
        <div className="banner">
          Please verify your email ({user.email}) using the link we sent you.
          <div className="row" style={{ marginTop: '.5rem' }}>
            <button className="small" disabled={sent} onClick={() => resendVerification().then(() => setSent(true))}>{sent ? 'Sent' : 'Resend email'}</button>
            <button className="small" onClick={() => reload(user).then(() => window.location.reload())}>I have verified</button>
          </div>
        </div>
      )}
      <p>Your account is waiting to be linked to the club roster.</p>
      <p className="muted">
        If you are a member, ask the President or VP Education to add your email ({user.email}) to your member profile,
        and you will be linked automatically. Guests are linked after their first check-in with the same email.
      </p>
    </div>
  )
}

function useNextMeeting() {
  const { data: meetings, loading } = useMeetings()
  const t = today()
  const upcoming = meetings.filter((m) => m.date >= t).sort((a, b) => a.date.localeCompare(b.date))
  return { next: upcoming[0], upcoming, meetings, loading }
}

function NextMeetingCard({ next, club, admin }) {
  if (!next) {
    return (
      <div className="card accent">
        <h2>No upcoming meeting</h2>
        {admin && <div className="row"><Link className="btn primary" to="/meetings/import">Import agenda</Link><Link className="btn" to="/meetings?new=1">New meeting</Link></div>}
      </div>
    )
  }
  return (
    <div className="card accent">
      <small>Next meeting</small>
      <h2>{next.number ? `#${next.number} · ` : ''}{next.theme || 'Club meeting'}</h2>
      <p className="muted">{fmtDate(next.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {next.startTime || club.startTime}</p>
      <div className="row">
        <Link className="btn primary" to={`/meetings/${next.id}`}>Open agenda</Link>
        {admin && <Link className="btn" to={`/meetings/${next.id}?tab=attendance`}>Attendance</Link>}
        {admin && <Link className="btn" to={`/meetings/${next.id}?tab=qr`}>QR check-in</Link>}
      </div>
    </div>
  )
}

function MemberHome() {
  const { isAdmin, memberId, profile } = useAuth()
  const club = useClub()
  const { next, upcoming, loading } = useNextMeeting()
  const py = programYear()
  const [from, to] = programYearRange(py)
  const { data: member } = useDoc('members', memberId)
  const { data: myAtt } = useList(() => (memberId ? query(col('attendance'), where('personId', '==', memberId)) : null), [memberId])
  const { data: mySpeeches } = useList(() => (memberId ? query(col('speeches'), where('memberId', '==', memberId)) : null), [memberId])
  const { data: myRoles } = useList(() => (memberId ? query(col('roleLog'), where('personId', '==', memberId)) : null), [memberId])
  const { data: guests } = useGuests(isAdmin)
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')

  // My roles in the coming meetings
  const myUpcoming = useMemo(() => upcoming.flatMap((m) => (m.slots || []).flatMap((s) => {
    const out = []
    if (s.person?.id === memberId) out.push({ meetingId: m.id, date: m.date, theme: m.theme, role: s.role, roleLabel: ROLE_LABEL[s.role] })
    if (s.evaluator?.id === memberId) out.push({ meetingId: m.id, date: m.date, theme: m.theme, role: 'evaluator', roleLabel: `Evaluator for ${s.person?.name || 'a speaker'}` })
    return out
  })), [upcoming, memberId])

  useEffect(() => {
    const soon = new Date(); soon.setDate(soon.getDate() + 3)
    const limit = soon.toLocaleDateString('en-CA')
    remindUpcoming(myUpcoming.filter((r) => r.date <= limit))
  }, [myUpcoming, perm])

  const followUps = guests
    .filter((g) => ['New', 'Follow up', 'Interested'].includes(g.status || 'New'))
    .filter((g) => !g.nextFollowUp || g.nextFollowUp <= today())
    .sort((a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || ''))

  if (loading) return <Loading />
  const inYear = (x) => x.date >= from && x.date <= to
  const currentPath = (member?.pathways || []).find((p) => !p.completed) || (member?.pathways || [])[0]

  return (
    <>
      <h1>Hello, {(member?.name || profile?.name || '').split(' ')[0]}</h1>
      <NextMeetingCard next={next} club={club} admin={isAdmin} />

      {memberId && (
        <>
          <div className="stats">
            <div className="stat"><b>{myAtt.filter(inYear).length}</b><span>Meetings attended ({py})</span></div>
            <div className="stat"><b>{mySpeeches.length}</b><span>Speeches</span></div>
            <div className="stat"><b>{myRoles.length}</b><span>Roles taken</span></div>
            <div className="stat"><b>{currentPath ? `L${currentPath.level || 1}` : '–'}</b><span>{currentPath?.path || 'No path yet'}</span></div>
          </div>

          <div className="card">
            <div className="row between">
              <h2>My upcoming roles</h2>
              <Link to={`/members/${memberId}`}>My profile</Link>
            </div>
            {myUpcoming.length === 0
              ? <p className="muted">No roles assigned yet. Ask the VP Education for one!</p>
              : <ul className="list">{myUpcoming.map((r) => (
                <li key={r.meetingId + r.roleLabel}><Link className="item" to={`/meetings/${r.meetingId}`}>
                  <span className="grow"><b>{r.roleLabel}</b><br /><small>{fmtDate(r.date)}{r.theme ? ' · ' + r.theme : ''}</small></span>
                </Link></li>))}</ul>}
            {perm === 'default' && (
              <button className="small" onClick={async () => setPerm(await enableNotifications())}>Remind me before my roles</button>
            )}
          </div>
        </>
      )}

      {isAdmin && (
        <>
          <div className="card">
            <h2>Quick actions</h2>
            <div className="grid2">
              <Link className="btn primary" to="/meetings/import">📄 Import agenda</Link>
              <Link className="btn" to="/log">🎙️ Voice log</Link>
              <Link className="btn" to="/meetings?new=1">＋ New meeting</Link>
              <Link className="btn" to="/guests?new=1">＋ Add guest</Link>
            </div>
          </div>
          <div className="card">
            <div className="row between"><h2>Guests to follow up</h2><Link to="/guests">All guests</Link></div>
            {followUps.length === 0 ? <p className="muted">All caught up.</p> : (
              <ul className="list">{followUps.slice(0, 6).map((g) => (
                <li key={g.id}><Link className="item" to={`/guests/${g.id}`}>
                  <span className="grow ellipsis"><b>{g.name}</b><br /><small>{g.visits || 0} visit(s) · last {fmtDate(g.lastVisit)}</small></span>
                  <span className="chip yellow">{g.status || 'New'}</span>
                </Link></li>))}</ul>
            )}
          </div>
        </>
      )}
      {!memberId && isAdmin && (
        <div className="banner info">Tip: link your account to your member profile in <Link to="/admin">Users &amp; access</Link> to see your own roles and stats.</div>
      )}
    </>
  )
}

function GuestHome() {
  const { guestId } = useAuth()
  const club = useClub()
  const { next, loading } = useNextMeeting()
  const { data: guest } = useDoc('guests', guestId)
  const { data: visits } = useList(() => query(col('attendance'), where('personType', '==', 'guest'), where('personId', '==', guestId)), [guestId])
  if (loading) return <Loading />
  return (
    <>
      <h1>Hello, {guest?.name?.split(' ')[0] || 'guest'}</h1>
      <NextMeetingCard next={next} club={club} />
      <div className="card">
        <h2>My visits ({visits.length})</h2>
        <ul className="list">{[...visits].sort((a, b) => b.date.localeCompare(a.date)).map((v) => (
          <li key={v.id}>{fmtDate(v.date)}{v.meetingNo ? ` · Meeting #${v.meetingNo}` : ''}</li>))}</ul>
      </div>
      <div className="card">
        <h2>About the club</h2>
        <p>{club.name} meets every {club.meetingDay}, {club.startTime} to {club.endTime}.</p>
        <p className="muted">{club.venue}</p>
        {club.meetupUrl && <a className="btn" href={club.meetupUrl} target="_blank" rel="noreferrer">Meetup page</a>}
      </div>
    </>
  )
}
