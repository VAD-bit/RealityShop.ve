'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { createAuthClient } from '@/lib/supabase/auth-client'
import { getUserProfile } from '@/lib/auth'
import { OrdersPanel } from '@/components/orders-panel'

export default function AdvisorPedidosPage() {
  const [advisorName, setAdvisorName] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createAuthClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      const profile = await getUserProfile(user?.email)
      setAdvisorName(profile?.advisor_name || '')
    })
  }, [])

  if (advisorName === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#ef4444]" />
      </div>
    )
  }

  return (
    <OrdersPanel
      advisorFilter={advisorName}
      isLoadingProfile={advisorName === null}
      title="Mis Pedidos"
    />
  )
}
