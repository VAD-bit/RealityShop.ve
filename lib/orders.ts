import { supabase } from './supabase'

export type OrderStatus = 'pending_review' | 'verified' | 'payment_error'
export type DeliveryMethod = 'delivery' | 'pickup'

export interface OrderItem {
  product_id: string
  inventory_id: string
  unit_price: number
  total_price: number
  quantity: number
}

export interface OrderPayload {
  items: OrderItem[]
  advisor: string
  customer: string
  customerPhone: string
  paymentMethod: string
  paymentReference: string
  screenshotUrl: string
  deliveryMethod: DeliveryMethod
  deliveryAddress: string
  deliveryLat: number | null
  deliveryLng: number | null
  customerNotes: string
  total: number
}

export interface OrderRecord {
  id: string
  product_id?: string
  advisor_name?: string
  customer_name?: string
  customer_phone?: string | null
  total_price: number
  quantity: number
  payment_status?: string
  payment_method?: string | null
  payment_reference?: string | null
  payment_screenshot_url?: string | null
  delivery_method?: string | null
  delivery_lat?: number | null
  delivery_lng?: number | null
  delivery_address?: string | null
  customer_notes?: string | null
  order_status?: OrderStatus | null
  admin_notes?: string | null
  created_at: string
  sale_ref?: string | null
  products?: {
    name: string
    category: string
    price?: number
    cost_price?: number
  }
}

/**
 * Registra un pedido web completo:
 * - Inserta una fila en sales por cada ítem (order_status = 'pending_review')
 * - Descuenta stock del inventario
 * - Registra el movimiento de inventario
 * No usa RPC para que el cliente pueda subir el screenshot y los datos de entrega.
 */
export async function processOrder(payload: OrderPayload): Promise<{ ok: boolean; error?: string }> {
  const saleRef = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  try {
    for (const item of payload.items) {
      const { error: saleError } = await supabase.from('sales').insert({
        product_id: item.product_id,
        inventory_id: item.inventory_id,
        advisor_name: payload.advisor,
        customer_name: payload.customer || 'Cliente Web',
        customer_phone: payload.customerPhone,
        unit_price: item.unit_price,
        total_price: item.total_price,
        quantity: item.quantity,
        quantity_paid: 0,
        quantity_pending: item.quantity,
        payment_status: 'por_cobrar',
        payment_method: payload.paymentMethod,
        payment_reference: payload.paymentReference,
        payment_screenshot_url: payload.screenshotUrl,
        delivery_method: payload.deliveryMethod,
        delivery_lat: payload.deliveryLat,
        delivery_lng: payload.deliveryLng,
        delivery_address: payload.deliveryAddress,
        customer_notes: payload.customerNotes,
        order_status: 'pending_review',
        sale_ref: saleRef,
        created_at: createdAt,
      })

      if (saleError) throw saleError

      // Descuento de stock
      const { data: inv, error: invErr } = await supabase
        .from('inventory')
        .select('stock, product_id')
        .eq('id', item.inventory_id)
        .single()

      if (!invErr && inv) {
        const newStock = Math.max(0, (Number(inv.stock) || 0) - item.quantity)
        await supabase.from('inventory').update({ stock: newStock }).eq('id', item.inventory_id)

        await supabase.from('inventory_movements').insert({
          product_id: item.product_id,
          inventory_id: item.inventory_id,
          type: 'venta',
          quantity: -item.quantity,
          reason: `Pedido web ${saleRef.slice(0, 8)}`,
          advisor_name: payload.advisor,
        })
      }
    }

    return { ok: true }
  } catch (error: any) {
    console.error('Error registrando pedido web:', error)
    return { ok: false, error: error?.message || 'Error desconocido' }
  }
}

/**
 * Sube una captura de pago a Supabase Storage y devuelve la URL pública.
 */
