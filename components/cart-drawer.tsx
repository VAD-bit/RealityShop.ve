'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
  Banknote,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  UserCheck,
  Loader2,
  PartyPopper,
  Upload,
  MapPin,
  Store,
  Camera,
  Phone,
  StickyNote,
  CreditCard,
} from 'lucide-react'
import { useCart } from '@/components/cart-context'
import { createClient } from '@/lib/supabase/client'
import { getSettings, AppSettings, DEFAULT_SETTINGS } from '@/lib/settings'
import { ADVISORS as DEFAULT_ADVISORS } from '@/lib/constants'
import {
  processOrder,
  uploadPaymentProof,
  OrderPayload,
  DeliveryMethod,
} from '@/lib/orders'

type PaymentMethod = 'efectivo' | 'pago_movil' | 'zelle' | 'binance'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  binance: 'Binance',
}

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; icon: any; hint: string }[] = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote, hint: 'Pagas al recibir' },
  { id: 'pago_movil', label: 'Pago Móvil', icon: Smartphone, hint: 'Transferencia instantánea' },
  { id: 'zelle', label: 'Zelle', icon: CreditCard, hint: 'Dólares vía email' },
  { id: 'binance', label: 'Binance Pay', icon: Smartphone, hint: 'Crypto / USDT' },
]

type Step = 'cart' | 'checkout' | 'success'

