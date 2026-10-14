'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import {
  Vote,
  Trash2,
  Loader2,
  PackageSearch,
  Bell,
  Users,
  TrendingUp,
  Crown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface VoteRecord {
  id: string
  product_id: string
  size_or_detail: string | null
  customer_contact: string | null
  created_at: string
  products?: {
    name: string
    category: string
    image: string
  } | null
}

interface ProductGroup {
  productId: string
  name: string
  category: string
  image: string
  totalVotes: number
  sizes: { size: string; count: number }[]
  contacts: string[]
  votes: VoteRecord[]
}

export default function VotacionesPage() {
  const [votes, setVotes] = useState<VoteRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeletingAll, setIsDeletingAll] = useState(false)

  const supabase = createClient()

  const fetchVotes = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('product_votes')
      .select('*, products(name, category, image)')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setVotes(data as VoteRecord[])
    } else if (error) {
      console.error('Error cargando votos:', error.message)
    }
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchVotes()
  }, [fetchVotes])

  // Agrupar por producto
  const groups: ProductGroup[] = Object.values(
    votes.reduce((acc: Record<string, ProductGroup>, v) => {
      const pid = v.product_id
      if (!acc[pid]) {
        acc[pid] = {
          productId: pid,
          name: v.products?.name || 'Producto desconocido',
          category: v.products?.category || '',
          image: v.products?.image || '',
          totalVotes: 0,
          sizes: [],
          contacts: [],
          votes: [],
        }
      }
      acc[pid].totalVotes++
      acc[pid].votes.push(v)

      if (v.size_or_detail) {
        const existing = acc[pid].sizes.find((s) => s.size === v.size_or_detail)
        if (existing) {
          existing.count++
        } else {
          acc[pid].sizes.push({ size: v.size_or_detail, count: 1 })
        }
      }

      if (v.customer_contact) {
        acc[pid].contacts.push(v.customer_contact)
      }

      return acc
    }, {})
  ).sort((a, b) => b.totalVotes - a.totalVotes)

  const totalVotes = votes.length
  const totalProducts = groups.length
  const topProduct = groups[0] || null

  const handleDeleteVote = async (id: string) => {
    if (!confirm('¿Eliminar este voto?')) return
    setDeletingId(id)
    try {
      const { error } = await supabase.from('product_votes').delete().eq('id', id)
      if (error) throw error
      setVotes((prev) => prev.filter((v) => v.id !== id))
    } catch (error) {
      console.error('Error eliminando voto:', error)
      alert('Error al eliminar.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteProductVotes = async (productId: string, productName: string) => {
    if (!confirm(`¿Eliminar TODOS los votos de "${productName}"?`)) return
    try {
      const { error } = await supabase
        .from('product_votes')
        .delete()
        .eq('product_id', productId)
      if (error) throw error
      setVotes((prev) => prev.filter((v) => v.product_id !== productId))
    } catch (error) {
      console.error('Error eliminando votos:', error)
      alert('Error al eliminar.')
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm('¿Eliminar TODOS los votos? Esta acción no se puede deshacer.')) return
    setIsDeletingAll(true)
    try {
      const { error } = await supabase.from('product_votes').delete().neq('id', '')
      if (error) throw error
      setVotes([])
    } catch (error) {
      console.error('Error eliminando todos los votos:', error)
      alert('Error al eliminar.')
    } finally {
      setIsDeletingAll(false)
    }
  }

  return (
    <div className="ds-root space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="ds-eyebrow ds-stagger-1">Panel de Votaciones</p>
          <h1 className="ds-text-gold mt-1 text-3xl tracking-tight">Avisos de Disponibilidad</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Productos que los clientes quieren que vuelvan a estar disponibles.
          </p>
        </div>
        {votes.length > 0 && (
          <button
            onClick={handleDeleteAll}
            disabled={isDeletingAll}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            {isDeletingAll ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Borrar todos
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="ds-stagger-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="ds-card ds-card-hover rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-red-500/10">
              <Bell className="size-5 text-red-400" />
            </div>
            <div>
              <p className="ds-eyebrow">Total avisos</p>
              <p className="font-mono text-2xl font-black text-white">{totalVotes}</p>
            </div>
          </div>
        </div>
        <div className="ds-card ds-card-hover rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10">
              <PackageSearch className="size-5 text-amber-400" />
            </div>
            <div>
              <p className="ds-eyebrow">Productos pedidos</p>
              <p className="font-mono text-2xl font-black text-white">{totalProducts}</p>
            </div>
          </div>
        </div>
        <div className="ds-card ds-card-hover rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <Crown className="size-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="ds-eyebrow">Más pedido</p>
              <p className="truncate text-sm font-bold text-white">
                {topProduct ? topProduct.name : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de productos votados */}
      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="size-8 animate-spin rounded-full border-2 border-white/10 border-t-red-500" />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">
              Cargando votos
            </p>
          </div>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/10">
          <Vote className="size-10 text-neutral-500" />
          <p className="font-heading text-lg font-black uppercase tracking-wide text-white">
            Sin votos aún
          </p>
          <p className="max-w-sm text-center text-sm text-neutral-400">
            Cuando los clientes hagan clic en &quot;Avisarme cuando esté disponible&quot;, sus
            solicitudes aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.productId} className="ds-card rounded-2xl p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                {/* Imagen + info */}
                <div className="flex items-center gap-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
                    {group.image ? (
                      <Image
                        src={group.image}
                        alt={group.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <PackageSearch className="size-6 text-neutral-500" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-heading text-base font-bold uppercase text-white">
                      {group.name}
                    </h3>
                    <p className="text-xs font-semibold uppercase text-neutral-400">
                      {group.category}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-red-400">
                      <Users className="size-3" />
                      {group.totalVotes} aviso{group.totalVotes !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Tallas más pedidas */}
                <div className="flex-1">
                  <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                    Tallas solicitadas
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.sizes.length > 0 ? (
                      group.sizes
                        .sort((a, b) => b.count - a.count)
                        .map((s) => (
                          <span
                            key={s.size}
                            className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400"
                          >
                            {s.size}
                            <span className="font-mono text-[10px] text-red-300/70">
                              ×{s.count}
                            </span>
                          </span>
                        ))
                    ) : (
                      <span className="text-xs text-neutral-500">Sin talla especificada</span>
                    )}
                  </div>
                </div>

                {/* Contactos */}
                {group.contacts.length > 0 && (
                  <div className="md:w-48">
                    <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                      Contactos
                    </p>
                    <div className="space-y-0.5">
                      {group.contacts.slice(0, 3).map((c, i) => (
                        <p key={i} className="truncate text-xs text-neutral-300">
                          {c}
                        </p>
                      ))}
                      {group.contacts.length > 3 && (
                        <p className="text-xs text-neutral-500">
                          +{group.contacts.length - 3} más
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Acciones */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeleteProductVotes(group.productId, group.name)}
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold uppercase text-neutral-400 transition hover:border-red-500/40 hover:text-red-400"
                  >
                    Borrar todos
                  </button>
                </div>
              </div>

              {/* Votos individuales */}
              {group.votes.length > 0 && (
                <div className="mt-4 border-t border-white/5 pt-4">
                  <div className="flex flex-wrap gap-2">
                    {group.votes.map((vote) => (
                      <div
                        key={vote.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-1.5 text-xs"
                      >
                        <span className="text-neutral-300">
                          {vote.size_or_detail || '—'}
                        </span>
                        {vote.customer_contact && (
                          <span className="text-neutral-500">{vote.customer_contact}</span>
                        )}
                        <button
                          onClick={() => handleDeleteVote(vote.id)}
                          disabled={deletingId === vote.id}
                          className="text-neutral-500 transition hover:text-red-400 disabled:opacity-50"
                          aria-label="Eliminar voto"
                        >
                          {deletingId === vote.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Trash2 className="size-3" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
