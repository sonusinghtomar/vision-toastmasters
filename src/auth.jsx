import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  updateProfile, signOut, signInAnonymously,
} from 'firebase/auth'
import { doc, onSnapshot, setDoc, updateDoc, getDocs, query, where, collection, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'
import { normEmail } from './data'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = still loading
  const [profile, setProfile] = useState(null)

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); if (!u) setProfile(null) }), [])

  useEffect(() => {
    if (!user || user.isAnonymous) return
    const r = doc(db, 'users', user.uid)
    let created = false
    return onSnapshot(r, async (snap) => {
      if (!snap.exists()) {
        if (created) return
        created = true
        await setDoc(r, {
          name: user.displayName || user.email?.split('@')[0] || 'Member',
          email: normEmail(user.email), role: 'pending', memberId: '', guestId: '',
          createdAt: serverTimestamp(),
        }).catch(console.error)
        return
      }
      const p = { id: snap.id, ...snap.data() }
      setProfile(p)
      if (p.role === 'pending') autoLink(user, p).catch(console.error)
    }, (e) => { console.error(e); setProfile({ role: 'pending', error: e.message }) })
  }, [user])

  const role = profile?.role || 'pending'
  const value = {
    user, profile, role,
    loading: user === undefined || (user && !user.isAnonymous && !profile),
    isSuper: role === 'superadmin',
    isAdmin: role === 'admin' || role === 'superadmin',
    isMember: ['member', 'admin', 'superadmin'].includes(role),
    isGuest: role === 'guest',
    memberId: profile?.memberId || '',
    guestId: profile?.guestId || '',
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

// If a member or guest record already carries this person's verified email, link it automatically.
async function autoLink(user, profile) {
  if (!user.email || !user.emailVerified) return
  const email = normEmail(user.email)
  const m = await getDocs(query(collection(db, 'members'), where('email', '==', email))).catch(() => null)
  if (m && !m.empty) {
    await updateDoc(doc(db, 'users', profile.id), { role: 'member', memberId: m.docs[0].id })
    return
  }
  const g = await getDocs(query(collection(db, 'guests'), where('email', '==', email))).catch(() => null)
  if (g && !g.empty) await updateDoc(doc(db, 'users', profile.id), { role: 'guest', guestId: g.docs[0].id })
}

export const googleSignIn = () => signInWithPopup(auth, new GoogleAuthProvider())
export const emailSignIn = (email, pw) => signInWithEmailAndPassword(auth, email.trim(), pw)
export async function emailSignUp(name, email, pw) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw)
  await updateProfile(cred.user, { displayName: name })
  await sendEmailVerification(cred.user)
  return cred
}
export const resendVerification = () => sendEmailVerification(auth.currentUser)
export const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim())
export const logout = () => signOut(auth)
export const anonymousSignIn = () => signInAnonymously(auth)
