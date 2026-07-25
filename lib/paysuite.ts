import crypto from 'crypto'

const API_URL = 'https://paysuite.tech/api/v1'

function apiToken(): string {
  return (process.env.PAYSUITE_API_TOKEN ?? '').trim()
}

async function request(method: string, path: string, body?: object) {
  const token = apiToken()
  if (!token) return { status: 400, data: { status: 'error', message: 'API token não configurado' } }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}),
  })

  const data = await res.json().catch(() => ({ status: 'error', message: 'Empty response' }))
  return { status: res.status, data }
}

export async function createPayment(params: {
  amount: number
  reference: string
  method?: 'mpesa' | 'emola'
  description?: string
  return_url?: string
  callback_url?: string
}) {
  return request('POST', '/payments', params)
}

export async function getPayment(id: string) {
  return request('GET', `/payments/${encodeURIComponent(id)}`)
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = (process.env.PAYSUITE_WEBHOOK_SECRET ?? '').trim()
  if (!secret || !signature) return false

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}
