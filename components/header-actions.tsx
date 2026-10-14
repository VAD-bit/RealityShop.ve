'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ShoppingBag, LayoutDashboard, LogOut, Lock } from 'lucide-react'

export function HeaderActions() {
  const { isAdmin, logout } = useAuth()
  const [showLoginModal, setShowLoginModal] = useState(false)

  return (
    <div className="flex items-center gap-2">
      {isAdmin ? (
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-md border border-primary bg-primary/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary transition-all hover:bg-primary hover:text-primary-foreground"
          >
            <LayoutDashboard className="size-4" />
            <span className="hidden sm:inline">Panel Admin</span>
          </Link>

          <button
            onClick={logout}
            className="rounded-md border border-border bg-secondary p-2 text-muted-foreground hover:text-destructive"
            title="Cerrar Sesión Admin"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {/* Abrir drawer de compras */}}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:border-primary"
            aria-label="Shopping Cart"
          >
            <ShoppingBag className="size-5" />
          </button>

          <button
            onClick={() => setShowLoginModal(true)}
            className="p-1 text-muted-foreground/40 hover:text-foreground"
            title="Acceso Admin"
          >
            <Lock className="size-3.5" />
          </button>
        </div>
      )}