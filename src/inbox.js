import { useEffect, useRef } from 'react'
import { useAuth } from './auth'
import { useList, useDoc, col, query, where } from './data'

// Meeting roles are allocated by the VP Education; the President is the backup.
export function useRoleApprover() {
  const { isSuper, isAdmin, memberId } = useAuth()
  const { data: me } = useDoc('members', isAdmin && !isSuper ? memberId : '')
  return isSuper || (isAdmin && me?.officerTitle === 'VP Education')
}

// What an officer needs to act on: people waiting for access (all officers) and
// pending role requests (VP Education and President only).
export function useInbox(enabled) {
  const approver = useRoleApprover()
  const roles = enabled && approver
  const users = useList(() => (enabled ? query(col('users'), where('role', '==', 'pending')) : null), [enabled])
  const requests = useList(() => (roles ? query(col('roleRequests'), where('status', '==', 'pending')) : null), [roles])
  const pendingUsers = users.data
  const roleRequests = [...requests.data].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  return { pendingUsers, roleRequests, approver, count: pendingUsers.length + roleRequests.length, loading: users.loading || requests.loading }
}

// While the app is open (even in a background tab), show a phone notification when
// something new arrives, if notifications are allowed for this device.
export function useInboxAlerts({ pendingUsers, roleRequests, loading }) {
  const seen = useRef(null)
  useEffect(() => {
    if (loading) return
    const ids = new Set([...pendingUsers.map((u) => 'u' + u.id), ...roleRequests.map((r) => 'r' + r.id)])
    if (seen.current) {
      const fresh = [...pendingUsers.filter((u) => !seen.current.has('u' + u.id)).map((u) => `${u.name || u.email} is waiting for access`),
        ...roleRequests.filter((r) => !seen.current.has('r' + r.id)).map((r) => `${r.name} asked for ${r.roleLabel}`)]
      if (fresh.length && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        navigator.serviceWorker?.getRegistration().then((reg) => {
          const body = fresh.join('\n')
          if (reg) reg.showNotification('Vision TM: needs your approval', { body, icon: 'icon-192.png', tag: 'inbox' })
          else new Notification('Vision TM: needs your approval', { body })
        })
      }
    }
    seen.current = ids
  }, [pendingUsers, roleRequests, loading])
}
