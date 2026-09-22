// O bucket `comprovativos` é privado. O que fica gravado em
// `pagamentos.comprovativo_imagem_url` é o CAMINHO do ficheiro dentro do
// bucket — não há URL público para guardar. Registos criados antes desta
// mudança guardam o URL público completo; as duas formas são aceites aqui.

const EXTENSOES = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'] as const

export function caminhoNoBucket(valor: string | null): string | null {
  if (!valor) return null

  const marcador = '/comprovativos/'
  const i = valor.indexOf(marcador)
  if (i !== -1) return valor.slice(i + marcador.length) || null

  // Já vem como caminho simples. Recusa o que ainda pareça um URL ou tente
  // sair da raiz do bucket.
  if (valor.includes('://') || valor.includes('..') || valor.startsWith('/')) return null
  return valor
}

/**
 * Nome do ficheiro no envio: `<referencia>_<carimbo>.<extensão>`.
 *
 * Prender o nome à referência é o que impede alguém de anexar ao seu próprio
 * pagamento o comprovativo de outra pessoa: antes bastava que o ficheiro
 * estivesse algures no bucket para o servidor o aceitar.
 */
export function nomeDeComprovativo(referencia: string, nomeOriginal: string): string {
  const ext = (nomeOriginal.split('.').pop() ?? '').toLowerCase()
  const extSegura = (EXTENSOES as readonly string[]).includes(ext) ? ext : 'jpg'
  return `${referencia}_${Date.now()}.${extSegura}`
}

export function caminhoPertenceA(caminho: string, referencia: string): boolean {
  const escapada = referencia.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escapada}_\\d+\\.(${EXTENSOES.join('|')})$`).test(caminho)
}
