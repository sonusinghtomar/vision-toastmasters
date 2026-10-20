import { lazy, Suspense, useEffect, useState } from 'react'
import { HashRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { isConfigured } from './config'
import { AuthProvider, useAuth, logout } from './auth'
import { Icon, Loading } from './components/ui'
import Login from './pages/Login'
import Setup from './pages/Setup'
import Home from './pages/Home'
import CheckIn from './pages/CheckIn'
import Meetings from './pages/Meetings'
import MeetingDetail from './pages/MeetingDetail'
import Members from './pages/Members'
import MemberDetail from './pages/MemberDetail'
import Guests from './pages/Guests'
import GuestDetail from './pages/GuestDetail'
import Dcp from './pages/Dcp'
import Admin from './pages/Admin'
import Settings from './pages/Settings'
import More from './pages/More'

// Pages that pull in Gemini or the Excel writer load on demand.
const AgendaImport = lazy(() => import('./pages/AgendaImport'))
const VoiceLog = lazy(() => import('./pages/VoiceLog'))
const Reports = lazy(() => import('./pages/Reports'))

const ICON_URL = `${import.meta.env.BASE_URL}icon-192.png`

export default function App() {
  if (!isConfigured) return <Setup />
  return (
    <AuthProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AuthProvider>
  )
}

function Shell() {
  const { user, loading, isMember, isAdmin, role } = useAuth()
  const loc = useLocation()

  // The QR check-in page works for anyone, signed in or not.
  if (loc.pathname.startsWith('/checkin/')) {
    return <Frame><Routes><Route path="/checkin/:meetingId" element={<CheckIn />} /></Routes></Frame>
  }
  if (user === undefined || loading) return <Frame><Loading /></Frame>
  if (!user || user.isAnonymous) return <Frame><Login /></Frame>

  const officer = (el) => (isAdmin ? el : <Navigate to="/" replace />)
  const member = (el) => (isMember ? el : <Navigate to="/" replace />)
  return (
    <Frame nav={role !== 'pending'}>
      <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/meetings" element={<Meetings />} />
        <Route path="/meetings/import" element={officer(<AgendaImport />)} />
        <Route path="/meetings/:id" element={<MeetingDetail />} />
        <Route path="/members" element={member(<Members />)} />
        <Route path="/members/:id" element={member(<MemberDetail />)} />
        <Route path="/guests" element={officer(<Guests />)} />
        <Route path="/guests/:id" element={<GuestDetail />} />
        <Route path="/log" element={member(<VoiceLog />)} />
        <Route path="/reports" element={member(<Reports />)} />
        <Route path="/dcp" element={member(<Dcp />)} />
        <Route path="/admin" element={officer(<Admin />)} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/more" element={<More />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </Frame>
  )
}

function Frame({ children, nav = false }) {
  const { user, isMember, isAdmin } = useAuth()
  return (
    <>
      <header className="topbar">
        <img src={ICON_URL} alt="" />
        <span className="title">Vision Toastmasters</span>
        {user && !user.isAnonymous && <button className="small" onClick={logout}>Sign out</button>}
      </header>
      <UpdatePrompt />
      <main>{children}</main>
      {nav && (
        <nav className="bottomnav" aria-label="Main">
          <NavLink to="/" end><Icon name="home" />Home</NavLink>
          <NavLink to="/meetings"><Icon name="calendar" />Meetings</NavLink>
          {isAdmin && <NavLink to="/guests"><Icon name="people" />Guests</NavLink>}
          {isMember && !isAdmin && <NavLink to="/members"><Icon name="people" />Members</NavLink>}
          {isMember && <NavLink to="/log"><Icon name="mic" />Log</NavLink>}
          <NavLink to="/more"><Icon name="more" />More</NavLink>
        </nav>
      )}
    </>
  )
}

function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return (
    <>
      {offline && <div className="banner info" style={{ borderRadius: 0, margin: 0 }}>You are offline. Changes will sync when you reconnect.</div>}
      {needRefresh && (
        <div className="banner info row between" style={{ borderRadius: 0, margin: 0 }}>
          <span>A new version is available.</span>
          <button className="small primary" onClick={() => updateServiceWorker(true)}>Update</button>
        </div>
      )}
    </>
  )
}
