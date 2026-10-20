# Vision Toastmasters Club app

A Progressive Web App for **Vision Toastmasters Club** (Club 991226, Area 02, Division F, District 126, Hyderabad). It tracks meeting attendance, guests, speeches, meeting roles, Pathways progress, awards and the Distinguished Club Program.

**Live app:** https://sonusinghtomar.github.io/vision-toastmasters/ · **First-time setup:** [docs/SETUP.md](docs/SETUP.md)

Install it on a phone from the browser ("Add to Home screen"). It keeps working offline and syncs when back online.

## What it does

| Area | Features |
| --- | --- |
| **Meetings** | Club agenda with every role (SAA, Presiding Officer, TMOD, GE, Timer, Ah Counter, Grammarian, Listener, Ballot Counter, Photographer, Table Topics), prepared speakers with time window, Pathways project and evaluator |
| **Agenda import** | Upload the agenda PDF or a photo. Gemini reads the meeting number, theme, date and roles and matches names to members, and you review before saving |
| **Voice log** | Speak or type a note ("Suhair did Ice Breaker, 6:40, evaluated by Prasad; guest Ravi from Meetup; best speaker Pavani"). It becomes attendance, speeches, roles, awards and guest records after you review it |
| **Attendance** | Officer tick list, "mark all role-holders present", and **QR self check-in** for members and guests |
| **Guests** | Check-in form (name, phone, email, how they heard, interest), visit count, follow-up status and notes, next follow-up date, one-tap call/WhatsApp/email, convert to member |
| **Education** | Pathways paths and levels, speech log with evaluation notes, role history with "not yet tried" hints, education awards |
| **Awards & DCP** | Best Speaker, Best Evaluator, Best Role Player (Main and Auxiliary), Best Listener, Best Table Topics. DCP goals counted automatically from awards and new members |
| **Reports** | Attendance % per member, speeches and role rotation, and a one-click **Excel** workbook (or CSV) |
| **Reminders** | Role reminders on the device, "Add to calendar" (.ics), WhatsApp role list |

## Who can do what

| | President | Officers | Members | Guests |
| --- | :-: | :-: | :-: | :-: |
| Grant officer rights, club settings | ✓ | | | |
| Meetings, attendance, guests, imports | ✓ | ✓ | | |
| See roster, agendas, reports | ✓ | ✓ | ✓ | |
| Edit own phone, Pathways, speeches, roles | ✓ | ✓ | ✓ | |
| See own visits | | | | ✓ |

The rules are enforced server-side in [`firestore.rules`](firestore.rules) and covered by tests in [`tests/rules.test.mjs`](tests/rules.test.mjs).

## Tech

React and Vite, `vite-plugin-pwa`, and Firebase (Auth, Firestore with offline cache, AI Logic with Gemini). It is hosted on GitHub Pages and deployed by GitHub Actions on every push to `main`.

```
src/
  config.js        Firebase config and Gemini model (edit this)
  data.js          Firestore helpers, meeting → speech/role sync, attendance
  ai.js            Agenda and voice-note parsing with Gemini
  pages/           Screens
firestore.rules    Security rules (publish in the Firebase console)
docs/SETUP.md      Setup guide
```

## Brand note

The app uses the Toastmasters brand colours only. It does not use the Toastmasters logo or any other trademarked artwork; the "V" icon is original. This is an independent club tool, not an official Toastmasters International product.
