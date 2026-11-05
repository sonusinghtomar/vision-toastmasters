import { useEffect, useRef } from 'react'
import { useList, col, query, where } from './data'

// What officers need to act on: people waiting for access and pending role requests.
export function useInbox(enabled) {
  const users = useList(() => (enabled ? query(col('users'), where('role', '==', 'pending')) : null), [enabled])
  const requests = useList(() => (enabled ? query(col('roleRequests'), where('status', '==', 'pending')) : null), [enabled])
  const pendingUsers = users.data
  const roleRequests = [...requests.data].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  return { pendingUsers, roleRequests, count: pendingUsers.length + roleRequests.length, loading: users.loading || requests.loading }
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
