import { Package, DollarSign, ShoppingCart } from 'lucide-react'

interface MetricsCardsProps {
  totalRevenue: number
  potentialRevenue: number
  totalStockUnits: number
  salesCount: number
}

export function MetricsCards({
  totalRevenue,
  potentialRevenue,
  totalStockUnits,
  salesCount,
}: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="ds-card ds-anim-in ds-stagger-1 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <p className="ds-eyebrow">Ingreso / Potencial</p>
          <div className="flex size-9 items-center justify-center rounded-xl border border-[#ef4444]/20 bg-[#242428]">
            <DollarSign className="size-4 text-[#ef4444]" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-black text-white">${totalRevenue}</span>
          <span className="text-xs" style={{ color: 'var(--ds-txt-3)' }}>
            (Pot: ${potentialRevenue})
          </span>
        </div>
      </div>

      <div className="ds-card ds-anim-in ds-stagger-2 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <p className="ds-eyebrow">Stock Disponible</p>
          <div className="flex size-9 items-center justify-center rounded-xl border border-[#ef4444]/20 bg-[#242428]">
            <Package className="size-4 text-[#ef4444]" />
          </div>
        </div>
        <p className="mt-3 font-mono text-2xl font-black text-white">
          {totalStockUnits}{' '}
          <span className="text-xs font-normal" style={{ color: 'var(--ds-txt-3)' }}>
            unidades
          </span>
        </p>
      </div>

      <div className="ds-card ds-anim-in ds-stagger-3 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <p className="ds-eyebrow">Unidades Vendidas</p>
          <div className="flex size-9 items-center justify-center rounded-xl border border-[#ef4444]/20 bg-[#242428]">
            <ShoppingCart className="size-4 text-[#ef4444]" />
          </div>
        </div>
        <p className="mt-3 font-mono text-2xl font-black text-white">{salesCount}</p>
      </div>
    </div>
  )
}
