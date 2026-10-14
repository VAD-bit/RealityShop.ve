'use client'

import { AtSign, Clock, CreditCard, ArrowUpRight } from 'lucide-react'

export function Footer() {
  return (
    <footer id="about" className="border-t border-white/10 bg-black/40">
      <div className="mx-auto max-w-[1600px] px-5 py-16 md:px-8 md:py-24">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          {/* Marca */}
          <div className="md:col-span-5">
            <p className="font-heading text-4xl font-black uppercase leading-none tracking-tight md:text-5xl">
              Reality<span className="text-primary">.</span>Shop
            </p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              La mejor experiencia en zapatillas, perfumes y accesorios premium en Venezuela.
            </p>
            <a
              href="https://instagram.com/realityshop.ve"
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-xs font-bold uppercase tracking-widest transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
            >
              <AtSign className="size-4" />
              @realityshop.ve
              <ArrowUpRight className="size-3.5 opacity-0 transition-all group-hover:opacity-100" />
            </a>
          </div>

          {/* Horario */}
          <div className="md:col-span-3">
            <h3 className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-primary">
              <Clock className="size-3.5" />
              Horario
            </h3>
            <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
              <li className="flex justify-between gap-4 border-b border-white/5 pb-3">
                <span>Lun — Vie</span>
                <span className="font-mono font-bold text-foreground">9:00 — 19:00</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-white/5 pb-3">
                <span>Sábado</span>
                <span className="font-mono font-bold text-foreground">10:00 — 17:00</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Domingo</span>
                <span className="font-mono font-bold text-foreground">10:00 — 17:00</span>
              </li>
            </ul>
          </div>

          {/* Pagos */}
          <div className="md:col-span-4">
            <h3 className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-primary">
              <CreditCard className="size-3.5" />
              Formas de pago
            </h3>
            <div className="mt-5 flex flex-wrap gap-2">
              {['Efectivo', 'Zelle', 'Pago Móvil', 'Transferencia', 'Binance', 'Wally'].map(
                (method) => (
                  <span
                    key={method}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-foreground/70"
                  >
                    {method}
                  </span>
                )
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/8 pt-8 text-center sm:flex-row sm:text-left">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            © {new Date().getFullYear()} Reality Shop — Step Into Reality
          </p>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Mejor calzado, Mejor persona
          </p>
        </div>
      </div>
    </footer>
  )
}
