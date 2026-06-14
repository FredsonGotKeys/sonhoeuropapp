const BASE_URL = 'https://paysuite.tech/api/v1'
const TOKEN = process.env.PAYSUITE_TOKEN!

export type PaysuiteMethod = 'mpesa' | 'emola' | 'credit_card'

export interface CriarPagamentoParams {
  amount: number
  reference: string
  description?: string
  return_url?: string
  method?: PaysuiteMethod
}

export interface PagamentoResponse {
  id: string
  amount: number
  reference: string
  status: string
  checkout_url: string
}

export async function criarPagamento(params: CriarPagamentoParams): Promise<PagamentoResponse> {
  const res = await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      amount: params.amount,
      reference: params.reference,
      description: params.description ?? 'SonhoEuropa',
      ...(params.return_url && { return_url: params.return_url }),
      ...(params.method && { method: params.method }),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).message ?? `PaySuite error ${res.status}`)
  }

  const json = await res.json()
  return json.data as PagamentoResponse
}

export async function obterPagamento(id: string): Promise<PagamentoResponse> {
  const res = await fetch(`${BASE_URL}/payments/${id}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`PaySuite error ${res.status}`)
  const json = await res.json()
  return json.data as PagamentoResponse
}
