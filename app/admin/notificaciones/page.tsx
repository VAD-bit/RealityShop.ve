'use client'

import { useState, useEffect } from 'react'
import {
  Send,
  Loader2,
  Check,
  Users,
  Tag,
  Package,
  Sparkles,
  Settings,
  Bell,
  User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getAllCustomers, sendNotification, Customer } from '@/lib/customers'

const NOTIFICATION_TYPES = [
  { key: 'offer', label: 'Oferta / Descuento', icon: Tag, color: 'bg-red-500/10 text-red-400' },
  { key: 'new_arrival', label: 'Nuevo producto', icon: Sparkles, color: 'bg-sky-500/10 text-sky-400' },
  { key: 'order', label: 'Estado de pedido', icon: Package, color: 'bg-emerald-500/10 text-emerald-400' },
  { key: 'system', label: 'Sistema / General', icon: Settings, color: 'bg-neutral-500/10 text-neutral-400' },
] as const

export default function AdminNotificationsPage() {
  const supabase = createClient()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sendToAll, setSendToAll] = useState(true)
  const [type, setType] = useState<'offer' | 'new_arrival' | 'order' | 'system'>('offer')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    const data = await getAllCustomers()
    setCustomers(data)
    setIsLoading(false)
  }

  const toggleCustomer = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleSend = async () => {
    if (!title.trim()) {
      alert('El título es obligatorio.')
      return
    }

    setIsSending(true)
    setSendResult(null)

    const count = await sendNotification({
      customerIds: sendToAll ? undefined : selectedIds,
      type,
      title: title.trim(),
      message: message.trim() || undefined,
      link: link.trim() || undefined,
    })

    setIsSending(false)
    if (count > 0) {
      setSendResult(`✅ Notificación enviada a ${count} cliente(s).`)
      setTitle('')
      setMessage('')
      setLink('')
      setSelectedIds([])
    } else {
      setSendResult('❌ Error al enviar o no hay clientes destinatarios.')
    }
    setTimeout(() => setSendResult(null), 5000)
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-black uppercase tracking-wide text-white">
            Notificaciones a clientes
          </h1>
          <p className="text-sm text-neutral-400">
            Envía avisos de ofertas, novedades o estados de pedido a tus clientes registrados.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5">
          <Users className="size-4 text-primary" />
          <span className="font-mono text-sm font-bold text-white">{customers.length}</span>
          <span className="text-xs text-neutral-400">clientes registrados</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulario */}
        <div className="space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-6 lg:col-span-2">
          {/* Tipo */}
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Tipo de notificación
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {NOTIFICATION_TYPES.map((t) => {
                const Icon = t.icon
                return (
                  <button
                    key={t.key}
                    onClick={() => setType(t.key)}
                    className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center transition ${
                      type === t.key
                        ? 'border-primary bg-primary/10'
                        : 'border-neutral-700 bg-neutral-800 hover:border-neutral-500'
                    }`}
                  >
                    <div className={`flex size-10 items-center justify-center rounded-lg ${t.color}`}>
                      <Icon className="size-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase text-neutral-300">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Título *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="¡Oferta especial en zapatillas!"
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-primary"
            />
          </div>

          {/* Mensaje */}
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Mensaje
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descripción de la oferta o novedad..."
              rows={3}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-primary"
            />
          </div>

          {/* Link */}
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Link (opcional)
            </label>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://tutienda.com/ofertas"
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-primary"
            />
          </div>

          {/* Destinatarios */}
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Destinatarios
            </label>
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => setSendToAll(true)}
                className={`rounded-xl border px-4 py-2.5 text-xs font-bold uppercase transition ${
                  sendToAll ? 'border-primary bg-primary text-white' : 'border-neutral-700 bg-neutral-800 text-neutral-300'
                }`}
              >
                Todos los clientes
              </button>
              <button
                onClick={() => setSendToAll(false)}
                className={`rounded-xl border px-4 py-2.5 text-xs font-bold uppercase transition ${
                  !sendToAll ? 'border-primary bg-primary text-white' : 'border-neutral-700 bg-neutral-800 text-neutral-300'
                }`}
              >
                Seleccionar ({selectedIds.length})
              </button>
            </div>

            {!sendToAll && (
              <div className="max-h-60 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950">
                {customers.length === 0 ? (
                  <p className="p-4 text-center text-xs text-neutral-500">No hay clientes registrados.</p>
                ) : (
                  customers.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-3 border-b border-white/5 px-4 py-3 transition hover:bg-white/[0.02]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => toggleCustomer(c.id)}
                        className="size-4 accent-primary"
                      />
                      <div className="flex size-8 items-center justify-center rounded-full bg-neutral-800">
                        <User className="size-4 text-neutral-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-white">{c.name}</p>
                        <p className="truncate text-[10px] text-neutral-500">{c.email}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Resultado */}
          {sendResult && (
            <p className={`rounded-xl border px-4 py-3 text-sm font-bold ${
              sendResult.startsWith('✅')
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}>
              {sendResult}
            </p>
          )}

          {/* Botón enviar */}
          <button
            onClick={handleSend}
            disabled={isSending || !title.trim() || (!sendToAll && selectedIds.length === 0)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-heading text-sm font-black uppercase tracking-widest text-white transition hover:bg-primary/90 disabled:opacity-50"
          >
            {isSending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="size-4" />
                Enviar notificación
              </>
            )}
          </button>
        </div>

        {/* Preview */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <h3 className="mb-4 font-heading text-xs font-black uppercase tracking-wider text-neutral-400">
            Vista previa
          </h3>
          <div className="rounded-xl border border-neutral-700 bg-neutral-950 p-4">
            <div className="flex gap-3">
              <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                {(() => {
                  const t = NOTIFICATION_TYPES.find((x) => x.key === type)
                  const Icon = t?.icon || Bell
                  return <Icon className="size-5 text-primary" />
                })()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">{title || 'Título de la notificación'}</p>
                {message && <p className="mt-1 text-xs text-neutral-400">{message}</p>}
                <p className="mt-2 font-mono text-[10px] text-neutral-500">Ahora</p>
              </div>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-neutral-500">
            Los clientes verán esta notificación en la campana 🔔 de su cuenta.
          </p>
        </div>
      </div>
    </div>
  )
}
