import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { Tabs, useClub } from '../components/ui'

const ICON_URL = `${import.meta.env.BASE_URL}icon-192.png`

const FEATURES = [
  ['📅', 'Meetings and agendas', 'Every role from SAA to Table Topics, prepared speakers with time slots, Pathways projects and evaluators.'],
  ['📄', 'Agenda import', 'Upload the agenda PDF or a photo. The app reads the theme, date and all roles for you to check and save.'],
  ['✅', 'Attendance', 'Officers tick members present, or everyone checks in by scanning the meeting QR code.'],
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
    ['Before the meeting', [
      'Go to Meetings → Import agenda, choose the agenda PDF or take a photo, and tap Read agenda.',
      'Check the roles. Tap "Add as member" for any name the app does not know yet, then Create meeting.',
      'No agenda yet? Use Meetings → ＋ New to get the standard Vision agenda and assign roles by hand.',
      'Open the meeting → Share → Send on WhatsApp to post the role list to the club group.',
    ]],
    ['At the meeting', [
      'Open the meeting → QR check-in → Open check-in. Tap the QR code to show it full screen.',
      'Members scan and tap "Check me in". Guests scan and fill a short form, no account needed.',
      'On the Attendance tab, tick anyone who did not scan, or tap "Mark all role-holders present".',
      'Close check-in when the meeting ends so the code stops working.',
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
      'Members → ＋ Add member with the email they sign in with, so their account links automatically.',
      'More → Users and access: link accounts to member or guest records. Only the President can make someone an Admin (officer).',
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
      'At the meeting, scan the QR code with your phone camera and tap "Check me in".',
      'Voice log: say what you did ("I gave my Level 2 speech, 6 minutes, evaluated by Prasad") and save it to your log.',
    ]],
  ],
  guests: [
    ['Checking in', [
      'At the meeting, scan the QR code shown by the Sergeant at Arms with your phone camera.',
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
        <img src={ICON_URL} alt="" width="64" height="64" style={{ borderRadius: 16 }} />
        <h1 style={{ marginTop: '.5rem' }}>Vision TM</h1>
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
        <p className="muted" style={{ margin: '.2rem 0 0' }}>for {club.name}</p>
      </div>
      <p className="footer-note">
        An independent club tool. Not an official Toastmasters International product.<br />
        The Toastmasters name and colours are used to identify our club; no Toastmasters logos are used.
      </p>
    </>
  )
}
