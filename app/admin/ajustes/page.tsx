'use client'

import { useEffect, useState } from 'react'
import { Settings, Save, Loader2, AlertCircle, Ticket, Plus, Power, Trash2, Lock, Eye, EyeOff } from 'lucide-react'
import {
  getSettings,
  saveSettings,
  resetSettingsCache,
  AppSettings,
  DEFAULT_SETTINGS,
} from '@/lib/settings'
import {
  getCoupons,
  createCoupon,
  setCouponActive,
  deleteCoupon,
  describeCoupon,
  CouponRecord,
} from '@/lib/coupons'

export default function AjustesPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Cupones autorizados
  const [coupons, setCoupons] = useState<CouponRecord[]>([])
  const [isLoadingCoupons, setIsLoadingCoupons] = useState<boolean>(true)
  const [couponsNotice, setCouponsNotice] = useState<string>('')
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'percent' as 'percent' | 'fixed',
    discount_value: '',
    customer_name: '',
    note: '',
    max_uses: '',
  })
  const [isCreatingCoupon, setIsCreatingCoupon] = useState<boolean>(false)

  // PIN de seguridad
  const [showPinInput, setShowPinInput] = useState<boolean>(false)
  const [pinConfirm, setPinConfirm] = useState<string>('')
  const [pinError, setPinError] = useState<string>('')

  const refreshCoupons = async () => {
    setIsLoadingCoupons(true)
    setCouponsNotice('')
    try {
      const list = await getCoupons()
      setCoupons(list)
      if (list.length === 0) {
        setCouponsNotice('Aún no hay cupones. Crea uno para poder aplicarlo en el POS.')
      }
    } catch (error: any) {
      console.error('Error cargando cupones:', error)
      setCouponsNotice('No se pudieron cargar los cupones.')
    } finally {
      setIsLoadingCoupons(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const s = await getSettings()
        if (!cancelled) setSettings(s)
      } catch {
        if (!cancelled) setSettings(DEFAULT_SETTINGS)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    refreshCoupons()

    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)
    setPinError('')

    // Validar PIN si se está cambiando
    const newPin = (settings.adminPin || '').trim()
    if (newPin && newPin !== pinConfirm.trim()) {
      setPinError('La confirmación del PIN no coincide.')
      setIsSaving(false)
      return
    }
    if (newPin && newPin.length < 4) {
      setPinError('El PIN debe tener al menos 4 dígitos.')
      setIsSaving(false)
      return
    }

    try {
      await saveSettings({
        exchangeRate: Math.max(0, Number(settings.exchangeRate) || 0),
        commissionPct: Math.max(0, Number(settings.commissionPct) || 0),
        maintenancePct: Math.max(0, Number(settings.maintenancePct) || 0),
        maintenanceOwner: settings.maintenanceOwner.trim() || DEFAULT_SETTINGS.maintenanceOwner,
        pagoMovilBank: settings.pagoMovilBank.trim(),
        pagoMovilPhone: settings.pagoMovilPhone.trim(),
        pagoMovilCedula: settings.pagoMovilCedula.trim(),
        zelleEmail: settings.zelleEmail.trim(),
        binancePayId: settings.binancePayId.trim(),
        adminPin: newPin,
      })
      resetSettingsCache()
      setPinConfirm('')
      setMessage({ type: 'success', text: 'Ajustes guardados correctamente.' })
    } catch (error: any) {
      console.error('Error guardando ajustes:', error)
      setMessage({
        type: 'error',
        text: `No se pudieron guardar los ajustes.${error?.message ? ` ${error.message}` : ''}`,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreatingCoupon(true)
    setCouponsNotice('')

    try {
      await createCoupon({
        code: couponForm.code,
        discount_type: couponForm.discount_type,
        discount_value: Number(couponForm.discount_value) || 0,
        customer_name: couponForm.customer_name || undefined,
        note: couponForm.note || undefined,
        max_uses: couponForm.max_uses ? Number(couponForm.max_uses) : null,
      })
      setCouponForm({
        code: '',
        discount_type: 'percent',
        discount_value: '',
        customer_name: '',
        note: '',
        max_uses: '',
      })
      await refreshCoupons()
    } catch (error: any) {
      console.error('Error creando cupón:', error)
      setCouponsNotice(error?.message || 'No se pudo crear el cupón.')
    } finally {
      setIsCreatingCoupon(false)
    }
  }

  const handleToggleCoupon = async (coupon: CouponRecord) => {
    try {
      await setCouponActive(coupon.id, !coupon.is_active)
      await refreshCoupons()
    } catch (error: any) {
      console.error('Error cambiando estado del cupón:', error)
      setCouponsNotice(error?.message || 'No se pudo cambiar el estado del cupón.')
    }
  }

  const handleDeleteCoupon = async (coupon: CouponRecord) => {
    if (!confirm(`¿Eliminar el cupón "${coupon.code}"? Esta acción no se puede deshacer.`)) return
    try {
      await deleteCoupon(coupon.id)
      await refreshCoupons()
    } catch (error: any) {
      console.error('Error eliminando cupón:', error)
      setCouponsNotice(error?.message || 'No se pudo eliminar el cupón.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-neutral-500">
        <Loader2 className="mr-2 size-6 animate-spin text-[#ef4444]" /> Cargando ajustes...
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <p className="ds-eyebrow">Configuración</p>
        <h1 className="ds-text-gold mt-1 text-3xl tracking-tight">Ajustes del Sistema</h1>
        <p className="mt-1 text-xs font-semibold uppercase" style={{ color: 'var(--ds-txt-3)' }}>
          Tasa de cambio, comisiones, mantenimiento y contacto
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="ds-card max-w-xl space-y-6 rounded-2xl p-6"
      >
        <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
          <div className="flex size-8 items-center justify-center rounded-lg border border-[#ef4444]/20 bg-[#242428]">
            <Settings className="size-4 text-[#ef4444]" />
          </div>
          <h2 className="font-heading text-sm font-black uppercase tracking-widest text-white">
            Configuración General
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Tasa de Cambio (Bs por $1)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={settings.exchangeRate}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  exchangeRate: e.target.value === '' ? 0 : Number(e.target.value),
                }))
              }
              className="ds-input font-mono text-sm font-bold text-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-amber-400">
              Comisión por Defecto (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={settings.commissionPct}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  commissionPct: e.target.value === '' ? 0 : Number(e.target.value),
                }))
              }
              className="ds-input font-mono text-sm font-bold text-amber-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-sky-400">
              Mantenimiento (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={settings.maintenancePct}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  maintenancePct: e.target.value === '' ? 0 : Number(e.target.value),
                }))
              }
              className="ds-input font-mono text-sm font-bold text-sky-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Responsable de Mantenimiento
            </label>
            <input
              type="text"
              value={settings.maintenanceOwner}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, maintenanceOwner: e.target.value }))
              }
              className="ds-input"
              placeholder="Ej. Victor Diaz"
            />
          </div>

          {/* ── DATOS DE COBRO: PAGO MÓVIL ── */}
          <div className="sm:col-span-3">
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Banco (Pago Móvil)
            </label>
            <input
              type="text"
              value={settings.pagoMovilBank}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, pagoMovilBank: e.target.value }))
              }
              className="ds-input"
              placeholder="Ej. Banco de Venezuela"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Teléfono (Pago Móvil)
            </label>
            <input
              type="text"
              value={settings.pagoMovilPhone}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, pagoMovilPhone: e.target.value }))
              }
              className="ds-input font-mono"
              placeholder="Ej. 0412-0000000"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Cédula (Pago Móvil)
            </label>
            <input
              type="text"
              value={settings.pagoMovilCedula}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, pagoMovilCedula: e.target.value }))
              }
              className="ds-input font-mono"
              placeholder="Ej. 32650091"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Correo (Zelle)
            </label>
            <input
              type="email"
              value={settings.zelleEmail}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, zelleEmail: e.target.value }))
              }
              className="ds-input font-mono"
              placeholder="Ej. ejemplo@gmail.com"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Binance Pay ID
            </label>
            <input
              type="text"
              value={settings.binancePayId}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, binancePayId: e.target.value }))
              }
              className="ds-input font-mono"
              placeholder="Ej. 00000000"
            />
          </div>

          {/* ── SEGURIDAD: PIN DE ACCESO ── */}
          <div className="sm:col-span-3 border-t border-white/[0.06] pt-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg border border-[#ef4444]/20 bg-[#242428]">
                <Lock className="size-3.5 text-[#ef4444]" />
              </div>
              <div>
                <h3 className="font-heading text-xs font-black uppercase tracking-widest text-white">
                  Seguridad — PIN de Acceso
                </h3>
                <p className="text-[10px] font-semibold" style={{ color: 'var(--ds-txt-3)' }}>
                  Protege Inventario y Ofertas. Déjalo vacío para desactivar.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
                  Nuevo PIN (4+ dígitos)
                </label>
                <div className="relative">
                  <input
                    type={showPinInput ? 'text' : 'password'}
                    value={settings.adminPin}
                    onChange={(e) => {
                      setSettings((prev) => ({ ...prev, adminPin: e.target.value }))
                      setPinError('')
                    }}
                    className="ds-input ds-input-icon pr-11 font-mono text-sm tracking-[0.3em]"
                    placeholder="••••"
                    maxLength={12}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinInput(!showPinInput)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showPinInput ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
                  Confirmar PIN
                </label>
                <input
                  type={showPinInput ? 'text' : 'password'}
                  value={pinConfirm}
                  onChange={(e) => {
                    setPinConfirm(e.target.value)
                    setPinError('')
                  }}
                  className="ds-input font-mono text-sm tracking-[0.3em]"
                  placeholder="••••"
                  maxLength={12}
                  autoComplete="off"
                />
              </div>
            </div>

            {pinError && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-red-400">
                <AlertCircle className="size-3.5" /> {pinError}
              </p>
            )}

            {settings.adminPin && (
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                PIN activo — Inventario y Ofertas requieren PIN
              </p>
            )}
          </div>
        </div>

        {message && (
          <div
            className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold ${
              message.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : 'border-red-500/40 bg-red-500/10 text-red-400'
            }`}
          >
            <AlertCircle className="size-4" />
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={isSaving}
          className="ds-btn-gold w-full py-3 text-xs uppercase tracking-widest"
        >
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Guardando...
            </>
          ) : (
            <>
              <Save className="size-4" /> Guardar Ajustes
            </>
          )}
        </button>
      </form>

      {/* CUPONES AUTORIZADOS */}
      <div className="ds-card max-w-3xl space-y-5 rounded-2xl p-6">
        <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
          <div className="flex size-8 items-center justify-center rounded-lg border border-[#ef4444]/20 bg-[#242428]">
            <Ticket className="size-4 text-[#ef4444]" />
          </div>
          <div>
            <h2 className="font-heading text-sm font-black uppercase tracking-widest text-white">
              Cupones Autorizados
            </h2>
            <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--ds-txt-3)' }}>
              Solo los cupones activos pueden aplicarse en el POS (ofertas especiales o clientes fijos)
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateCoupon} className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-3">
            <label className="ds-eyebrow mb-1 block">Código</label>
            <input
              type="text"
              required
              placeholder="FIJO10"
              value={couponForm.code}
              onChange={(e) =>
                setCouponForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
              }
              className="ds-input font-mono text-xs uppercase"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="ds-eyebrow mb-1 block">Tipo</label>
            <select
              value={couponForm.discount_type}
              onChange={(e) =>
                setCouponForm((prev) => ({
                  ...prev,
                  discount_type: e.target.value as 'percent' | 'fixed',
                }))
              }
              className="ds-input"
            >
              <option value="percent">% Descuento</option>
              <option value="fixed">$ Descuento</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="ds-eyebrow mb-1 block">Valor</label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              placeholder="10"
              value={couponForm.discount_value}
              onChange={(e) =>
                setCouponForm((prev) => ({ ...prev, discount_value: e.target.value }))
              }
              className="ds-input font-mono text-xs"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="ds-eyebrow mb-1 block">Cliente (opcional)</label>
            <input
              type="text"
              placeholder="Nombre del cliente fijo"
              value={couponForm.customer_name}
              onChange={(e) =>
                setCouponForm((prev) => ({ ...prev, customer_name: e.target.value }))
              }
              className="ds-input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="ds-eyebrow mb-1 block">Usos máx.</label>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="∞"
              value={couponForm.max_uses}
              onChange={(e) =>
                setCouponForm((prev) => ({ ...prev, max_uses: e.target.value }))
              }
              className="ds-input font-mono text-xs"
            />
          </div>
          <div className="sm:col-span-10">
            <label className="ds-eyebrow mb-1 block">Nota (opcional)</label>
            <input
              type="text"
              placeholder="Ej: Oferta Black Friday, cliente habitual..."
              value={couponForm.note}
              onChange={(e) => setCouponForm((prev) => ({ ...prev, note: e.target.value }))}
              className="ds-input"
            />
          </div>
          <div className="flex items-end sm:col-span-2">
            <button
              type="submit"
              disabled={isCreatingCoupon}
              className="ds-btn-gold w-full py-2.5 text-[10px] uppercase tracking-widest"
            >
              {isCreatingCoupon ? '...' : <span className="inline-flex items-center gap-1"><Plus className="size-3" /> Crear</span>}
            </button>
          </div>
        </form>

        {couponsNotice && (
          <p className="rounded-xl border border-white/[0.06] bg-[#1e1e22] px-4 py-3 text-[11px] font-semibold" style={{ color: 'var(--ds-txt-3)' }}>
            {couponsNotice}
          </p>
        )}

        {isLoadingCoupons ? (
          <div className="flex items-center gap-2 p-4 text-xs font-bold uppercase" style={{ color: 'var(--ds-txt-3)' }}>
            <Loader2 className="size-4 animate-spin text-[#ef4444]" /> Cargando cupones...
          </div>
        ) : coupons.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#16161a] text-[10px] uppercase tracking-widest" style={{ color: 'var(--ds-txt-3)' }}>
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Descuento</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Usos</th>
                  <th className="p-3">Nota</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {coupons.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="p-3 font-mono font-black uppercase text-[#ef4444]">{c.code}</td>
                    <td className="p-3 text-white">{describeCoupon(c)}</td>
                    <td className="p-3" style={{ color: 'var(--ds-txt-3)' }}>{c.customer_name || '—'}</td>
                    <td className="p-3 font-mono text-white">
                      {c.uses}
                      {c.max_uses != null ? ` / ${c.max_uses}` : ''}
                    </td>
                    <td className="p-3" style={{ color: 'var(--ds-txt-3)' }}>{c.note || '—'}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${
                          c.is_active
                            ? 'border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]'
                            : 'border-white/[0.08] bg-[#1e1e22] text-neutral-500'
                        }`}
                      >
                        {c.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleCoupon(c)}
                          title={c.is_active ? 'Desactivar' : 'Activar'}
                          className="rounded-lg border border-white/[0.08] bg-[#1e1e22] p-2 text-neutral-400 transition-colors hover:border-[#ef4444]/40 hover:text-[#ef4444]"
                        >
                          <Power className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCoupon(c)}
                          title="Eliminar"
                          className="rounded-lg border border-white/[0.08] bg-[#1e1e22] p-2 text-neutral-400 transition-colors hover:border-red-500/50 hover:text-red-500"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
