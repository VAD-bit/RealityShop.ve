'use client'

import { useState } from 'react'
import { Bell, X, Check, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface NotifyButtonProps {
  productId: string
  productName: string
  allSizes: string[]
  category?: string
}

export function NotifyButton({ productId, productName, allSizes, category }: NotifyButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedSize, setSelectedSize] = useState('')
  const [contact, setContact] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!selectedSize) {
      alert('Selecciona una talla o variante.')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('product_votes').insert({
        product_id: productId,
        size_or_detail: selectedSize,
        customer_contact: contact || null,
      })

      if (error) throw error
      setIsSubmitted(true)
      setTimeout(() => {
        setIsOpen(false)
        setIsSubmitted(false)
        setSelectedSize('')
        setContact('')
      }, 2200)
    } catch (error) {
      console.error('Error guardando voto:', error)
      alert('Error al guardar. Intenta de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const variantLabel = category === 'perfumes' ? 'Volumen' : 'Talla'

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 py-3 font-heading text-[11px] font-black uppercase tracking-widest text-primary transition-all duration-300 hover:bg-primary hover:text-white"
      >
        <Bell className="size-4" />
        Avisarme cuando esté disponible
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-heading text-lg font-black uppercase tracking-wider text-white">
                Avisarme
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-neutral-400 transition hover:text-white"
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </button>
            </div>

            {isSubmitted ? (
              <div className="flex flex-col items-center gap-4 py-10">
                <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15">
                  <Check className="size-8 text-emerald-400" />
                </div>
                <p className="font-heading text-lg font-bold text-white">¡Te avisaremos!</p>
                <p className="max-w-xs text-center text-sm text-neutral-400">
                  Te notificaremos cuando <strong className="text-white">{productName}</strong> vuelva a estar disponible.
                </p>
              </div>
            ) : (
              <div className="space-y-5 pt-5">
                <p className="text-sm text-neutral-300">
                  Selecciona {variantLabel.toLowerCase()} que buscas y te avisaremos cuando vuelva a estar disponible.
                </p>

                {allSizes.length > 0 && (
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
                      {variantLabel} / Variante
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {allSizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className={`min-w-[44px] rounded-xl border px-3.5 py-2.5 text-sm font-bold transition-all duration-200 ${
                            selectedSize === size
                              ? 'border-primary bg-primary text-white'
                              : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-400">
                    Tu contacto (opcional)
                  </label>
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="WhatsApp o correo"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-primary"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-heading text-xs font-black uppercase tracking-widest text-white transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Bell className="size-4" />
                      Avisarme
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