export async function uploadPaymentProof(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png'
  const path = `proofs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from('payment-proofs').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (error) throw error

  const { data } = supabase.storage.from('payment-proofs').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Actualiza el estado de un pedido y el estado de pago.
 */
export async function updateOrderStatus(
  saleId: string,
  orderStatus: OrderStatus,
  paymentStatus: 'pagado' | 'por_cobrar',
  adminNotes?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const updateData: any = {
      order_status: orderStatus,
      payment_status: paymentStatus,
    }

    if (paymentStatus === 'pagado') {
      updateData.quantity_paid = undefined // will be set by caller if needed
    }

    if (adminNotes !== undefined) {
      updateData.admin_notes = adminNotes
    }

    const { error } = await supabase.from('sales').update(updateData).eq('id', saleId)

    if (error) throw error
    return { ok: true }
  } catch (error: any) {
    return { ok: false, error: error?.message }
  }
}

/**
 * Marca todas las filas de un mismo pedido (mismo sale_ref) con el mismo estado.
 * Útil porque cada ítem del carrito es una fila en sales.
 */
export async function updateOrderByRef(
  saleRef: string,
  orderStatus: OrderStatus,
  paymentStatus: 'pagado' | 'por_cobrar',
  adminNotes?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: rows } = await supabase
      .from('sales')
      .select('id, quantity')
      .eq('sale_ref', saleRef)

    const updateData: any = {
      order_status: orderStatus,
      payment_status: paymentStatus,
    }

    if (adminNotes !== undefined) {
      updateData.admin_notes = adminNotes
    }

    if (paymentStatus === 'pagado') {
      // marcar todas las unidades como contadas
      const { data: fullRows } = await supabase
        .from('sales')
        .select('id, quantity')
        .eq('sale_ref', saleRef)

      for (const row of fullRows || []) {
        await supabase
          .from('sales')
          .update({ ...updateData, quantity_paid: row.quantity, quantity_pending: 0 })
          .eq('id', row.id)
      }
    } else {
      const { error } = await supabase.from('sales').update(updateData).eq('sale_ref', saleRef)
      if (error) throw error
    }

    return { ok: true }
  } catch (error: any) {
    return { ok: false, error: error?.message }
  }
}

/**
 * Obtiene pedidos agrupados por sale_ref.
 */
export async function getOrders(status?: OrderStatus): Promise<OrderRecord[]> {
  let query = supabase
    .from('sales')
    .select('*, products(name, category, price, cost_price)')
    .not('order_status', 'is', null)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('order_status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching orders:', error.message)
    return []
  }

  return (data as OrderRecord[]) || []
}

/**
 * Agrupa las filas de sales por sale_ref para mostrar un pedido completo.
 */
export interface GroupedOrder {
  sale_ref: string
  items: OrderRecord[]
  customer_name: string
  customer_phone: string | null
  advisor_name: string
  payment_method: string
  payment_reference: string | null
  payment_screenshot_url: string | null
  delivery_method: string | null
  delivery_lat: number | null
  delivery_lng: number | null
  delivery_address: string | null
  customer_notes: string | null
  order_status: OrderStatus
  admin_notes: string | null
  total: number
  created_at: string
  product_names: string
}

export function groupOrdersByRef(rows: OrderRecord[]): GroupedOrder[] {
  const map = new Map<string, GroupedOrder>()

  for (const row of rows) {
    const ref = row.sale_ref || row.id
    if (!map.has(ref)) {
      map.set(ref, {
        sale_ref: ref,
        items: [],
        customer_name: row.customer_name || 'Cliente',
        customer_phone: row.customer_phone || null,
        advisor_name: row.advisor_name || 'General',
        payment_method: row.payment_method || '',
        payment_reference: row.payment_reference || null,
        payment_screenshot_url: row.payment_screenshot_url || null,
        delivery_method: row.delivery_method || null,
        delivery_lat: row.delivery_lat || null,
        delivery_lng: row.delivery_lng || null,
        delivery_address: row.delivery_address || null,
        customer_notes: row.customer_notes || null,
        order_status: (row.order_status as OrderStatus) || 'pending_review',
        admin_notes: row.admin_notes || null,
        total: 0,
        created_at: row.created_at,
        product_names: '',
      })
    }
    const order = map.get(ref)!
    order.items.push(row)
    order.total += Number(row.total_price) || 0
    if (row.products?.name) {
      order.product_names = order.product_names
        ? `${order.product_names}, ${row.products.name}`
        : row.products.name
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

/**
 * Construye el mensaje de WhatsApp para verificar un pedido.
 */
export function buildWhatsAppVerifyMessage(order: GroupedOrder, adminName?: string): string {
  const lines = [
    `✅ *Pago verificado — Reality Shop*`,
    ``,
    `Hola ${order.customer_name}, tu pago fue verificado correctamente.`,
    ``,
    `🧾 *Pedido:* ${order.sale_ref.slice(0, 8).toUpperCase()}`,
    `👟 *Productos:* ${order.product_names || '—'}`,
    `💰 *Total:* $${order.total.toFixed(2)}`,
    `💳 *Método:* ${order.payment_method}`,
    ``,
    `Tu pedido ya está siendo procesado.${adminName ? ` El asesor *${adminName}*` : ' Un asesor'} se comunicará contigo para continuar.`,
    ``,
    `¡Gracias por comprar en Reality Shop! 👟🔥`,
  ]
  return lines.join('\n')
}

/**
 * Construye el mensaje de WhatsApp para error de pago.
 */
export function buildWhatsAppErrorMessage(order: GroupedOrder): string {
  const lines = [
    `⚠️ *Problema con tu pago — Reality Shop*`,
    ``,
    `Hola ${order.customer_name}, tuvimos un problema al verificar tu pago.`,
    ``,
    `🧾 *Pedido:* ${order.sale_ref.slice(0, 8).toUpperCase()}`,
    `💳 *Método:* ${order.payment_method}`,
    order.payment_reference ? `📎 *Referencia:* ${order.payment_reference}` : '',
    ``,
    `Un asesor se comunicará contigo de inmediato para ayudarte a resolverlo.`,
    ``,
    `Disculpa las molestias 🙏`,
  ]
  return lines.filter(Boolean).join('\n')
}

/**
 * Abre WhatsApp con el mensaje pre-cargado.
 */
export function openWhatsApp(phone: string, message: string) {
  const clean = phone.replace(/[^\d+]/g, '')
  const digits = clean.startsWith('+') ? clean.slice(1) : clean
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
  window.open(url, '_blank')
}

/**
 * URL de Google Maps para las coordenadas del pedido (delivery).
 */
export function getGoogleMapsUrl(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null
  return `https://www.google.com/maps?q=${lat},${lng}`
}

/**
 * URL de embed de Google Maps (sin API key).
 */
export function getGoogleMapsEmbedUrl(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null
  return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`
}
