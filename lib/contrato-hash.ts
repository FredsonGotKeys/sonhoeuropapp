import { createHash } from 'crypto'

// JSON.stringify não garante ordem estável de chaves entre execuções, e o
// hash de integridade tem de ser reprodutível a partir dos mesmos dados —
// por isso ordena-se recursivamente todas as chaves antes de serializar.
function canonicalizar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(canonicalizar)
  if (valor && typeof valor === 'object') {
    const obj = valor as Record<string, unknown>
    const ordenado: Record<string, unknown> = {}
    for (const chave of Object.keys(obj).sort()) ordenado[chave] = canonicalizar(obj[chave])
    return ordenado
  }
  return valor
}

// Hash do CONTEÚDO acordado (dados + cláusulas + timestamps de consentimento),
// não dos bytes do PDF — permite verificar a integridade do que foi
// efectivamente aceite independentemente da codificação binária do ficheiro.
export function calcularConteudoHash(conteudo: Record<string, unknown>): string {
  const json = JSON.stringify(canonicalizar(conteudo))
  return createHash('sha256').update(json).digest('hex')
}

export function calcularHashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}
