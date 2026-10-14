'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Check, CheckCheck, Package, Tag, Sparkles, Settings } from 'lucide-react'
import { useCustomer } from '@/lib/customer-context'
import {
  Notification,
  getCustomerNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/customers'

const TYPE_ICONS: Record<string, any> = {
  offer: Tag,
  order: Package,
  new_arrival: Sparkles,
  system: Settings,
}

const TYPE_COLORS: Record<string, string> = {
  offer: 'text-red-400 bg-red-500/10',
  order: 'text-emerald-400 bg-emerald-500/10',
  new_arrival: 'text-sky-400 bg-sky-500/10',
  system: 'text-neutral-400 bg-neutral-500/10',
}

export function NotificationBell() {
  const { customer, isAuthenticated } = useCustomer()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!customer) {
      setNotifications([])
      setUnreadCount(0)
      return
    }
    loadNotifications()
  }, [customer])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const loadNotifications = async () => {
    if (!customer) return
    const [notifs, count] = await Promise.all([
      getCustomerNotifications(customer.id),
      getCustomerNotifications(customer.id).then((n) => n.filter((x) => !x.is_read).length),
    ])
    setNotifications(notifs)
    setUnreadCount(count)
  }

  const handleToggle = async () => {
    setIsOpen(!isOpen)
  }

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  const handleMarkAll = async () => {
    if (!customer) return
    await markAllNotificationsRead(customer.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  if (!isAuthenticated) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleToggle}
        className="relative rounded-full border border-white/10 bg-white/[0.04] p-2.5 text-foreground/70 transition hover:border-primary/40 hover:text-foreground"
        aria-label="Notificaciones"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 font-mono text-[9px] font-black text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <h4 className="font-heading text-xs font-black uppercase tracking-wider text-white">
              Notificaciones
            </h4>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-400 transition hover:text-red-300"
              >
                <CheckCheck className="size-3" />
                Marcar leídas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Bell className="size-8 text-neutral-600" />
                <p className="text-xs font-bold text-neutral-400">Sin notificaciones</p>
                <p className="text-[11px] text-neutral-500">Te avisaremos cuando haya novedades.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] || Settings
                const colorClass = TYPE_COLORS[n.type] || TYPE_COLORS.system
                return (
                  <button
                    key={n.id}
                    onClick={() => !n.is_read && handleMarkRead(n.id)}
                    className={`flex w-full gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/[0.03] ${
                      n.is_read ? 'opacity-50' : ''
                    }`}
                  >
                    <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white">{n.title}</p>
                      {n.message && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-400">{n.message}</p>
                      )}
                      <p className="mt-1 font-mono text-[9px] text-neutral-600">
                        {new Date(n.created_at).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-red-500" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