export function CartDrawer() {
  const {
    items,
    isOpen,
    total,
    count,
    closeCart,
    removeItem,
    updateQuantity,
    clear,
  } = useCart()

  const [step, setStep] = useState<Step>('cart')
  const [advisors, setAdvisors] = useState<{ id: string; name: string }[]>(DEFAULT_ADVISORS)
  const [selectedAdvisor, setSelectedAdvisor] = useState<string>('')
  const [customerName, setCustomerName] = useState<string>('')
  const [customerPhone, setCustomerPhone] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [payReference, setPayReference] = useState<string>('')
  const [customerPayRef, setCustomerPayRef] = useState<string>('')
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Comprobante de pago
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Entrega
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('delivery')
  const [deliveryAddress, setDeliveryAddress] = useState<string>('')
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null)
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null)
  const [customerNotes, setCustomerNotes] = useState<string>('')
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(false)

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [orderRef, setOrderRef] = useState<string>('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeCart()
    }
    if (isOpen) {
      document.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, closeCart])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    ;(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.from('advisors').select('id, name')
        if (!cancelled && data && data.length > 0) setAdvisors(data)
      } catch {}

      try {
        const s = await getSettings()
        if (!cancelled) setSettings(s)
      } catch {
        if (!cancelled) setSettings(DEFAULT_SETTINGS)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (step === 'checkout') {
      if (!selectedAdvisor && advisors.length > 0) {
        setSelectedAdvisor(advisors[0].name)
      }
      if (!payReference) {
        setPayReference(
          `RS-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`
        )
      }
    }
  }, [step, advisors, selectedAdvisor, payReference])

  useEffect(() => {
    if (!isOpen && step === 'success') {
      setStep('cart')
      resetCheckout()
    }
  }, [isOpen, step])

  function resetCheckout() {
    setCustomerName('')
    setCustomerPhone('')
    setCustomerPayRef('')
    setPaymentMethod('efectivo')
    setPayReference('')
    setScreenshotFile(null)
    setScreenshotPreview(null)
    setDeliveryMethod('delivery')
    setDeliveryAddress('')
    setDeliveryLat(null)
    setDeliveryLng(null)
    setCustomerNotes('')
    setOrderRef('')
  }

  const totalBs = useMemo(
    () => total * (settings.exchangeRate || 1),
    [total, settings.exchangeRate]
  )

  const isDigitalPayment = paymentMethod !== 'efectivo'
  const pagoMovilBank = settings.pagoMovilBank?.trim() || ''
  const pagoMovilPhone = settings.pagoMovilPhone?.trim() || ''
  const pagoMovilCedula = settings.pagoMovilCedula?.trim() || ''
  const zelleEmail = settings.zelleEmail?.trim() || ''
  const binancePayId = settings.binancePayId?.trim() || ''

  const canSubmit =
    items.length > 0 &&
    selectedAdvisor &&
    customerPhone.trim().length >= 7 &&
    (!isDigitalPayment || screenshotFile !== null) &&
    (deliveryMethod === 'pickup' || deliveryAddress.trim().length > 0)

  async function copyText(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1600)
    } catch {}
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar 5 MB.')
      return
    }
    setScreenshotFile(file)
    setScreenshotPreview(URL.createObjectURL(file))
  }

  function handleRemoveScreenshot() {
    setScreenshotFile(null)
    setScreenshotPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleGetMyLocation() {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.')
      return
    }
    setIsGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeliveryLat(pos.coords.latitude)
        setDeliveryLng(pos.coords.longitude)
        setIsGettingLocation(false)
      },
      () => {
        alert('No se pudo obtener tu ubicación. Acepta los permisos o escribe tu dirección manualmente.')
        setIsGettingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function handleCompleteOrder() {
    if (!canSubmit || isSubmitting) return

    setIsSubmitting(true)
    try {
      let screenshotUrl = ''
      if (isDigitalPayment && screenshotFile) {
        screenshotUrl = await uploadPaymentProof(screenshotFile)
      }

      const payload: OrderPayload = {
        items: items.map((item) => ({
          product_id: item.id,
          inventory_id: item.inventoryId as string,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          quantity: item.quantity,
        })),
        advisor: selectedAdvisor,
        customer: customerName.trim() || 'Cliente Web',
        customerPhone: customerPhone.trim(),
        paymentMethod: PAYMENT_LABELS[paymentMethod],
        paymentReference: customerPayRef.trim()
          ? `${payReference} / ${customerPayRef.trim()}`
          : payReference,
        screenshotUrl,
        deliveryMethod,
        deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress.trim() : '',
        deliveryLat: deliveryMethod === 'delivery' ? deliveryLat : null,
        deliveryLng: deliveryMethod === 'delivery' ? deliveryLng : null,
        customerNotes: customerNotes.trim(),
        total,
      }

      const result = await processOrder(payload)

      if (!result.ok) {
        alert(`No se pudo registrar el pedido.${result.error ? `\n${result.error}` : ''}`)
        return
      }

      setOrderRef(payReference)
      clear()
      resetCheckout()
      setStep('success')
    } catch (error: any) {
      console.error('Error completando pedido:', error)
      alert(`Error: ${error?.message || 'No se pudo completar el pedido'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleFinishSuccess() {
    setStep('cart')
    closeCart()
  }

  const mapsEmbedUrl =
    deliveryLat != null && deliveryLng != null
      ? `https://maps.google.com/maps?q=${deliveryLat},${deliveryLng}&z=15&output=embed`
      : null

  const pickupMapsUrl = 'https://maps.google.com/maps?q=Reality+Shop+Venezuela'

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-background/70 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeCart}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="inline-flex items-center gap-2 font-heading text-lg font-black uppercase tracking-tight">
            {step === 'checkout' ? (
              <button
                type="button"
                onClick={() => setStep('cart')}
                aria-label="Volver al carrito"
                className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="size-5" />
              </button>
            ) : (
              <ShoppingBag className="size-5 text-primary" />
            )}
            {step === 'checkout'
              ? 'Completar Pedido'
              : step === 'success'
                ? '¡Pedido Enviado!'
                : 'Tus Compras'}
            {step === 'cart' && <span className="text-muted-foreground">({count})</span>}
          </h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* ===================== PASO 1: CARRITO ===================== */}
        {step === 'cart' && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <ShoppingBag className="size-10 text-muted-foreground" />
                  <p className="mt-4 font-heading text-lg font-bold uppercase tracking-tight">
                    Aun no has agregado nada
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Selecciona lo que quieras comprar.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-4">
                  {items.map((item) => (
                    <li
                      key={`${item.id}-${item.size}`}
                      className="flex gap-3 rounded-sm border border-border bg-secondary/40 p-3"
                    >
                      <div className="size-20 shrink-0 overflow-hidden rounded-sm bg-secondary">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image || '/placeholder.svg'}
                          alt={item.name}
                          className="size-full object-cover"
                        />
                      </div>
                      <div className="flex flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-heading text-sm font-bold uppercase leading-tight">
                              {item.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {typeof item.size === 'number'
                                ? `EUR ${item.size}`
                                : item.size || 'Talla Única'}
                              {item.gender ? ` • ${item.gender}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id, item.size)}
                            aria-label={`Borrar ${item.name}`}
                            className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-primary"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="inline-flex items-center rounded-sm border border-border">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.size, -1)}
                              aria-label="Decrease quantity"
                              className="inline-flex size-8 items-center justify-center text-foreground transition-colors hover:text-primary"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="w-8 text-center text-sm font-bold">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.size, 1)}
                              aria-label="Increase quantity"
                              className="inline-flex size-8 items-center justify-center text-foreground transition-colors hover:text-primary"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                          <p className="font-heading text-sm font-black text-primary">
                            ${item.price * item.quantity}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-border px-5 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    Total
                  </span>
                  <span className="font-heading text-2xl font-black">
                    ${total.toFixed(0)}
                  </span>
                </div>
                {settings.exchangeRate > 1 && (
                  <p className="mt-1 text-right text-xs font-medium text-muted-foreground">
                    ≈ {totalBs.toFixed(2)} Bs.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setStep('checkout')}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-6 py-4 font-heading text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5"
                >
                  Continuar <ChevronRight className="size-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* ===================== PASO 2: CHECKOUT ===================== */}
        {step === 'checkout' && items.length > 0 && (
          <>
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
              {/* ── ASESOR ── */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  <UserCheck className="size-3.5 text-primary" /> Asesor
                </label>
                <select
                  value={selectedAdvisor}
                  onChange={(e) => setSelectedAdvisor(e.target.value)}
                  className="w-full cursor-pointer appearance-none rounded-sm border border-border bg-secondary px-4 py-3 font-heading text-xs font-bold uppercase tracking-widest text-foreground outline-none focus:border-primary"
                >
                  {advisors.map((adv) => (
                    <option key={adv.id} value={adv.name}>
                      {adv.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* ── DATOS PERSONALES ── */}
              <div className="space-y-3">
                <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  <Phone className="size-3.5 text-primary" /> Tus datos
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full rounded-sm border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="WhatsApp (ej. 04141234567) *"
                  required
                  className="w-full rounded-sm border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                />
              </div>

              {/* ── MÉTODO DE PAGO ── */}
              <div>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  Método de pago
                </label>
                <div className="flex flex-col gap-2">
                  {PAYMENT_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    const isActive = paymentMethod === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPaymentMethod(opt.id)}
                        className={`flex items-center gap-3 rounded-sm border px-4 py-3 text-left transition-all ${
                          isActive
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-secondary/40 hover:border-white/25'
                        }`}
                      >
                        <Icon
                          className={`size-5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                        />
                        <div className="min-w-0">
                          <p
                            className={`font-heading text-xs font-bold uppercase tracking-wide ${
                              isActive ? 'text-primary' : 'text-foreground'
                            }`}
                          >
                            {opt.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{opt.hint}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── INSTRUCCIONES DE PAGO ── */}
              {paymentMethod === 'pago_movil' && (
                <div className="space-y-2 rounded-sm border border-primary/40 bg-primary/[0.06] p-4">
                  <p className="font-heading text-xs font-black uppercase tracking-widest text-primary">
                    📲 Realiza el Pago Móvil a:
                  </p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Banco:</span>
                      <span className="flex items-center gap-2 font-mono font-bold">
                        {pagoMovilBank || 'Sin configurar'}
                        {pagoMovilBank && (
                          <button type="button" onClick={() => copyText(pagoMovilBank, 'pm_bank')} className="rounded p-1 text-muted-foreground hover:text-primary">
                            {copiedField === 'pm_bank' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Teléfono:</span>
                      <span className="flex items-center gap-2 font-mono font-bold">
                        {pagoMovilPhone || 'Sin configurar'}
                        {pagoMovilPhone && (
                          <button type="button" onClick={() => copyText(pagoMovilPhone, 'pm_phone')} className="rounded p-1 text-muted-foreground hover:text-primary">
                            {copiedField === 'pm_phone' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Cédula:</span>
                      <span className="flex items-center gap-2 font-mono font-bold">
                        {pagoMovilCedula || 'Sin configurar'}
                        {pagoMovilCedula && (
                          <button type="button" onClick={() => copyText(pagoMovilCedula, 'pm_cedula')} className="rounded p-1 text-muted-foreground hover:text-primary">
                            {copiedField === 'pm_cedula' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Monto:</span>
                      <span className="font-mono font-bold text-primary">
                        ${total.toFixed(0)}
                        {settings.exchangeRate > 1 ? ` (${totalBs.toFixed(2)} Bs.)` : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Referencia:</span>
                      <span className="flex items-center gap-2 font-mono font-bold">
                        {payReference}
                        <button type="button" onClick={() => copyText(payReference, 'ref')} className="rounded p-1 text-muted-foreground hover:text-primary">
                          {copiedField === 'ref' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                        </button>
                      </span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={customerPayRef}
                    onChange={(e) => setCustomerPayRef(e.target.value)}
                    placeholder="Referencia de tu transferencia (ej. 123456789)"
                    className="w-full rounded-sm border border-border bg-secondary px-3 py-2.5 font-mono text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                  />
                </div>
              )}

              {paymentMethod === 'zelle' && (
                <div className="space-y-2 rounded-sm border border-primary/40 bg-primary/[0.06] p-4">
                  <p className="font-heading text-xs font-black uppercase tracking-widest text-primary">
                    💳 Envía vía Zelle a:
                  </p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Correo:</span>
                      <span className="flex items-center gap-2 font-mono font-bold">
                        {zelleEmail || 'Sin configurar'}
                        {zelleEmail && (
                          <button type="button" onClick={() => copyText(zelleEmail, 'zelle')} className="rounded p-1 text-muted-foreground hover:text-primary">
                            {copiedField === 'zelle' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Monto:</span>
                      <span className="font-mono font-bold text-primary">
                        ${total.toFixed(0)} USD
                        {settings.exchangeRate > 1 ? ` (${totalBs.toFixed(2)} Bs.)` : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Referencia:</span>
                      <span className="flex items-center gap-2 font-mono font-bold">
                        {payReference}
                        <button type="button" onClick={() => copyText(payReference, 'ref')} className="rounded p-1 text-muted-foreground hover:text-primary">
                          {copiedField === 'ref' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                        </button>
                      </span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={customerPayRef}
                    onChange={(e) => setCustomerPayRef(e.target.value)}
                    placeholder="ID de transacción Zelle"
                    className="w-full rounded-sm border border-border bg-secondary px-3 py-2.5 font-mono text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                  />
                </div>
              )}

              {paymentMethod === 'binance' && (
                <div className="space-y-2 rounded-sm border border-primary/40 bg-primary/[0.06] p-4">
                  <p className="font-heading text-xs font-black uppercase tracking-widest text-primary">
                    🪙 Envía USDT vía Binance Pay a:
                  </p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Pay ID:</span>
                      <span className="flex items-center gap-2 font-mono font-bold">
                        {binancePayId || 'Sin configurar'}
                        {binancePayId && (
                          <button type="button" onClick={() => copyText(binancePayId, 'binance')} className="rounded p-1 text-muted-foreground hover:text-primary">
                            {copiedField === 'binance' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Monto:</span>
                      <span className="font-mono font-bold text-primary">${total.toFixed(0)} USDT</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Referencia:</span>
                      <span className="flex items-center gap-2 font-mono font-bold">
                        {payReference}
                        <button type="button" onClick={() => copyText(payReference, 'ref')} className="rounded p-1 text-muted-foreground hover:text-primary">
                          {copiedField === 'ref' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                        </button>
                      </span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={customerPayRef}
                    onChange={(e) => setCustomerPayRef(e.target.value)}
                    placeholder="Hash / ID de tu transacción Binance"
                    className="w-full rounded-sm border border-border bg-secondary px-3 py-2.5 font-mono text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                  />
                </div>
              )}

              {paymentMethod === 'efectivo' && (
                <div className="rounded-sm border border-border bg-secondary/40 p-4">
                  <p className="text-sm text-muted-foreground">
                    Pagarás en efectivo al recibir. Tu asesor{' '}
                    <strong className="text-foreground">{selectedAdvisor}</strong> coordinará la
                    entrega.
                  </p>
                </div>
              )}

              {/* ── COMPROBANTE DE PAGO ── */}
              {isDigitalPayment && (
                <div>
                  <label className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                    <Camera className="size-3.5 text-primary" /> Sube tu comprobante de pago *
                  </label>
                  {screenshotPreview ? (
                    <div className="relative overflow-hidden rounded-sm border border-primary/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={screenshotPreview} alt="Comprobante" className="max-h-48 w-full object-contain bg-secondary" />
                      <button
                        type="button"
                        onClick={handleRemoveScreenshot}
                        className="absolute right-2 top-2 rounded-sm bg-black/70 p-1.5 text-white transition-colors hover:bg-black"
                        aria-label="Quitar comprobante"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full flex-col items-center gap-2 rounded-sm border-2 border-dashed border-border bg-secondary/40 px-4 py-6 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      <Upload className="size-6" />
                      <span className="text-xs font-bold uppercase tracking-wide">
                        Seleccionar captura
                      </span>
                      <span className="text-[10px]">PNG, JPG hasta 5 MB</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}

              {/* ── ENTREGA ── */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  <MapPin className="size-3.5 text-primary" /> ¿Cómo recibes tu pedido?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('delivery')}
                    className={`flex flex-col items-center gap-1.5 rounded-sm border px-4 py-3 transition-all ${
                      deliveryMethod === 'delivery'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-secondary/40 text-muted-foreground hover:border-white/25'
                    }`}
                  >
                    <MapPin className="size-5" />
                    <span className="font-heading text-xs font-bold uppercase">Delivery</span>
                    <span className="text-[10px]">A tu ubicación</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('pickup')}
                    className={`flex flex-col items-center gap-1.5 rounded-sm border px-4 py-3 transition-all ${
                      deliveryMethod === 'pickup'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-secondary/40 text-muted-foreground hover:border-white/25'
                    }`}
                  >
                    <Store className="size-5" />
                    <span className="font-heading text-xs font-bold uppercase">Pick Up</span>
                    <span className="text-[10px]">Recoger en tienda</span>
                  </button>
                </div>

                {deliveryMethod === 'delivery' && (
                  <div className="mt-3 space-y-3">
                    <textarea
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Dirección exacta (casa, apartamento, referencia) *"
                      rows={2}
                      className="w-full rounded-sm border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={handleGetMyLocation}
                      disabled={isGettingLocation}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-sm border border-primary/40 bg-primary/[0.06] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                    >
                      {isGettingLocation ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <MapPin className="size-4" />
                      )}
                      {isGettingLocation
                        ? 'Obteniendo ubicación...'
                        : deliveryLat != null
                          ? 'Ubicación capturada ✓ — actualizar'
                          : 'Usar mi ubicación actual (Google Maps)'}
                    </button>
                    {mapsEmbedUrl && (
                      <iframe
                        src={mapsEmbedUrl}
                        className="h-40 w-full rounded-sm border border-border"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    )}
                    {deliveryLat != null && deliveryLng != null && (
                      <p className="text-[10px] font-mono text-muted-foreground">
                        📍 {deliveryLat.toFixed(5)}, {deliveryLng.toFixed(5)}
                      </p>
                    )}
                  </div>
                )}

                {deliveryMethod === 'pickup' && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Recoge en nuestra tienda. Te enviaremos la ubicación exacta por WhatsApp
                      cuando tu pedido esté listo.
                    </p>
                    <a
                      href={pickupMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-sm border border-border bg-secondary/40 px-4 py-2.5 text-xs font-bold uppercase text-foreground transition-colors hover:border-primary/40"
                    >
                      <Store className="size-4 text-primary" /> Ver ubicación en Google Maps
                    </a>
                  </div>
                )}
              </div>

              {/* ── NOTAS ── */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  <StickyNote className="size-3.5 text-primary" /> Notas (opcional)
                </label>
                <textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Algún detalle importante para el asesor..."
                  rows={2}
                  className="w-full rounded-sm border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* ── BOTÓN COMPLETAR ── */}
            <div className="border-t border-border px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Total
                </span>
                <div className="text-right">
                  <span className="font-heading text-2xl font-black">
                    ${total.toFixed(0)}
                  </span>
                  {settings.exchangeRate > 1 && (
                    <p className="text-xs text-muted-foreground">≈ {totalBs.toFixed(2)} Bs.</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCompleteOrder}
                disabled={isSubmitting || !canSubmit}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-6 py-4 font-heading text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Enviando pedido...
                  </>
                ) : (
                  <>Completar Pedido</>
                )}
              </button>
              {!canSubmit && !isSubmitting && (
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  {customerPhone.trim().length < 7
                    ? 'Ingresa tu número de WhatsApp.'
                    : isDigitalPayment && !screenshotFile
                      ? 'Sube tu comprobante de pago.'
                      : deliveryMethod === 'delivery' && !deliveryAddress.trim()
                        ? 'Escribe tu dirección de entrega.'
                        : ''}
                </p>
              )}
            </div>
          </>
        )}

        {/* ===================== PASO 3: ÉXITO ===================== */}
        {step === 'success' && (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-primary/10">
              <PartyPopper className="size-8 text-primary" />
            </div>
            <h3 className="font-heading text-xl font-black uppercase tracking-tight">
              ¡Pedido enviado!
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu pedido fue registrado. Un asesor lo revisará y se comunicará contigo por WhatsApp.
            </p>

            <div className="mt-6 w-full rounded-sm border border-border bg-secondary/40 p-4">
              <p className="text-xs text-muted-foreground">Referencia del pedido</p>
              <p className="mt-1 font-mono text-lg font-black">{orderRef}</p>
            </div>

            <button
              type="button"
              onClick={handleFinishSuccess}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-6 py-4 font-heading text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Seguir comprando
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
