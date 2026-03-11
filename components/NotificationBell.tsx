'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { timeAgo, initials, avatarColor } from '@/lib/comment-utils'
import clsx from 'clsx'

interface Notification {
  id: string
  type: string
  source_id: string
  is_read: boolean
  created_at: string
  preview?: string
  link?: string
  author_name?: string
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // On mount: fetch unread count
  useEffect(() => {
    fetch('/api/notifications?countOnly=true')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data && typeof data.unread === 'number') setUnreadCount(data.unread) })
      .catch(() => {})
  }, [])

  // When dropdown opens: fetch full list; poll every 30s while open
  useEffect(() => {
    if (!isOpen) return

    const fetchList = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/notifications')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) setNotifications(data)
        }
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }

    fetchList()
    const interval = setInterval(fetchList, 30000)
    return () => clearInterval(interval)
  }, [isOpen])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const handleMarkAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      })
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch { /* silent */ }
  }, [])

  const handleNotificationClick = useCallback(async (notification: Notification) => {
    // Mark as read
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: notification.id }),
    }).catch(() => {})

    // Update local state
    setNotifications((prev) => prev.map((n) => n.id === notification.id ? { ...n, is_read: true } : n))
    setUnreadCount((prev) => Math.max(0, prev - (notification.is_read ? 0 : 1)))

    // Navigate
    if (notification.link) {
      window.location.href = notification.link
    }
    setIsOpen(false)
  }, [])

  const displayCount = unreadCount > 99 ? '99+' : unreadCount

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${displayCount} unread)` : ''}`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {displayCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white shadow-xl border border-gray-100 rounded-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          {loading && notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-gray-400">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400">No notifications yet</div>
          ) : (
            <div>
              {notifications.map((n) => {
                const authorName = n.author_name ?? 'Unknown'
                const ini = initials(authorName)
                const color = avatarColor(authorName)
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={clsx(
                      'w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0',
                      !n.is_read && 'bg-blue-50 border-l-2 border-l-blue-400'
                    )}
                  >
                    {/* Avatar */}
                    <div
                      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5"
                      style={{ backgroundColor: color }}
                    >
                      {ini}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {n.preview && (
                        <p className="text-xs text-gray-700 leading-snug line-clamp-2">{n.preview}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                    {/* Unread dot */}
                    {!n.is_read && (
                      <span className="shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
