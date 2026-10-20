import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { useClub } from '../components/ui'

export default function More() {
  const { isAdmin, isMember, memberId, guestId } = useAuth()
  const club = useClub()
  const links = [
    memberId && [`/members/${memberId}`, '👤 My profile, Pathways and speeches'],
    guestId && [`/guests/${guestId}`, '👤 My visits'],
    isMember && ['/members', '👥 Members'],
    isAdmin && ['/guests', '🙋 Guests and follow-up'],
    ['/meetings', '📅 Meetings'],
    isAdmin && ['/meetings/import', '📄 Import agenda (PDF or photo)'],
    isMember && ['/log', '🎙️ Voice log'],
    isMember && ['/reports', '📊 Reports and Excel export'],
    isMember && ['/dcp', '🏅 DCP progress'],
    isAdmin && ['/admin', '🔑 Users and access'],
    ['/settings', '⚙️ Settings and install'],
  ].filter(Boolean)
  return (
    <>
      <h1>More</h1>
      <div className="card">
        <ul className="list">{links.map(([to, label]) => <li key={to}><Link className="item" to={to}>{label}</Link></li>)}</ul>
      </div>
      <p className="footer-note">
        {club.name} · Club {club.number} · {club.area}, {club.division}, {club.district}<br />
        An independent club tool. Not an official Toastmasters International product.
      </p>
    </>
  )
}
