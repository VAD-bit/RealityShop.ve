import { createClient } from './supabase/client'

const supabase = createClient()

export interface Customer {
  id: string
  auth_user_id: string
  name: string
  email: string | null
  phone: string | null
  preferred_gender: string | null
  preferred_categories: string[]
  preferred_brands: string[]
  preferred_sizes: string[]
  notify_offers: boolean
  notify_orders: boolean
  notify_new_arrivals: boolean
  created_at?: string
}

export interface Notification {
  id: string
  customer_id: string
  type: 'offer' | 'order' | 'new_arrival' | 'system'
  title: string
  message: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export async function getCustomerByAuthUser(authUserId: string): Promise<Customer | null> {
  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  return data as Customer | null
}

export async function createCustomer(payload: {
  authUserId: string
  name: string
  email: string
  phone?: string
}): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      auth_user_id: payload.authUserId,
      name: payload.name,
      email: payload.email,
      phone: payload.phone || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creando cliente:', error.message)
    return null
  }
  return data as Customer
}

export async function updateCustomer(id: string, patch: Partial<Customer>): Promise<boolean> {
  const { error } = await supabase
    .from('customers')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  return !error
}

export async function getCustomerNotifications(customerId: string): Promise<Notification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50)
  return (data as Notification[]) || []
}

export async function getUnreadCount(customerId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('is_read', false)
  return count || 0
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id)
}

export async function markAllNotificationsRead(customerId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('customer_id', customerId)
    .eq('is_read', false)
}

// Enviar notificación desde admin (authenticated)
export async function sendNotification(payload: {
  customerId?: string
  customerIds?: string[]
  type: 'offer' | 'order' | 'new_arrival' | 'system'
  title: string
  message?: string
  link?: string
}): Promise<number> {
  let targetIds: string[] = []

  if (payload.customerIds && payload.customerIds.length > 0) {
    targetIds = payload.customerIds
  } else if (payload.customerId) {
    targetIds = [payload.customerId]
  } else {
    // Todos los clientes (respetando preferencias)
    const { data: allCustomers } = await supabase
      .from('customers')
      .select('id, notify_offers, notify_orders, notify_new_arrivals')

    targetIds = (allCustomers || [])
      .filter((c: any) => {
        if (payload.type === 'offer') return c.notify_offers
        if (payload.type === 'order') return c.notify_orders
        if (payload.type === 'new_arrival') return c.notify_new_arrivals
        return true
      })
      .map((c: any) => c.id)
  }

  if (targetIds.length === 0) return 0

  const rows = targetIds.map((cid) => ({
    customer_id: cid,
    type: payload.type,
    title: payload.title,
    message: payload.message || null,
    link: payload.link || null,
  }))

  const { error, count } = await supabase.from('notifications').insert(rows)
  if (error) {
    console.error('Error enviando notificaciones:', error.message)
    return 0
  }
  return count || rows.length
}

// Obtener todos los clientes (admin)
export async function getAllCustomers(): Promise<Customer[]> {
  const { data } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })
  return (data as Customer[]) || []
}
