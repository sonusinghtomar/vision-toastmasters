// Security rules tests. Run: npm run test:rules (needs Java for the Firestore emulator).
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where, addDoc, deleteDoc } from 'firebase/firestore'
import { readFileSync } from 'fs'

const env = await initializeTestEnvironment({
  projectId: 'demo-vtm',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
})
await env.withSecurityRulesDisabled(async (c) => {
  const d = c.firestore()
  await setDoc(doc(d, 'users/pres'), { role: 'superadmin', name: 'P' })
  await setDoc(doc(d, 'users/off'), { role: 'admin', name: 'O' })
  await setDoc(doc(d, 'users/mem'), { role: 'member', memberId: 'm1', name: 'M' })
  await setDoc(doc(d, 'users/gst'), { role: 'guest', guestId: 'g1', name: 'G' })
  await setDoc(doc(d, 'users/pend'), { role: 'pending', memberId: '', guestId: '' })
  await setDoc(doc(d, 'members/m1'), { name: 'Mem One', email: 'm1@x.com' })
  await setDoc(doc(d, 'members/m2'), { name: 'Mem Two', email: 'new@x.com' })
  await setDoc(doc(d, 'guests/g1'), { name: 'Guest', email: 'g@x.com' })
  await setDoc(doc(d, 'guests/g2'), { name: 'Other guest' })
  await setDoc(doc(d, 'meetings/mt'), { date: '2026-10-25' })
  await setDoc(doc(d, 'checkinCodes/mt'), { code: 'abc', open: true })
  await setDoc(doc(d, 'checkinCodes/closed'), { code: 'abc', open: false })
  await setDoc(doc(d, 'attendance/mt_g1'), { meetingId: 'mt', personType: 'guest', personId: 'g1' })
  await setDoc(doc(d, 'attendance/mt_g2'), { meetingId: 'mt', personType: 'guest', personId: 'g2' })
  await setDoc(doc(d, 'speeches/s2'), { memberId: 'm2' })
})
const as = (uid, token) => env.authenticatedContext(uid, token).firestore()
const pres = as('pres'), off = as('off'), mem = as('mem'), gst = as('gst')
const anon = as('anon', { firebase: { sign_in_provider: 'anonymous' } })
let pass = 0, fail = 0
async function t(name, p) { try { await p; pass++; } catch (e) { fail++; console.log('FAIL', name, e.message) } }

// users
await t('new user creates pending profile', assertSucceeds(setDoc(doc(as('n1'), 'users/n1'), { role: 'pending', name: 'x', memberId: '', guestId: '' })))
await t('new user cannot self-create as admin', assertFails(setDoc(doc(as('n2'), 'users/n2'), { role: 'admin' })))
await t('member cannot promote self', assertFails(updateDoc(doc(mem, 'users/mem'), { role: 'admin' })))
await t('member edits own name', assertSucceeds(updateDoc(doc(mem, 'users/mem'), { name: 'New' })))
await t('officer approves pending as member', assertSucceeds(updateDoc(doc(off, 'users/pend'), { role: 'member', memberId: 'm1' })))
await t('officer cannot grant admin', assertFails(updateDoc(doc(off, 'users/mem'), { role: 'admin' })))
await t('president grants admin', assertSucceeds(updateDoc(doc(pres, 'users/mem'), { role: 'admin' })))
await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'users/mem'), { role: 'member', memberId: 'm1', name: 'M' }))
await t('member cannot read other users', assertFails(getDoc(doc(mem, 'users/off'))))

// self-link by verified email
await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'users/nu'), { role: 'pending', memberId: '', guestId: '' }))
const nu = as('nu', { email: 'new@x.com', email_verified: true })
const nuBad = as('nu', { email: 'new@x.com', email_verified: false })
await t('pending can query member by own email', assertSucceeds(getDocs(query(collection(nu, 'members'), where('email', '==', 'new@x.com')))))
await t('pending cannot list all members', assertFails(getDocs(collection(nu, 'members'))))
await t('unverified cannot self-link', assertFails(updateDoc(doc(nuBad, 'users/nu'), { role: 'member', memberId: 'm2' })))
await t('cannot self-link to other email', assertFails(updateDoc(doc(nu, 'users/nu'), { role: 'member', memberId: 'm1' })))
await t('verified self-link to own member', assertSucceeds(updateDoc(doc(nu, 'users/nu'), { role: 'member', memberId: 'm2' })))

