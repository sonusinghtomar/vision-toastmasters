import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { Tabs, useClub } from '../components/ui'

const LOGO_URL = `${import.meta.env.BASE_URL}club-logo.webp`

const FEATURES = [
  ['📅', 'Meetings and agendas', 'Every role from SAA to Table Topics, prepared speakers with time slots, Pathways projects and evaluators.'],
  ['📄', 'Agenda import', 'Upload the agenda PDF or a photo. The app reads the theme, date and all roles for you to check and save.'],
  ['✅', 'Attendance', 'Members and guests check themselves in by scanning a printed poster at the venue or an officer\'s phone, and officers can tick anyone who did not scan.'],
  ['🙋', 'Guests and follow-up', 'Guest check-in form, visit count, follow-up notes and reminders, one-tap call or WhatsApp, convert to member.'],
  ['🎓', 'Pathways and speeches', 'Each member\'s path and level, speech log with timing and evaluation notes, and role history.'],
  ['🎙️', 'Voice log', 'Speak or type a note after the meeting. It becomes attendance, speeches, roles, awards and guests.'],
  ['🏆', 'Awards and DCP', 'Best Speaker, Evaluator, Role Players, Listener and Table Topics, plus Distinguished Club Program progress.'],
  ['📊', 'Reports and Excel', 'Attendance %, role rotation and speeches, with a one-click Excel workbook or CSV.'],
  ['🔔', 'Reminders and sharing', 'Role reminders, add the meeting to your calendar, and send the role list on WhatsApp.'],
  ['📱', 'Works like an app', 'Install it on your phone. It keeps working offline and syncs when you are back online.'],
]

