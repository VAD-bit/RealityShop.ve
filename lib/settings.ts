import { createClient } from './supabase/client'

const supabase = createClient()

export interface AppSettings {
  exchangeRate: number
  commissionPct: number
  maintenancePct: number
  maintenanceOwner: string
  pagoMovilBank: string
  pagoMovilPhone: string
  pagoMovilCedula: string
  zelleEmail: string
  binancePayId: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  exchangeRate: 1,
  commissionPct: 5,
  maintenancePct: 3,
  maintenanceOwner: 'Victor Diaz',
  pagoMovilBank: '',
  pagoMovilPhone: '',
  pagoMovilCedula: '',
  zelleEmail: '',
  binancePayId: '',
}

const LS_KEY = 'rs_admin_settings'
let cache: AppSettings | null = null

function fromRows(rows: { key: string; value: string }[]): AppSettings {
  const map: Record<string, string> = {}
  rows.forEach((r) => {
    map[r.key] = r.value
  })

  const num = (key: string, fallback: number) => {
    const raw = map[key]
    if (raw === undefined || raw === '') return fallback
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  return {
    exchangeRate: num('exchange_rate', DEFAULT_SETTINGS.exchangeRate),
    commissionPct: num('commission_pct', DEFAULT_SETTINGS.commissionPct),
    maintenancePct: num('maintenance_pct', DEFAULT_SETTINGS.maintenancePct),
    maintenanceOwner: map['maintenance_owner'] || DEFAULT_SETTINGS.maintenanceOwner,
    pagoMovilBank: map['pago_movil_bank'] || '',
    pagoMovilPhone: map['pago_movil_phone'] || map['payment_phone'] || '',
    pagoMovilCedula: map['pago_movil_cedula'] || '',
    zelleEmail: map['zelle_email'] || '',
    binancePayId: map['binance_pay_id'] || '',
  }
}

export function resetSettingsCache() {
  cache = null
}

export async function getSettings(): Promise<AppSettings> {
  if (cache) return cache

  let local: Partial<AppSettings> | null = null
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LS_KEY) : null
    if (raw) local = JSON.parse(raw)
  } catch {
    local = null
  }

  try {
    const { data, error } = await supabase.from('settings').select('key, value')
    if (!error && data && data.length > 0) {
      cache = fromRows(data)
      try {
        window.localStorage.setItem(LS_KEY, JSON.stringify(cache))
      } catch {
        /* noop */
      }
      return cache
    }
  } catch {
    /* tabla aún no creada: usamos fallback */
  }

  cache = { ...DEFAULT_SETTINGS, ...(local || {}) }
  return cache
}

export async function saveSettings(next: AppSettings): Promise<void> {
  cache = { ...next }

  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(next))
  } catch {
    /* noop */
  }

  const { error } = await supabase
    .from('settings')
    .upsert(
      [
        { key: 'exchange_rate', value: String(next.exchangeRate) },
        { key: 'commission_pct', value: String(next.commissionPct) },
        { key: 'maintenance_pct', value: String(next.maintenancePct) },
        { key: 'maintenance_owner', value: next.maintenanceOwner },
        { key: 'pago_movil_bank', value: next.pagoMovilBank || '' },
        { key: 'pago_movil_phone', value: next.pagoMovilPhone || '' },
        { key: 'pago_movil_cedula', value: next.pagoMovilCedula || '' },
        { key: 'zelle_email', value: next.zelleEmail || '' },
        { key: 'binance_pay_id', value: next.binancePayId || '' },
      ],
      { onConflict: 'key' }
    )

  if (error) throw error
}
