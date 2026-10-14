'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  MessageCircle,
  MapPin,
  Store,
  Phone,
  Camera,
  ExternalLink,
  Search,
  User,
  StickyNote,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Wallet,
} from 'lucide-react'
import {
  getOrders,
  groupOrdersByRef,
  updateOrderByRef,
  GroupedOrder,
  OrderStatus,
  buildWhatsAppVerifyMessage,
  buildWhatsAppErrorMessage,
  openWhatsApp,
  getGoogleMapsUrl,
  getGoogleMapsEmbedUrl,
} from '@/lib/orders'

type Tab = 'pending_review' | 'verified' | 'payment_error' | 'all'

const TABS: { id: Tab; label: string; icon: any; color: string }[] = [
  { id: 'pending_review', label: 'Pendientes', icon: Clock, color: 'text-amber-400' },
  { id: 'verified', label: 'Verificados', icon: CheckCircle, color: 'text-emerald-400' },
  { id: 'payment_error', label: 'Error de Pago', icon: XCircle, color: 'text-rose-400' },
  { id: 'all', label: 'Todos', icon: Package, color: 'text-sky-400' },
]

export function OrdersPanel({
  advisorFilter,
  isLoadingProfile = false,
  title = 'Gestión de Pedidos',
}: {
  advisorFilter?: string
  isLoadingProfile?: boolean
  title?: string
}) {
  const [orders, setOrders] = useState<GroupedOrder[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<Tab>('pending_review')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [processingRef, setProcessingRef] = useState<string | null>(null)
  const [viewingScreenshot, setViewingScreenshot] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setIsLoading(true)
    try {
      const rows = await getOrders()
      setOrders(groupOrdersByRef(rows))
    } catch (error) {
      console.error('Error cargando pedidos:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Si se pasa advisorFilter, solo los pedidos de ese asesor
  const visibleOrders =
    advisorFilter !== undefined
      ? advisorFilter.trim() === ''
        ? []
        : orders.filter((o) => o.advisor_name === advisorFilter)
      : orders

  const filteredOrders = visibleOrders.filter((o) => {
    const matchesTab = activeTab === 'all' ? true : o.order_status === activeTab
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      !term ||
      o.customer_name.toLowerCase().includes(term) ||
      o.sale_ref.toLowerCase().includes(term) ||
      o.advisor_name.toLowerCase().includes(term) ||
      (o.payment_reference || '').toLowerCase().includes(term) ||
      o.product_names.toLowerCase().includes(term)
    return matchesTab && matchesSearch
  })

  const pendingCount = visibleOrders.filter((o) => o.order_status === 'pending_review').length

  async function handleVerify(order: GroupedOrder) {
    const ok = confirm(
      `¿Confirmas que recibiste el pago de $${order.total.toFixed(2)} vía ${order.payment_method}?\n\n` +
        `Referencia: ${order.payment_reference || '—'}\n\n` +
        `Verifica contra tu notificación bancaria ANTES de aceptar.`
    )
    if (!ok) return

    setProcessingRef(order.sale_ref)
    try {
      const result = await updateOrderByRef(order.sale_ref, 'verified', 'pagado')
      if (!result.ok) {
        alert(`Error: ${result.error}`)
        return
      }
      await fetchOrders()

      // Abrir WhatsApp con mensaje de verificación
      if (order.customer_phone) {
        const msg = buildWhatsAppVerifyMessage(order)
        openWhatsApp(order.customer_phone, msg)
      } else {
        alert('Pedido verificado. El cliente no tiene WhatsApp registrado — no se pudo enviar el mensaje.')
      }
    } finally {
      setProcessingRef(null)
    }
  }

  async function handlePaymentError(order: GroupedOrder) {
    const notes = prompt(
      'Motivo del error de pago (opcional, se guardará como nota del admin):',
      ''
    )
    if (notes === null) return // cancelado

    setProcessingRef(order.sale_ref)
    try {
      const result = await updateOrderByRef(
        order.sale_ref,
        'payment_error',
        'por_cobrar',
        notes || 'Pago no verificado'
      )
      if (!result.ok) {
        alert(`Error: ${result.error}`)
        return
      }
      await fetchOrders()

      // Abrir WhatsApp con mensaje de error
      if (order.customer_phone) {
        const msg = buildWhatsAppErrorMessage(order)
        openWhatsApp(order.customer_phone, msg)
      } else {
        alert('Error de pago registrado. El cliente no tiene WhatsApp — no se pudo enviar el mensaje.')
      }
    } finally {
      setProcessingRef(null)
    }
  }

  function toggleExpand(ref: string) {
    setExpandedOrder(expandedOrder === ref ? null : ref)
  }

  return (
    <div className="space-y-8 pb-12">
      {/* CABECERA */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="ds-eyebrow">Pedidos web{advisorFilter ? ` · ${advisorFilter}` : ''}</p>
          <h1 className="ds-text-gold mt-1 text-3xl tracking-tight">{title}</h1>
          <p className="mt-1 text-xs font-semibold uppercase" style={{ color: 'var(--ds-txt-3)' }}>
            {pendingCount > 0
              ? `⏳ ${pendingCount} pedido${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''} de verificar`
              : 'Sin pedidos pendientes de verificación'}
          </p>
        </div>
        <button
          onClick={fetchOrders}
          className="ds-btn-ghost px-4 py-3 text-xs uppercase tracking-widest"
        >
          <Package className="size-4 text-[#ef4444]" />
          Actualizar
        </button>
      </div>

      {/* PESTAÑAS */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const count =
            tab.id === 'all'
              ? visibleOrders.length
              : visibleOrders.filter((o) => o.order_status === tab.id).length
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[11px] font-bold uppercase transition ${
                isActive
                  ? tab.id === 'pending_review'
                    ? 'bg-amber-600 text-white'
                    : tab.id === 'verified'
                      ? 'bg-emerald-600 text-white'
                      : tab.id === 'payment_error'
                        ? 'bg-rose-600 text-white'
                        : 'bg-neutral-700 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Icon className={`size-3.5 ${!isActive ? tab.color : ''}`} />
              {tab.label}
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                  isActive ? 'bg-white/20' : 'bg-neutral-800'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* BÚSQUEDA */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          placeholder="Buscar por cliente, referencia, asesor o producto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-neutral-800 bg-neutral-950 py-2.5 pl-10 pr-4 text-xs font-semibold text-white placeholder-neutral-500 outline-none transition focus:border-emerald-500"
        />
      </div>

      {/* LISTA DE PEDIDOS */}
      {isLoadingProfile || isLoading ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-8 text-center text-xs font-bold uppercase text-neutral-500">
          Cargando pedidos...
        </div>
      ) : advisorFilter !== undefined && advisorFilter.trim() === '' ? (
        <div className="flex flex-col items-center rounded-2xl border border-neutral-800 bg-neutral-900/40 p-12 text-center">
          <User className="size-10 text-neutral-600" />
          <p className="mt-4 text-xs font-bold uppercase text-neutral-500">
            Tu cuenta no tiene un perfil de asesor asignado.
            <br />
            Contacta al administrador.
          </p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-neutral-800 bg-neutral-900/40 p-12 text-center">
          <ShoppingBag className="size-10 text-neutral-600" />
          <p className="mt-4 text-xs font-bold uppercase text-neutral-500">
            No hay pedidos en esta sección
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrder === order.sale_ref
            const isProcessing = processingRef === order.sale_ref
            const mapsEmbed =
              order.delivery_method === 'delivery'
                ? getGoogleMapsEmbedUrl(order.delivery_lat, order.delivery_lng)
                : null
            const mapsLink =
              order.delivery_method === 'delivery'
                ? getGoogleMapsUrl(order.delivery_lat, order.delivery_lng)
                : null

            return (
              <div
                key={order.sale_ref}
                className="overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900/40"
              >
                {/* HEADER DEL PEDIDO */}
                <div
                  className="flex cursor-pointer items-center justify-between gap-4 p-4 transition-colors hover:bg-neutral-800/20"
                  onClick={() => toggleExpand(order.sale_ref)}
                >
                  <div className="flex items-center gap-4">
                    {/* Estado */}
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                        order.order_status === 'pending_review'
                          ? 'bg-amber-500/10 border border-amber-500/30'
                          : order.order_status === 'verified'
                            ? 'bg-emerald-500/10 border border-emerald-500/30'
                            : 'bg-rose-500/10 border border-rose-500/30'
                      }`}
                    >
                      {order.order_status === 'pending_review' ? (
                        <Clock className="size-5 text-amber-400" />
                      ) : order.order_status === 'verified' ? (
                        <CheckCircle className="size-5 text-emerald-400" />
                      ) : (
                        <XCircle className="size-5 text-rose-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-heading text-sm font-black uppercase text-white">
                          {order.customer_name}
                        </span>
                        <span className="rounded-full bg-neutral-800 px-2 py-0.5 font-mono text-[10px] text-neutral-400">
                          {order.sale_ref.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-neutral-400">
                        {order.product_names || '—'} · {order.payment_method}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-neutral-500">
                        {new Date(order.created_at).toLocaleString('es-ES', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                        {order.customer_phone && (
                          <span className="ml-2 text-emerald-500">📱 {order.customer_phone}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-black text-emerald-400">
                      ${order.total.toFixed(2)}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="size-4 text-neutral-500" />
                    ) : (
                      <ChevronDown className="size-4 text-neutral-500" />
                    )}
                  </div>
                </div>

                {/* DETALLE EXPANDIDO */}
                {isExpanded && (
                  <div className="border-t border-neutral-800/60 p-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {/* IZQUIERDA: datos del pedido */}
                      <div className="space-y-4">
                        {/* Productos */}
                        <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
                          <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                            Productos
                          </h4>
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between py-1">
                              <span className="text-xs text-neutral-300">
                                {item.products?.name || item.product_id} × {item.quantity}
                              </span>
                              <span className="font-mono text-xs text-neutral-400">
                                ${(Number(item.total_price) || 0).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Datos de pago */}
                        <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
                          <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                            Datos de Pago
                          </h4>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-neutral-500">Método:</span>
                              <span className="font-bold text-white">{order.payment_method}</span>
                            </div>
                            {order.payment_reference && (
                              <div className="flex justify-between gap-2">
                                <span className="text-neutral-500">Referencia:</span>
                                <span className="font-mono text-white">{order.payment_reference}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-neutral-500">Asesor:</span>
                              <span className="font-bold text-white">{order.advisor_name}</span>
                            </div>
                          </div>
                        </div>

                        {/* Comprobante de pago */}
                        {order.payment_screenshot_url ? (
                          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
                            <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                              <Camera className="size-3.5" /> Comprobante de Pago
                            </h4>
                            <button
                              type="button"
                              onClick={() => setViewingScreenshot(order.payment_screenshot_url!)}
                              className="group relative block w-full overflow-hidden rounded-lg border border-neutral-700"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={order.payment_screenshot_url}
                                alt="Comprobante"
                                className="max-h-64 w-full object-contain bg-black/40"
                              />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                                <Camera className="size-6 text-white" />
                                <span className="ml-2 text-xs font-bold uppercase text-white">
                                  Ver completo
                                </span>
                              </span>
                            </button>
                          </div>
                        ) : (
                          order.order_status !== 'pending_review' && (
                            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
                              <p className="text-xs text-neutral-500">
                                Sin comprobante adjunto
                              </p>
                            </div>
                          )
                        )}

                        {/* Notas del cliente */}
                        {order.customer_notes && (
                          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
                            <h4 className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                              <StickyNote className="size-3.5" /> Notas del Cliente
                            </h4>
                            <p className="text-xs text-neutral-300">{order.customer_notes}</p>
                          </div>
                        )}

                        {/* Notas del admin */}
                        {order.admin_notes && (
                          <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
                            <h4 className="mb-1 text-[10px] font-black uppercase tracking-widest text-rose-400">
                              Nota del Admin
                            </h4>
                            <p className="text-xs text-neutral-300">{order.admin_notes}</p>
                          </div>
                        )}
                      </div>

                      {/* DERECHA: entrega + acciones */}
                      <div className="space-y-4">
                        {/* Entrega */}
                        <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
                          <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                            Entrega
                          </h4>
                          <div className="flex items-center gap-2 text-xs">
                            {order.delivery_method === 'delivery' ? (
                              <>
                                <MapPin className="size-4 text-primary" />
                                <span className="font-bold text-white">Delivery</span>
                              </>
                            ) : (
                              <>
                                <Store className="size-4 text-sky-400" />
                                <span className="font-bold text-white">Pick Up en tienda</span>
                              </>
                            )}
                          </div>
                          {order.delivery_address && (
                            <p className="mt-2 text-xs text-neutral-300">
                              📍 {order.delivery_address}
                            </p>
                          )}
                          {order.delivery_lat != null && order.delivery_lng != null && (
                            <p className="mt-1 font-mono text-[10px] text-neutral-500">
                              {order.delivery_lat.toFixed(5)}, {order.delivery_lng.toFixed(5)}
                            </p>
                          )}
                          {mapsLink && (
                            <a
                              href={mapsLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline"
                            >
                              <ExternalLink className="size-3.5" /> Abrir en Google Maps
                            </a>
                          )}
                        </div>

                        {/* Mapa embebido (delivery) */}
                        {mapsEmbed && (
                          <iframe
                            src={mapsEmbed}
                            className="h-48 w-full rounded-xl border border-neutral-800"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        )}

                        {/* Acciones */}
                        <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
                          <h4 className="mb-3 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                            Acciones
                          </h4>

                          {order.order_status === 'pending_review' && (
                            <div className="space-y-2">
                              <button
                                onClick={() => handleVerify(order)}
                                disabled={isProcessing}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-emerald-500 disabled:opacity-50"
                              >
                                <CheckCircle className="size-4" />
                                {isProcessing ? 'Procesando...' : 'Pago Verificado'}
                              </button>
                              <button
                                onClick={() => handlePaymentError(order)}
                                disabled={isProcessing}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-rose-500 disabled:opacity-50"
                              >
                                <XCircle className="size-4" />
                                Error en el Pago
                              </button>
                              {order.customer_phone && (
                                <button
                                  onClick={() =>
                                    openWhatsApp(
                                      order.customer_phone!,
                                      `Hola ${order.customer_name}, recibimos tu pedido ${order.sale_ref.slice(0, 8).toUpperCase()}. Estamos verificando tu pago. 👟`
                                    )
                                  }
                                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800/60 px-4 py-2.5 text-[11px] font-bold uppercase text-neutral-300 transition hover:bg-neutral-800"
                                >
                                  <MessageCircle className="size-3.5" /> WhatsApp (consultar)
                                </button>
                              )}
                            </div>
                          )}

                          {order.order_status === 'verified' && (
                            <div className="space-y-2">
                              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-center">
                                <CheckCircle className="mx-auto size-5 text-emerald-400" />
                                <p className="mt-1 text-[11px] font-bold uppercase text-emerald-400">
                                  Pago Verificado
                                </p>
                              </div>
                              {order.customer_phone && (
                                <button
                                  onClick={() =>
                                    openWhatsApp(
                                      order.customer_phone!,
                                      buildWhatsAppVerifyMessage(order)
                                    )
                                  }
                                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 px-4 py-2.5 text-[11px] font-black uppercase text-emerald-300 transition hover:bg-emerald-600/40"
                                >
                                  <MessageCircle className="size-3.5" /> Reenviar WhatsApp
                                </button>
                              )}
                            </div>
                          )}

                          {order.order_status === 'payment_error' && (
                            <div className="space-y-2">
                              <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-center">
                                <XCircle className="mx-auto size-5 text-rose-400" />
                                <p className="mt-1 text-[11px] font-bold uppercase text-rose-400">
                                  Error de Pago
                                </p>
                                {order.admin_notes && (
                                  <p className="mt-1 text-[10px] text-neutral-400">{order.admin_notes}</p>
                                )}
                              </div>
                              {order.customer_phone && (
                                <button
                                  onClick={() =>
                                    openWhatsApp(
                                      order.customer_phone!,
                                      buildWhatsAppErrorMessage(order)
                                    )
                                  }
                                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600/20 border border-rose-500/30 px-4 py-2.5 text-[11px] font-black uppercase text-rose-300 transition hover:bg-rose-600/40"
                                >
                                  <MessageCircle className="size-3.5" /> Reenviar WhatsApp
                                </button>
                              )}
                              {/* Permitir re-verificar si el cliente pagó después */}
                              <button
                                onClick={() => handleVerify(order)}
                                disabled={isProcessing}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800/60 px-4 py-2.5 text-[11px] font-bold uppercase text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-50"
                              >
                                <CheckCircle className="size-3.5" /> Marcar como verificado
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL: ver comprobante completo */}
      {viewingScreenshot && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setViewingScreenshot(null)}
        >
          <div className="relative max-h-[90vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewingScreenshot}
              alt="Comprobante de pago completo"
              className="max-h-[85vh] w-auto rounded-xl border border-neutral-700"
            />
            <button
              onClick={() => setViewingScreenshot(null)}
              className="absolute -top-3 -right-3 rounded-full bg-white p-2 text-black shadow-lg transition hover:bg-neutral-200"
              aria-label="Cerrar"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