// Each guide: [section title, steps]. Keep wording in sync with the button labels in the app.
const GUIDES = {
  officers: [
    ['Requests and approvals', [
      'A badge on More and a "Needs your approval" card on Home show role requests from members and people waiting for access. With notifications allowed, your phone also alerts you while the app is open.',
      'More → 🔔 Requests: Approve puts the member on the agenda (anyone else who asked for that role is told it has gone); Decline lets them know.',
    ]],
    ['Plan the season (once)', [
      'Meetings → Plan meetings creates every meeting for the year on the club\'s pattern (1st, 3rd and 5th Sunday) with the standard agenda and the next meeting numbers.',
      'Dates that already have a meeting are skipped, so it is safe to run again. The check-in poster then works at every planned meeting.',
      'The pattern is set in Settings → Club details (Meeting day, Weeks of the month).',
    ]],
    ['Before the meeting', [
      'Go to Meetings → Import agenda, choose the agenda PDF or take a photo, and tap Read agenda.',
      'Check the roles. Tap "Add as member" for any name the app does not know yet, then Create meeting.',
      'No agenda yet? Use Meetings → ＋ New to get the standard Vision agenda and assign roles by hand.',
      'Open the meeting → Share → Send on WhatsApp to post the role list to the club group.',
    ]],
    ['Check-in poster (one-time setup)', [
      'More → 🖨️ Check-in poster → Create poster QR → Print poster. Keep copies at the entrance and the guest table.',
      'Save QR image puts the same code in a WhatsApp message or on a standee.',
      'The poster works on meeting days only, from 1 hour before the start until 1 hour after the end, and checks people into that day\'s meeting.',
      'Check the meeting\'s Start and End times on the Agenda tab: they decide when the poster works. Imported agendas fill them in.',
      'If a photo of the poster is shared around, tap New code and print again: old posters stop working. Turn off pauses it completely.',
    ]],
    ['At the meeting', [
      'With the poster up, there is nothing to open. Members scan and tap "Check me in". Guests scan, tap "I am a guest" and fill a short form, no account needed.',
      'No poster? Open the meeting → QR check-in → Open check-in and tap the code to show it full screen. Several officers can show the same code at once.',
      'Attendance tab: see who has checked in and the count, tick anyone who did not scan, or tap "Mark all role-holders present".',
      'If you used the meeting QR, tap Close check-in when the meeting ends.',
    ]],
    ['After the meeting', [
      'Awards tab: choose Best Speaker, Best Evaluator, Role Players, Listener and Table Topics, then Save.',
      'Agenda tab: add speech titles, actual times and evaluation notes for each speaker, then Save agenda.',
      'Or use Voice log: say who was present, speech details and award winners, check the list, then Save selected.',
    ]],
    ['Guests (VP Membership)', [
      'Guests lists everyone who visited, with visit count and status. "Open" shows who still needs follow-up.',
      'Open a guest to call, WhatsApp or email them, add a note and set the next follow-up date.',
      'When a guest joins, tap "Convert to member" to create their member profile.',
    ]],
    ['Education (VP Education)', [
      'Open a member → Pathways to see their path and level. Tap "Mark Level complete" when Base Camp confirms it.',
      'Reports → Roles shows who has done which role, to plan a fair rotation.',
      'DCP shows progress on the ten goals. Education and new-member goals count automatically.',
    ]],
    ['Members and access (President)', [
      'Members → Import roster: choose the roster file downloaded from Club Central (Excel or CSV). Names, emails, phones, join dates and officer positions are added in one go, and running it again only updates.',
      'Members whose email is on the roster are linked automatically when they sign in, so they never wait for approval. For one person, use Members → ＋ Add member.',
      'Settings → Club details: add your WhatsApp number for access requests, so new people can message you from their waiting screen.',
      'More → Users and access: set each ExCom officer (SAA, Secretary, Treasurer, VPPR, VP Membership, VP Education) to Admin after they sign in once, so they can show the check-in QR, print the poster and take attendance. Only the President can grant Admin.',
      'Or tap "Make ExCom officers Admin" at the top of Users and access: everyone with an officer title who has signed in gets Admin in one tap.',
      'Also in Users and access: link any account that did not link automatically to its member or guest record.',
      'Once a month, Home reminds you to download the Excel backup (Reports → Download Excel). Keep it in Google Drive or email.',
      'Reports → Download Excel gives the whole year\'s attendance, speeches, roles, guests and awards.',
    ]],
  ],
  members: [
    ['Getting started', [
      'Sign in with Google, or create an account with the email you gave the club and click the verification link.',
      'Your account links to your member profile automatically. If it says "waiting to be linked", tell an officer which email you used.',
      'Install the app: Android menu ⋮ → Install app. iPhone (Safari): Share → Add to Home Screen.',
    ]],
    ['Your profile', [
      'More → My profile shows your Pathways, speeches, roles, attendance and awards.',
      'Pathways: tap ＋ Add path and choose the level you are working on.',
      'Speeches: tap ＋ Log a speech to record a speech, including ones at other clubs or contests.',
      'Roles: tap ＋ Log a role for roles you took elsewhere. The "Not yet tried" list suggests what to sign up for next.',
    ]],
    ['Meetings', [
      'Home shows the next meeting and your upcoming roles. Tap "Remind me before my roles" to get a reminder.',
      'Want a role? Open an upcoming meeting and tap "Ask for this role" on any open slot, or "Ask to evaluate" under a speaker. Home shows when it is approved.',
      'At the meeting, scan the check-in poster (or an officer\'s phone) with your phone camera and tap "Check me in". That\'s your attendance done.',
      'Voice log: say what you did ("I gave my Level 2 speech, 6 minutes, evaluated by Prasad") and save it to your log.',
    ]],
  ],
  guests: [
    ['Checking in', [
      'At the meeting, scan the check-in poster at the entrance (or the code on an officer\'s phone) with your phone camera.',
      'Tap "I am a guest", fill in your name and contact details, and tap Check in. No account or app needed.',
    ]],
    ['Seeing your visits', [
      'Want to see your visit history? Create an account with the same email you used to check in.',
      'After you verify your email, the app shows your visits and the next meeting.',
    ]],
    ['Joining the club', [
      'Tell the VP Membership or any officer that you would like to join. They will help with the membership form.',
      'Once you join, your guest account becomes a member account with your own Pathways and speech log.',
    ]],
  ],
}

