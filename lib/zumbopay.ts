import crypto from 'crypto'

const API_URL = 'https://zumbopay.com/api/public/v1'

function apiKey(): string {
  return (process.env.ZUMBOPAY_API_KEY ?? '').trim()
}

async function request(method: string, path: string, body?: object) {
  const key = apiKey()
  if (!key) return { status: 400, data: { success: false, error: 'API key não configurada' } }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}),
  })

  const data = await res.json().catch(() => ({ success: false, error: 'Empty response' }))
  return { status: res.status, data }
}

export async function createCharge(params: {
  wallet_id: string
  amount: number
  msisdn: string
  customer_name: string
  source_id: string
}) {
  return request('POST', '/charges', params)
}

export async function getPayment(reference: string) {
  return request('GET', `/payments/${encodeURIComponent(reference)}`)
}

export async function listWallets() {
  return request('GET', '/wallets')
}

export function verifyWebhookSignature(rawBody: string, signature: string, timestamp: string): boolean {
  const secret = (process.env.ZUMBOPAY_WEBHOOK_SECRET ?? '').trim()
  if (!secret) return false

  const sig = signature.replace(/^sha256=/i, '').trim()
  const tsNum = parseInt(timestamp, 10)
  if (!tsNum || Math.abs(Date.now() - tsNum) > 300000) return false

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))
  } catch {
    return expected === sig
  }
}

export const WALLETS = {
  mpesa: process.env.ZUMBOPAY_WALLET_MPESA ?? '',
  emola: process.env.ZUMBOPAY_WALLET_EMOLA ?? '',
}

export function emolaePinConfirmed(auth: Record<string, any>): boolean {
  if (auth.pin_verified || auth.pin_confirmed || auth.pin_confirmed_at) return true
  const provider = String(auth.provider_status ?? '').toUpperCase()
  if (['PIN_CONFIRMED', 'COMPLETED_WITH_PIN', 'AUTHORIZED_BY_PIN', 'SUCCESS'].includes(provider)) return true
  const meta = auth.metadata
  if (meta && typeof meta === 'object') {
    if (meta.pin_verified || meta.emola_pin_ok) return true
  }
  return false
}
