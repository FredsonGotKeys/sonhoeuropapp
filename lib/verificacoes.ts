// Constrói o caminho dentro do bucket privado 'verificacoes' para os três
// ficheiros de uma submissão (foto do BI, selfie, contrato gerado).
export function caminhoVerificacao(usuarioId: string, verificacaoId: string, tipo: 'bi' | 'selfie' | 'contrato'): string {
  const ext = tipo === 'contrato' ? 'pdf' : 'jpg'
  return `${usuarioId}/${verificacaoId}/${tipo}.${ext}`
}