const FAQ = [
  ['Who can see my details?', 'Members see the member list and meeting data. Guest contact details are visible to officers only. Guests see only their own visits.'],
  ['Does it work without internet?', 'Yes, for screens you have opened before. Changes you make offline are saved on your phone and sync when you reconnect.'],
  ['When does the check-in poster work?', 'On meeting days, from 1 hour before the meeting starts until 1 hour after it ends. On other days it says there is no meeting, so a photo of it is no use at home.'],
  ['I scanned and it says check-in is closed or the code changed', 'You may be outside meeting hours, or the poster was replaced with a new code. Ask the Sergeant at Arms to check you in from the Attendance tab.'],
  ['A blue bar says a new version is available', 'Tap Update. The app reloads with the latest version.'],
  ['Something looks wrong', 'Take a screenshot and send it to the President.'],
]

export default function About() {
  const { user, isAdmin, isMember } = useAuth()
  const club = useClub()
  const [tab, setTab] = useState(isAdmin ? 'officers' : isMember ? 'members' : 'guests')
  const signedIn = user && !user.isAnonymous

  return (
    <>
      {!signedIn && <p><Link to="/">← Back to sign in</Link></p>}
      <div className="card center">
        <img src={LOGO_URL} alt="Vision Toastmasters (Community Club), Club 991226, Hyderabad" className="club-logo" />
        <h1 style={{ marginTop: '.75rem' }}>Vision TM app</h1>
        <p style={{ margin: 0 }}>The club app of {club.name}</p>
        <p className="muted" style={{ margin: 0 }}>Club {club.number} · {club.area}, {club.division}, {club.district}</p>
      </div>

      <div className="card">
        <h2>What it does</h2>
        <p className="muted">One place for meeting roles, attendance, guests, speeches and Pathways progress, so officers spend less time on spreadsheets and members can see their own growth.</p>
        <ul className="list">
          {FEATURES.map(([icon, title, text]) => (
            <li key={title} style={{ alignItems: 'flex-start' }}>
              <span aria-hidden="true" style={{ fontSize: '1.3rem', width: 30, flex: 'none' }}>{icon}</span>
              <span className="grow"><b>{title}</b><br /><small>{text}</small></span>
            </li>
          ))}
        </ul>
      </div>

      <h2>How to use it</h2>
      <Tabs value={tab} onChange={setTab} tabs={[['officers', 'ExCom officers'], ['members', 'Members'], ['guests', 'Guests']]} />
      {GUIDES[tab].map(([title, steps], i) => (
        <details className="card" key={tab + title} open={i === 0}>
          <summary><b>{title}</b></summary>
          <ol style={{ margin: '.6rem 0 0', paddingLeft: '1.2rem' }}>
            {steps.map((s) => <li key={s} style={{ marginBottom: '.4rem' }}>{s}</li>)}
          </ol>
        </details>
      ))}

      <h2>Questions</h2>
      <div className="card">
        {FAQ.map(([q, a]) => (
          <details key={q} style={{ padding: '.4rem 0' }}>
            <summary><b>{q}</b></summary>
            <p className="muted" style={{ margin: '.3rem 0 0' }}>{a}</p>
          </details>
        ))}
      </div>

      <div className="card center">
        <p style={{ margin: 0 }}>Developed by <b>Sonu Singh Tomar</b></p>
      </div>
      <p className="footer-note">
        An independent club tool. Not an official Toastmasters International product.<br />
        The club logo belongs to Vision Toastmasters; no Toastmasters International logos are used.
      </p>
    </>
  )
}
