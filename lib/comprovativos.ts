// Extrai o caminho do ficheiro dentro do bucket 'comprovativos' a partir do
// URL público gravado em comprovativo_imagem_url.
export function caminhoNoBucket(url: string | null): string | null {
  if (!url) return null
  const marcador = '/comprovativos/'
  const i = url.indexOf(marcador)
  return i === -1 ? null : url.slice(i + marcador.length)
}