// members
await t('member reads roster', assertSucceeds(getDocs(collection(mem, 'members'))))
await t('guest cannot read roster', assertFails(getDocs(collection(gst, 'members'))))
await t('member updates own pathways', assertSucceeds(updateDoc(doc(mem, 'members/m1'), { pathways: [{ path: 'X' }] })))
await t('member cannot change own officer title', assertFails(updateDoc(doc(mem, 'members/m1'), { officerTitle: 'President' })))
await t('member cannot edit other member', assertFails(updateDoc(doc(mem, 'members/m2'), { phone: '1' })))
await t('officer adds member', assertSucceeds(addDoc(collection(off, 'members'), { name: 'Z' })))

// guests
await t('member cannot read guests', assertFails(getDocs(collection(mem, 'guests'))))
await t('guest reads own record', assertSucceeds(getDoc(doc(gst, 'guests/g1'))))
await t('guest cannot read other guest', assertFails(getDoc(doc(gst, 'guests/g2'))))
await t('guest reads own attendance', assertSucceeds(getDocs(query(collection(gst, 'attendance'), where('personType', '==', 'guest'), where('personId', '==', 'g1')))))
await t('guest cannot read all attendance', assertFails(getDocs(collection(gst, 'attendance'))))

// QR check-in
const ci = (c, meetingId, code, uid) => addDoc(collection(c, 'checkins'), { meetingId, code, name: 'Ravi', phone: '1', uid, at: new Date() })
await t('anonymous guest checks in with code', assertSucceeds(ci(anon, 'mt', 'abc', 'anon')))
await t('wrong code rejected', assertFails(ci(anon, 'mt', 'zzz', 'anon')))
await t('closed check-in rejected', assertFails(ci(anon, 'closed', 'abc', 'anon')))
await t('unauthenticated rejected', assertFails(ci(env.unauthenticatedContext().firestore(), 'mt', 'abc', 'x')))
await t('anon cannot read checkins', assertFails(getDocs(collection(anon, 'checkins'))))
await t('anon cannot read code', assertFails(getDoc(doc(anon, 'checkinCodes/mt'))))
await t('anon can read meeting', assertSucceeds(getDoc(doc(anon, 'meetings/mt'))))
const selfAtt = (code, pid = 'm1', id = 'mt_m1') => setDoc(doc(mem, 'attendance/' + id), { meetingId: 'mt', personType: 'member', personId: pid, method: 'qr', code })
await t('member QR self check-in', assertSucceeds(selfAtt('abc')))
await t('member cannot check in others', assertFails(selfAtt('abc', 'm2', 'mt_m2')))
await t('member wrong code rejected', assertFails(selfAtt('bad', 'm1', 'mt_m1')))
await t('member cannot mark attendance as officer', assertFails(setDoc(doc(mem, 'attendance/mt_x'), { meetingId: 'mt', personType: 'member', personId: 'm2', method: 'officer' })))

// speeches & roles
await t('member logs own speech', assertSucceeds(addDoc(collection(mem, 'speeches'), { memberId: 'm1' })))
await t('member cannot log speech for other', assertFails(addDoc(collection(mem, 'speeches'), { memberId: 'm2' })))
await t('member cannot delete others speech', assertFails(deleteDoc(doc(mem, 'speeches/s2'))))
await t('member logs own role', assertSucceeds(addDoc(collection(mem, 'roleLog'), { personId: 'm1' })))
await t('member cannot add edu award', assertFails(addDoc(collection(mem, 'eduAwards'), { memberId: 'm1' })))
await t('officer adds edu award', assertSucceeds(addDoc(collection(off, 'eduAwards'), { memberId: 'm1' })))
await t('member cannot edit meeting', assertFails(updateDoc(doc(mem, 'meetings/mt'), { theme: 'x' })))
await t('officer cannot change club settings', assertFails(setDoc(doc(off, 'settings/club'), { name: 'x' })))
await t('president changes club settings', assertSucceeds(setDoc(doc(pres, 'settings/club'), { name: 'x' })))

