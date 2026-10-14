'use client'

import { X, UserCheck, Loader2 } from 'lucide-react'
import { ProductItem } from '@/lib/types'
import { ADVISORS } from '@/lib/constants'

interface SaleModalProps {
  isOpen: boolean
  onClose: () => void
  product: ProductItem | null
  selectedAdvisor: string
  setSelectedAdvisor: (advisor: string) => void
  saleItems: Record<string, number>
  onQuantityChange: (key: string, qty: number, maxStock: number) => void
  onConfirmSale: () => void
  isProcessing: boolean
  advisors?: { id: string; name: string }[]
}

export function SaleModal({
  isOpen,
  onClose,
  product,
  selectedAdvisor,
  setSelectedAdvisor,
  saleItems,
  onQuantityChange,
  onConfirmSale,
  isProcessing,
  advisors = ADVISORS,
}: SaleModalProps) {
  if (!isOpen || !product) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="ds-card relative my-8 w-full max-w-[540px] rounded-[28px] p-6 shadow-2xl sm:p-8">
        <button onClick={onClose} className="absolute right-6 top-6 text-neutral-400 transition-colors hover:text-white">
          <X className="size-5" />
        </button>

        <div className="space-y-6">
          <div>
            <p className="ds-eyebrow">Registrar venta</p>
            <h3 className="ds-text-gold mt-1 text-xl tracking-tight">{product.name}</h3>
            <p className="mt-1 text-xs font-semibold uppercase" style={{ color: 'var(--ds-txt-3)' }}>
              Precio unitario: <span className="text-white">${product.price}</span>
            </p>
          </div>

          <div className="space-y-2">
            <label className="ds-eyebrow flex items-center gap-1.5">
              <UserCheck className="size-3.5 text-[#ef4444]" /> Selecciona el Asesor
            </label>
            <select
              value={selectedAdvisor}
              onChange={(e) => setSelectedAdvisor(e.target.value)}
              className="ds-input cursor-pointer"
            >
              {advisors.map((advisor) => (
                <option key={advisor.id} value={advisor.name}>
                  {advisor.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <label className="ds-eyebrow">Selecciona Tallas / Variantes y Cantidad Vendida</label>

            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {product.inventory.filter((i) => i.stock > 0).length === 0 ? (
                <p className="p-2 text-xs italic" style={{ color: 'var(--ds-txt-3)' }}>
                  No hay stock disponible para vender.
                </p>
              ) : (
                product.inventory
                  .filter((inv) => inv.stock > 0)
                  .map((inv) => {
                    const key = inv.id || inv.size_or_detail
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#1e1e22] p-3"
                      >
                        <div>
                          <span className="block font-mono text-xs font-bold uppercase text-white">
                            Talla: {inv.size_or_detail}
                          </span>
                          <span className="block font-mono text-[10px]" style={{ color: 'var(--ds-txt-3)' }}>
                            Stock disponible: <strong className="text-[#ef4444]">{inv.stock}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold" style={{ color: 'var(--ds-txt-3)' }}>Cant:</span>
                          <input
                            type="number"
                            min="0"
                            max={inv.stock}
                            value={saleItems[key] || 0}
                            onChange={(e) =>
                              onQuantityChange(key, parseInt(e.target.value) || 0, inv.stock)
                            }
                            className="w-16 rounded-xl border border-white/[0.08] bg-[#1e1e22] px-2 py-1.5 text-center font-mono text-xs font-black text-white focus:border-[#ef4444]/50 focus:outline-none"
                          />
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onConfirmSale}
            disabled={isProcessing}
            className="ds-btn-gold w-full py-4 text-xs uppercase tracking-widest"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Procesando venta...
              </span>
            ) : (
              'Confirmar y restar del stock'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
