'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  LogOut,
  Tag,
  Package,
  Sparkles,
  Save,
  Loader2,
  Bell,
  Check,
  X,
} from 'lucide-react'
import { useCustomer } from '@/lib/customer-context'
import { updateCustomer, Customer, getCustomerNotifications, markNotificationRead, markAllNotificationsRead, Notification } from '@/lib/customers'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['Zapatillas', 'Perfumes', 'Accesorios']
const BRANDS = ['Nike', 'Adidas', 'Jordan', 'New Balance', 'Puma', 'Asics', 'Yeezy']
const SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45']

export default function AccountPage() {
  const { customer, isLoading, isAuthenticated, refresh } = useCustomer()
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [preferredGender, setPreferredGender] = useState('')
  const [preferredCategories, setPreferredCategories] = useState<string[]>([])
  const [preferredBrands, setPreferredBrands] = useState<string[]>([])
  const [preferredSizes, setPreferredSizes] = useState<string[]>([])
  const [notifyOffers, setNotifyOffers] = useState(true)
  const [notifyOrders, setNotifyOrders] = useState(true)
  const [notifyNewArrivals, setNotifyNewArrivals] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'profile' | 'prefs' | 'notifications'>('profile')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (customer) {
      setName(customer.name || '')
      setPhone(customer.phone || '')
      setPreferredGender(customer.preferred_gender || '')
      setPreferredCategories(customer.preferred_categories || [])
      setPreferredBrands(customer.preferred_brands || [])
      setPreferredSizes(customer.preferred_sizes || [])
      setNotifyOffers(customer.notify_offers ?? true)
      setNotifyOrders(customer.notify_orders ?? true)
      setNotifyNewArrivals(customer.notify_new_arrivals ?? true)
    }
  }, [customer])

  useEffect(() => {
    if (customer && activeTab === 'notifications') {
      loadNotifications()
    }
  }, [customer, activeTab])

  const loadNotifications = async () => {
    if (!customer) return
    const [notifs, count] = await Promise.all([
      getCustomerNotifications(customer.id),
      getCustomerNotifications(customer.id).then((n) => n.filter((x) => !x.is_read).length),
    ])
    setNotifications(notifs)
    setUnreadCount(count)
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

  const toggleInArray = (arr: string[], val: string, setFn: (v: string[]) => void) => {
    setFn(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val])
  }

  const handleSaveProfile = async () => {
    if (!customer) return
    setIsSaving(true)
    setSaveMsg(null)
    const ok = await updateCustomer(customer.id, { name, phone })
    if (ok) {
      setSaveMsg('Perfil actualizado correctamente.')
      await refresh()
    } else {
      setSaveMsg('Error al guardar. Intenta de nuevo.')
    }
    setIsSaving(false)
    setTimeout(() => setSaveMsg(null), 3000)
  }

  const handleSavePrefs = async () => {
    if (!customer) return
    setIsSaving(true)
    setSaveMsg(null)
    const ok = await updateCustomer(customer.id, {
      preferred_gender: preferredGender || null,
      preferred_categories: preferredCategories,
      preferred_brands: preferredBrands,
      preferred_sizes: preferredSizes,
      notify_offers: notifyOffers,
      notify_orders: notifyOrders,
      notify_new_arrivals: notifyNewArrivals,
    } as Partial<Customer>)
    if (ok) {
      setSaveMsg('Preferencias guardadas correctamente.')
      await refresh()
    } else {
      setSaveMsg('Error al guardar. Intenta de nuevo.')
    }
    setIsSaving(false)
    setTimeout(() => setSaveMsg(null), 3000)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated || !customer) return null

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        {/* Header de la cuenta */}
        <div className="mb-8 flex flex-col gap-4 border-b border-neutral-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <User className="size-8 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-black uppercase tracking-wide text-white">
                {customer.name}
              </h1>
              <p className="text-sm text-neutral-400">{customer.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 px-4 py-2.5 text-xs font-bold uppercase text-neutral-300 transition hover:border-red-500 hover:text-red-400"
          >
            <LogOut className="size-4" />
            Cerrar sesión
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-8 grid grid-cols-3 gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-1">
          {[
            { key: 'profile', label: 'Perfil', icon: User },
            { key: 'prefs', label: 'Preferencias', icon: Tag },
            { key: 'notifications', label: unreadCount > 0 ? `Notificaciones (${unreadCount})` : 'Notificaciones', icon: Bell },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                  activeTab === tab.key ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Save message */}
        {saveMsg && (
          <div className={`mb-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${
            saveMsg.includes('Error')
              ? 'border-red-500/30 bg-red-500/10 text-red-400'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          }`}>
            {saveMsg.includes('Error') ? <X className="size-4" /> : <Check className="size-4" />}
            {saveMsg}
          </div>
        )}

        {/* ── PERFIL ── */}
        {activeTab === 'profile' && (
          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white outline-none transition focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400">Correo electrónico</label>
              <input
                type="email"
                value={customer.email || ''}
                disabled
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-500 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400">WhatsApp</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0412-0000000"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 font-mono text-sm text-white placeholder-neutral-600 outline-none transition focus:border-primary"
              />
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-heading text-xs font-black uppercase tracking-widest text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Guardar perfil
            </button>
          </div>
        )}

        {/* ── PREFERENCIAS ── */}
        {activeTab === 'prefs' && (
          <div className="space-y-6">
            {/* Género */}
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-400">Género</label>
              <div className="flex gap-2">
                {['', 'hombre', 'mujer', 'unisex'].map((g) => (
                  <button
                    key={g || 'all'}
                    onClick={() => setPreferredGender(g)}
                    className={`rounded-xl border px-4 py-2.5 text-xs font-bold uppercase transition ${
                      preferredGender === g
                        ? 'border-primary bg-primary text-white'
                        : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500'
                    }`}
                  >
                    {g || 'Todos'}
                  </button>
                ))}
              </div>
            </div>

            {/* Categorías */}
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-400">Categorías favoritas</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleInArray(preferredCategories, c, setPreferredCategories)}
                    className={`rounded-xl border px-4 py-2.5 text-xs font-bold uppercase transition ${
                      preferredCategories.includes(c)
                        ? 'border-primary bg-primary text-white'
                        : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Marcas */}
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-400">Marcas favoritas</label>
              <div className="flex flex-wrap gap-2">
                {BRANDS.map((b) => (
                  <button
                    key={b}
                    onClick={() => toggleInArray(preferredBrands, b, setPreferredBrands)}
                    className={`rounded-xl border px-4 py-2.5 text-xs font-bold uppercase transition ${
                      preferredBrands.includes(b)
                        ? 'border-primary bg-primary text-white'
                        : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Tallas */}
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-400">Tallas que usas</label>
              <div className="flex flex-wrap gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleInArray(preferredSizes, s, setPreferredSizes)}
                    className={`min-w-[48px] rounded-xl border px-3.5 py-2.5 text-sm font-bold transition ${
                      preferredSizes.includes(s)
                        ? 'border-primary bg-primary text-white'
                        : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Notificaciones */}
            <div className="space-y-3 border-t border-neutral-800 pt-5">
              <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Notificaciones
              </label>
              {[
                { label: 'Ofertas y descuentos', value: notifyOffers, set: setNotifyOffers },
                { label: 'Estado de mis pedidos', value: notifyOrders, set: setNotifyOrders },
                { label: 'Nuevos productos', value: notifyNewArrivals, set: setNotifyNewArrivals },
              ].map((opt) => (
                <label key={opt.label} className="flex cursor-pointer items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3">
                  <span className="text-sm font-bold text-neutral-300">{opt.label}</span>
                  <button
                    type="button"
                    onClick={() => opt.set(!opt.value)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${opt.value ? 'bg-primary' : 'bg-neutral-700'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${opt.value ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </label>
              ))}
            </div>

            <button
              onClick={handleSavePrefs}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-heading text-xs font-black uppercase tracking-widest text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Guardar preferencias
            </button>
          </div>
        )}

        {/* ── NOTIFICACIONES ── */}
        {activeTab === 'notifications' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-neutral-400">
                {notifications.length > 0
                  ? `${notifications.length} notificaciones (${unreadCount} sin leer)`
                  : 'Sin notificaciones'}
              </p>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="inline-flex items-center gap-1 text-xs font-bold uppercase text-primary transition hover:text-primary/80"
                >
                  <Check className="size-3.5" />
                  Marcar todas leídas
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Bell className="size-12 text-neutral-600" />
                <p className="text-sm font-bold text-neutral-400">No tienes notificaciones</p>
                <p className="text-xs text-neutral-500">Te avisaremos cuando haya ofertas o novedades.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => {
                  const IconMap: Record<string, any> = { offer: Tag, order: Package, new_arrival: Sparkles, system: Bell }
                  const Icon = IconMap[n.type] || Bell
                  return (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && handleMarkRead(n.id)}
                      className={`flex cursor-pointer gap-4 rounded-xl border p-4 transition hover:bg-white/[0.02] ${
                        n.is_read ? 'border-neutral-800 opacity-50' : 'border-neutral-700 bg-neutral-950'
                      }`}
                    >
                      <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-white">{n.title}</p>
                          {!n.is_read && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
                        </div>
                        {n.message && <p className="mt-1 text-xs text-neutral-400">{n.message}</p>}
                        <p className="mt-2 font-mono text-[10px] text-neutral-500">
                          {new Date(n.created_at).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