// permanent printed poster (club code, valid only in the meeting's check-in window)
const hr = 3600 * 1000
await env.withSecurityRulesDisabled(async (c) => {
  const d = c.firestore()
  await setDoc(doc(d, 'checkinCodes/_club'), { code: 'club1', enabled: true })
  await setDoc(doc(d, 'meetings/now'), { date: 'x', checkinStart: new Date(Date.now() - hr), checkinEnd: new Date(Date.now() + hr) })
  await setDoc(doc(d, 'meetings/later'), { date: 'y', checkinStart: new Date(Date.now() + 24 * hr), checkinEnd: new Date(Date.now() + 26 * hr) })
  await setDoc(doc(d, 'meetings/nowindow'), { date: 'z' })
})
await t('poster: guest checks in during the meeting window', assertSucceeds(ci(anon, 'now', 'club1', 'anon')))
await t('poster: rejected outside the window (another day)', assertFails(ci(anon, 'later', 'club1', 'anon')))
await t('poster: rejected for a meeting without a window', assertFails(ci(anon, 'nowindow', 'club1', 'anon')))
await t('poster: wrong club code rejected', assertFails(ci(anon, 'now', 'nope', 'anon')))
await t('poster: cannot use the club doc as a meeting', assertFails(ci(anon, '_club', 'club1', 'anon')))
await t('poster: member self check-in in window', assertSucceeds(setDoc(doc(mem, 'attendance/now_m1'), { meetingId: 'now', personType: 'member', personId: 'm1', method: 'qr', code: 'club1' })))
await t('poster: member cannot read the club code', assertFails(getDoc(doc(mem, 'checkinCodes/_club'))))
await t('poster: officer can read the club code', assertSucceeds(getDoc(doc(off, 'checkinCodes/_club'))))
await t('poster: member cannot set a meeting window', assertFails(updateDoc(doc(mem, 'meetings/later'), { checkinStart: new Date() })))
await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'checkinCodes/_club'), { enabled: false }))
await t('poster: switched off → rejected', assertFails(ci(anon, 'now', 'club1', 'anon')))
await t('per-meeting QR still works', assertSucceeds(ci(anon, 'mt', 'abc', 'anon')))

// role requests
const rq = (c, memberId, extra = {}) => addDoc(collection(c, 'roleRequests'), { meetingId: 'mt', slotKey: 'tmod_1', part: 'person', role: 'tmod', roleLabel: 'TMOD', memberId, name: 'M', note: '', status: 'pending', createdAt: new Date(), ...extra })
await t('member requests a role for self', assertSucceeds(rq(mem, 'm1')))
await t('member cannot request for someone else', assertFails(rq(mem, 'm2')))
await t('member cannot create an approved request', assertFails(rq(mem, 'm1', { status: 'approved' })))
await t('guest cannot request a role', assertFails(rq(gst, 'g1')))
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'roleRequests/r1'), { memberId: 'm1', status: 'pending' }); await setDoc(doc(c.firestore(), 'roleRequests/r2'), { memberId: 'm2', status: 'pending' }) })
await t('member lists own requests', assertSucceeds(getDocs(query(collection(mem, 'roleRequests'), where('memberId', '==', 'm1')))))
await t("member cannot read others' requests", assertFails(getDoc(doc(mem, 'roleRequests/r2'))))
await t('member cannot approve own request', assertFails(updateDoc(doc(mem, 'roleRequests/r1'), { status: 'approved' })))
await t('other ExCom admin cannot approve (VP Education decides)', assertFails(updateDoc(doc(off, 'roleRequests/r2'), { status: 'approved' })))
await t('other ExCom admin cannot see role requests', assertFails(getDoc(doc(off, 'roleRequests/r2'))))
await env.withSecurityRulesDisabled(async (c) => {
  await setDoc(doc(c.firestore(), 'members/mv'), { name: 'VPE', officerTitle: 'VP Education' })
  await setDoc(doc(c.firestore(), 'users/vpe'), { role: 'admin', memberId: 'mv' })
  await setDoc(doc(c.firestore(), 'users/vpeNoAdmin'), { role: 'member', memberId: 'mv' })
})
await t('VP Education (Admin) approves a request', assertSucceeds(updateDoc(doc(as('vpe'), 'roleRequests/r2'), { status: 'approved' })))
await t('VP Education reads all requests', assertSucceeds(getDocs(collection(as('vpe'), 'roleRequests'))))
await t('VP Education without Admin cannot approve', assertFails(updateDoc(doc(as('vpeNoAdmin'), 'roleRequests/r2'), { status: 'declined' })))
await t('President (backup) approves a request', assertSucceeds(updateDoc(doc(pres, 'roleRequests/r2'), { status: 'declined' })))
await t('member cannot give themselves the VP Education title', assertFails(updateDoc(doc(mem, 'members/m1'), { officerTitle: 'VP Education' })))
await t('member cancels own pending request', assertSucceeds(deleteDoc(doc(mem, 'roleRequests/r1'))))
await t('member records own last backup date', assertSucceeds(updateDoc(doc(mem, 'users/mem'), { lastBackup: '2026-11-05' })))

console.log(`\n${pass} passed, ${fail} failed`)
await env.cleanup()
process.exit(fail ? 1 : 0)
