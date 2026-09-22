'use server'

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies, headers } from 'next/headers'
import { caminhoNoBucket } from '@/lib/comprovativos'
import { limparComprovativosExpirados } from '@/app/actions/deposito'
import { limparVerificacoesExpiradas } from '@/app/actions/verificacao'
import { registarAuditoria } from '@/lib/auditoria'

// Valor real (interno) que o fundo precisa de atingir para ser considerado completo.
// Independente da "meta" configurada por ciclo, que é o valor/prémio mostrado ao utilizador.
const ALVO_REAL = 300000

// ─── AUTH (stateless HMAC tokens — works across serverless instances) ────────

const ADMIN_MAX_ATTEMPTS = 5
const ADMIN_LOCKOUT_MIN = 15
const ADMIN_TOKEN_TTL = 4 * 60 * 60 * 1000

// Rede de segurança para quando a base de dados não responde. Não é o
// mecanismo principal — é o que existia antes, com os seus defeitos: vive na
// memória de uma instância e some no arranque a frio. Só entra em jogo se a
// contagem persistente falhar, e mesmo aí é melhor do que não contar nada.
const tentativasEmMemoria = new Map<string, { contagem: number; bloqueadoAte: number }>()

/**
 * IP de quem está a tentar entrar.
 *
 * A ordem importa. `x-forwarded-for` é uma lista a que o cliente pode juntar
 * entradas à frente, por isso ler a primeira posição às cegas dá um valor que
 * o atacante escolhe — e escolher o valor é escolher um contador novo a cada
 * tentativa. Os cabeçalhos que a própria Vercel escreve vêm primeiro.
 */
async function ipDeOrigem(): Promise<string> {
  const h = await headers()
  const vercel = h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
  if (vercel) return vercel
  const real = h.get('x-real-ip')?.trim()
  if (real) return real
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconhecido'
}

/** Momento até ao qual este IP está bloqueado, ou null. */
async function bloqueioActivo(ip: string): Promise<number | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('admin_login_tentativas')
      .select('bloqueado_ate')
      .eq('ip', ip)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const ate = data?.bloqueado_ate ? new Date(data.bloqueado_ate).getTime() : 0
    return ate > Date.now() ? ate : null
  } catch (e) {
    console.error('[admin] Falha a ler o bloqueio, a usar a contagem em memória:', e)
    const local = tentativasEmMemoria.get(ip)
    return local && local.bloqueadoAte > Date.now() ? local.bloqueadoAte : null
  }
}

/** Conta mais uma falha para este IP e bloqueia-o se chegou ao limite. */
async function registarFalha(ip: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.rpc('registar_tentativa_admin', {
      p_ip: ip,
      p_max: ADMIN_MAX_ATTEMPTS,
      p_bloqueio: `${ADMIN_LOCKOUT_MIN} minutes`,
    })
    if (error) throw new Error(error.message)
  } catch (e) {
    console.error('[admin] Falha a registar a tentativa, a contar em memória:', e)
    const local = tentativasEmMemoria.get(ip) ?? { contagem: 0, bloqueadoAte: 0 }
    local.contagem += 1
    if (local.contagem >= ADMIN_MAX_ATTEMPTS) {
      local.bloqueadoAte = Date.now() + ADMIN_LOCKOUT_MIN * 60_000
      local.contagem = 0
    }
    tentativasEmMemoria.set(ip, local)
  }
}

/** Entrou com sucesso: o histórico deste IP deixa de interessar. */
async function limparTentativas(ip: string): Promise<void> {
  tentativasEmMemoria.delete(ip)
  try {
    const admin = createAdminClient()
    await admin.from('admin_login_tentativas').delete().eq('ip', ip)
  } catch (e) {
    console.error('[admin] Falha a limpar as tentativas de', ip, e)
  }
}

function getSigningKey(): Buffer {
  // Falha fechada, nunca aberta. Com `?? ''`, um deploy a que faltassem as
  // duas variáveis passava a assinar com sha256('admin-session:') — uma
  // constante que qualquer pessoa consegue derivar, e portanto um cookie de
  // admin forjável sem saber senha nenhuma. Não poder entrar é um incidente
  // de configuração; poder entrar sem credenciais é uma porta aberta.
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.ADMIN_PASSWORD ?? ''
  if (!secret) {
    throw new Error(
      'Configuração em falta: define SUPABASE_SERVICE_ROLE_KEY ou ADMIN_PASSWORD. ' +
      'Sem uma delas as sessões de administrador não podem ser assinadas em segurança.'
    )
  }
  return crypto.createHash('sha256').update('admin-session:' + secret).digest()
}

function createAdminToken(): string {
  const expires = Date.now() + ADMIN_TOKEN_TTL
  const payload = `admin:${expires}`
  const sig = crypto.createHmac('sha256', getSigningKey()).update(payload).digest('hex')
  return `${payload}:${sig}`
}

function verifyAdminToken(token: string): boolean {
  if (!token) return false
  const parts = token.split(':')
  if (parts.length !== 3) return false
  const [prefix, expiresStr, sig] = parts
  if (prefix !== 'admin') return false
  const expires = parseInt(expiresStr, 10)
  if (!expires || Date.now() > expires) return false
  try {
    // getSigningKey() lança se a configuração estiver em falta: nesse caso
    // ninguém entra, que é o lado correcto para falhar.
    const expected = crypto.createHmac('sha256', getSigningKey()).update(`${prefix}:${expiresStr}`).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))
  } catch {
    return false
  }
}

// Compara via digest de tamanho fixo para não vazar o comprimento da password.
function adminPasswordMatches(input: string): boolean {
  const expected = (process.env.ADMIN_PASSWORD ?? '').trim()
  if (!expected) return false
  const a = crypto.createHash('sha256').update((input ?? '').trim()).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

async function requireAdmin(): Promise<{ error?: string }> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin-session')?.value ?? ''
  if (!verifyAdminToken(token)) return { error: 'Não autorizado' }
  return {}
}

export async function verifyAdminPassword(password: string) {
  // A contagem é por IP. Era uma chave única para toda a gente, o que fazia do
  // bloqueio uma arma contra o próprio administrador: cinco tentativas erradas
  // de um desconhecido e o dono do painel ficava de fora quinze minutos.
  const ip = await ipDeOrigem()

  const bloqueadoAte = await bloqueioActivo(ip)
  if (bloqueadoAte) {
    const mins = Math.max(1, Math.ceil((bloqueadoAte - Date.now()) / 60000))
    return { error: `Demasiadas tentativas. Tenta em ${mins} minutos.` }
  }

  if (!adminPasswordMatches(password)) {
    await registarFalha(ip)
    return { error: 'Senha incorrecta' }
  }

  await limparTentativas(ip)
  const token = createAdminToken()
  const cookieStore = await cookies()
  cookieStore.set('admin-session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 4,
    path: '/',
  })
  return { success: true }
}

export async function isValidAdminToken(token: string): Promise<boolean> {
  return verifyAdminToken(token)
}

export async function logoutAdmin() {
  const cookieStore = await cookies()
  cookieStore.delete('admin-session')
}

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────

export async function getAdminStats() {
  const auth = await requireAdmin(); if (auth.error) return null
  const admin = createAdminClient()
  const [cicloRes, usuariosCountRes, usuariosTopRes, depositosRes, inscricoesRes, sorteioRes, pagamentosRes, verificacoesRes, contratosRes] = await Promise.all([
    admin.from('ciclos').select('*').neq('estado', 'concluido').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('usuarios').select('id', { count: 'exact', head: true }),
    admin.from('usuarios').select('id, nome, email, telefone, codigo_convite, total_depositado, ultimo_deposito_at, created_at').order('created_at', { ascending: false }).limit(4000),
    admin.from('depositos').select('valor'),
    admin.from('inscricoes').select('taxa_paga'),
    admin.from('sorteios').select('*, vencedor:vencedor_id(nome, email)').order('realizado_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('pagamentos').select('status'),
    admin.from('verificacoes').select('status', { count: 'exact', head: true }).eq('status', 'pendente'),
    admin.from('contratos').select('estado', { count: 'exact', head: true }).in('estado', ['pendente', 'em_analise']),
  ])

  const depositos = depositosRes.data ?? []
  const inscricoes = inscricoesRes.data ?? []
  const pagamentos = pagamentosRes.data ?? []

  const totalDepositosBruto = depositos.reduce((s, d) => s + Number(d.valor), 0)
  const totalInscricoes = inscricoes.reduce((s, i) => s + Number(i.taxa_paga), 0)

  const participantesComDepositos = (usuariosTopRes.data ?? []).map((u) => ({
    ...u,
    total_depositado: Number(u.total_depositado ?? 0),
  }))

  const ciclo = cicloRes.data
  const fundoActual = Number(ciclo?.total_acumulado ?? 0)

  // Pre-coverage: liquid that went into the fund came from gross * 0.9
  // So gross that funded = fundoActual / 0.9
  const brutoPreCobertura = Math.min(totalDepositosBruto, Math.round(fundoActual / (1 - TAXA_ANTES_COBERTURA)))
  const brutoPosCobertura = Math.max(0, totalDepositosBruto - brutoPreCobertura)

  const comissaoPreCobertura = Math.round(brutoPreCobertura * TAXA_ANTES_COBERTURA)
  const comissaoPosCobertura = Math.round(brutoPosCobertura * TAXA_APOS_COBERTURA)
  const comissaoDepositos = comissaoPreCobertura + comissaoPosCobertura
  const receitaTotal = totalInscricoes + comissaoDepositos

  return {
    cicloActivo: ciclo,
    totalParticipantes: usuariosCountRes.count ?? 0,
    totalDepositos: totalDepositosBruto,
    totalInscricoes,
    participantes: participantesComDepositos,
    ultimoSorteio: sorteioRes.data,
    pagamentosPendentes: pagamentos.filter(p => p.status === 'pendente' || p.status === 'pendente_confirmacao' || p.status === 'aguardando_comprovativo').length,
    pagamentosConfirmados: pagamentos.filter(p => p.status === 'confirmado').length,
    verificacoesPendentes: verificacoesRes.count ?? 0,
    contratosPendentes: contratosRes.count ?? 0,
    financeiro: {
      depositosBruto: totalDepositosBruto,
      comissaoDepositos,
      comissaoPreCobertura,
      comissaoPosCobertura,
      brutoPreCobertura,
      brutoPosCobertura,
      totalInscricoes,
      receitaTotal,
      fundoAcumulado: fundoActual,
      numDepositos: depositos.length,
      numInscricoes: inscricoes.length,
      coberturaAtingida: fundoActual >= ALVO_REAL,
    },
  }
}

// ─── PARTICIPANTES ────────────────────────────────────────────────────────────

export async function eliminarParticipante(userId: string) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()
  await admin.from('pagamentos').delete().eq('usuario_id', userId)
  await admin.from('pontos_bonus').delete().eq('usuario_id', userId)
  await admin.from('depositos').delete().eq('usuario_id', userId)
  await admin.from('inscricoes').delete().eq('usuario_id', userId)
  await admin.from('sorteios').update({ vencedor_id: null }).eq('vencedor_id', userId)
  await admin.from('usuarios').delete().eq('id', userId)
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function editarParticipante(userId: string, dados: {
  nome?: string
}) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()
  const { error } = await admin.from('usuarios').update(dados).eq('id', userId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function getParticipanteDetalhes(userId: string) {
  const auth = await requireAdmin(); if (auth.error) return null
  const admin = createAdminClient()
  const [userRes, depositosRes, inscricoesRes, pagamentosRes] = await Promise.all([
    admin.from('usuarios').select('*').eq('id', userId).single(),
    admin.from('depositos').select('*').eq('usuario_id', userId).order('data_deposito', { ascending: false }),
    admin.from('inscricoes').select('*, ciclos(estado, meta)').eq('usuario_id', userId),
    admin.from('pagamentos').select('*').eq('usuario_id', userId).order('created_at', { ascending: false }),
  ])
  return {
    usuario: userRes.data,
    depositos: depositosRes.data ?? [],
    inscricoes: inscricoesRes.data ?? [],
    pagamentos: pagamentosRes.data ?? [],
  }
}

// ─── PAGAMENTOS ───────────────────────────────────────────────────────────────

// Duração dos URLs assinados dos comprovativos. Mais longa do que os 10 min
// das fotos de verificação porque o admin percorre uma lista inteira de uma
// assentada; curta o suficiente para um link copiado por engano não sobreviver
// à sessão.
const COMPROVATIVO_URL_TTL_S = 30 * 60

/**
 * Troca o caminho guardado em `comprovativo_imagem_url` por um URL assinado.
 *
 * O bucket `comprovativos` era de leitura pública: quem tivesse o URL via o
 * comprovativo — que mostra tipicamente nome, número e saldo de quem
 * transferiu — sem sessão nenhuma. Agora é privado e só a service role lhe
 * toca; a vista de admin recebe o mesmo campo com o mesmo significado, por
 * isso o JSX fica exactamente como estava.
 */
async function assinarComprovativos<T extends { comprovativo_imagem_url: string | null }>(
  linhas: T[]
): Promise<T[]> {
  const caminhos = [...new Set(
    linhas.map((l) => caminhoNoBucket(l.comprovativo_imagem_url)).filter((c): c is string => !!c)
  )]
  if (!caminhos.length) return linhas

  const admin = createAdminClient()
  const { data } = await admin.storage
    .from('comprovativos')
    .createSignedUrls(caminhos, COMPROVATIVO_URL_TTL_S)

  const assinados = new Map<string, string>()
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) assinados.set(item.path, item.signedUrl)
  }

  return linhas.map((l) => {
    const caminho = caminhoNoBucket(l.comprovativo_imagem_url)
    const url = caminho ? assinados.get(caminho) ?? null : null
    // Sem assinatura — o ficheiro já foi apagado pelas 24h, por exemplo — o
    // campo fica a null e a vista mostra a mensagem de imagem expirada que já
    // existia, em vez de uma imagem partida.
    return { ...l, comprovativo_imagem_url: url }
  })
}

export async function getPagamentos(filtroStatus?: string) {
  const auth = await requireAdmin(); if (auth.error) return []
  await limparComprovativosExpirados()
  const admin = createAdminClient()
  let query = admin
    .from('pagamentos')
    .select('*, usuarios(nome, email)')
    .order('created_at', { ascending: false })
    .limit(500)

  if (filtroStatus && filtroStatus !== 'todos') {
    query = query.eq('status', filtroStatus)
  }

  const { data, error } = await query
  if (error) return []
  return assinarComprovativos(data ?? [])
}

const TAXA_ANTES_COBERTURA = 0.10
const TAXA_APOS_COBERTURA = 0.20

export async function confirmarPagamentoManual(pagamentoId: string) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()

  const { data: pag } = await admin.from('pagamentos').select('*').eq('id', pagamentoId).single()
  if (!pag) return { error: 'Pagamento não encontrado' }
  if (pag.status === 'confirmado') return { error: 'Já confirmado' }

  const estadoAnterior = pag.status

  // Reivindica o pagamento ANTES de creditar seja o que for.
  //
  // Ler o estado e só depois creditar deixava uma janela entre as duas coisas:
  // dois cliques no botão de confirmar (ou duas abas do admin, ou um pedido
  // repetido por ligação lenta) liam ambos "por confirmar", ambos passavam a
  // verificação de duplicado, e ambos inseriam o depósito e incrementavam o
  // total do utilizador e o fundo. O depósito ficava contado duas vezes: peso a
  // dobrar no sorteio para essa pessoa e fundo inflacionado para toda a gente.
  //
  // Um UPDATE com condição é atómico no Postgres: de dois pedidos simultâneos,
  // só um encontra a linha por confirmar e a actualiza; o outro recebe zero
  // linhas e sai aqui. Creditar de menos é recuperável e visível; creditar a
  // dobrar corrompe o sorteio em silêncio.
  const { data: reivindicado } = await admin
    .from('pagamentos')
    .update({ status: 'confirmado', confirmado_at: new Date().toISOString() })
    .eq('id', pagamentoId)
    .neq('status', 'confirmado')
    .select('id')
    .maybeSingle()

  if (!reivindicado) return { error: 'Já confirmado' }

  const cicloId = pag.ciclo_id
  const usuarioId = pag.usuario_id
  const valorBruto = Number(pag.valor)

  // Se algo falhar a meio do crédito, devolve o pagamento ao estado anterior
  // para o admin poder repetir, em vez de o deixar marcado como confirmado
  // sem nunca ter sido creditado.
  const desfazerReivindicacao = async () => {
    await admin
      .from('pagamentos')
      .update({ status: estadoAnterior, confirmado_at: null })
      .eq('id', pagamentoId)
  }

  try {
    const { data: cicloInfo } = await admin.from('ciclos').select('total_acumulado, meta, minimo_participantes').eq('id', cicloId).single()
    const acumulado = Number(cicloInfo?.total_acumulado ?? 0)
    const meta = Number(cicloInfo?.meta ?? 200000)
    const coberturaAtingida = acumulado >= meta

    const taxa = coberturaAtingida ? TAXA_APOS_COBERTURA : TAXA_ANTES_COBERTURA
    const comissao = Math.round(valorBruto * taxa)
    const valorLiquido = valorBruto - comissao

    if (pag.tipo === 'inscricao') {
      const { data: exists } = await admin.from('inscricoes').select('id')
        .eq('usuario_id', usuarioId).eq('ciclo_id', cicloId).maybeSingle()
      if (!exists) {
        await admin.from('inscricoes').insert({ usuario_id: usuarioId, ciclo_id: cicloId, taxa_paga: valorBruto })
        const minPart = cicloInfo?.minimo_participantes ?? 3000
        await admin.rpc('increment_participantes', { p_ciclo_id: cicloId, p_min: minPart })
      }
    } else {
      const { data: dup } = await admin.from('depositos').select('id').eq('referencia_paysuite', pag.referencia).maybeSingle()
      if (!dup) {
        const { error: erroDeposito } = await admin.from('depositos').insert({ usuario_id: usuarioId, ciclo_id: cicloId, valor: valorBruto, pontos_gerados: 0, referencia_paysuite: pag.referencia })
        if (erroDeposito) throw new Error(erroDeposito.message)

        await admin.rpc('increment_user_deposito', { p_user_id: usuarioId, p_amount: valorBruto })

        if (acumulado < ALVO_REAL) {
          const adicaoFundo = Math.min(valorLiquido, ALVO_REAL - acumulado)
          await admin.rpc('increment_fundo', { p_ciclo_id: cicloId, p_amount: adicaoFundo, p_max: ALVO_REAL })
        }
      }
    }
  } catch (e) {
    console.error('[confirmarPagamentoManual] Falha a creditar, a reverter:', e)
    await desfazerReivindicacao()
    return { error: 'Não foi possível creditar o pagamento. Nada foi alterado, tenta novamente.' }
  }

  return { success: true }
}

export async function rejeitarPagamento(pagamentoId: string) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()
  const { error } = await admin.from('pagamentos').update({ status: 'falhado' }).eq('id', pagamentoId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function eliminarPagamento(pagamentoId: string) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()

  const { data: pag } = await admin.from('pagamentos').select('comprovativo_imagem_url').eq('id', pagamentoId).maybeSingle()
  const { error } = await admin.from('pagamentos').delete().eq('id', pagamentoId)
  if (error) return { error: error.message }

  const caminho = caminhoNoBucket(pag?.comprovativo_imagem_url ?? null)
  if (caminho) await admin.storage.from('comprovativos').remove([caminho])

  return { success: true }
}

export async function eliminarPagamentosEmMassa(ids: string[]) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  if (!ids.length) return { success: true }
  const admin = createAdminClient()

  const { data: pags } = await admin.from('pagamentos').select('comprovativo_imagem_url').in('id', ids)
  const { error } = await admin.from('pagamentos').delete().in('id', ids)
  if (error) return { error: error.message }

  const caminhos = (pags ?? []).map((p) => caminhoNoBucket(p.comprovativo_imagem_url)).filter((c): c is string => !!c)
  if (caminhos.length) await admin.storage.from('comprovativos').remove(caminhos)

  return { success: true, count: ids.length }
}

// ─── CICLOS ───────────────────────────────────────────────────────────────────

export async function getCiclos() {
  const auth = await requireAdmin(); if (auth.error) return []
  const admin = createAdminClient()
  const { data } = await admin.from('ciclos').select('*').order('created_at', { ascending: false })
  return data ?? []
}

export async function alterarEstadoCiclo(cicloId: string, estado: string) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()
  const { error } = await admin.from('ciclos').update({ estado }).eq('id', cicloId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function criarNovoCiclo() {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()
  // Fechar ciclos activos primeiro
  await admin.from('ciclos').update({ estado: 'concluido', concluido_at: new Date().toISOString() })
    .in('estado', ['activo', 'aguardando_minimo'])
  // Criar novo ciclo já activo — sem inscrições, não há "mínimo de
  // participantes inscritos" para aguardar antes de aceitar depósitos.
  const { data, error } = await admin.from('ciclos').insert({ estado: 'activo', meta: 200000, minimo_participantes: 3000 }).select().single()
  if (error) return { error: error.message }
  return { success: true, ciclo: data }
}

// ─── SORTEIO ─────────────────────────────────────────────────────────────────

export async function realizarSorteio() {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()
  const { data: ciclo } = await admin.from('ciclos').select('*').eq('estado', 'activo').single()
  if (!ciclo) return { error: 'Nenhum ciclo activo' }
  if (Number(ciclo.total_acumulado ?? 0) < ALVO_REAL) {
    return { error: `Cobertura ainda não atingida (${Math.round(Number(ciclo.total_acumulado ?? 0))} / ${ALVO_REAL} MT)` }
  }

  // Sem inscrição separada: quem depositou pelo menos uma vez neste ciclo é
  // elegível, com peso = total depositado. Quem nunca depositou não entra.
  const { data: depositos } = await admin.from('depositos')
    .select('usuario_id, valor, usuarios!inner(nome, email, telefone)')
    .eq('ciclo_id', ciclo.id)

  if (!depositos?.length) return { error: 'Sem participantes com depósitos' }

  const depositosPorUser = new Map<string, number>()
  const dadosPorUser = new Map<string, { nome: string; email: string; telefone: string | null }>()
  for (const d of depositos) {
    const usuario = Array.isArray(d.usuarios) ? d.usuarios[0] : d.usuarios
    depositosPorUser.set(d.usuario_id, (depositosPorUser.get(d.usuario_id) ?? 0) + Number(d.valor))
    if (!dadosPorUser.has(d.usuario_id) && usuario) {
      dadosPorUser.set(d.usuario_id, { nome: usuario.nome, email: usuario.email, telefone: usuario.telefone })
    }
  }

  const participants = [...depositosPorUser.entries()].map(([userId, totalDepositado]) => ({
    userId,
    ...dadosPorUser.get(userId)!,
    totalDepositado,
  }))

  const pesoTotal = participants.reduce((s, p) => s + p.totalDepositado, 0)
  if (pesoTotal <= 0) return { error: 'Sem participantes com depósitos' }

  // Reivindica o ciclo ANTES de sortear.
  //
  // Sem isto, dois pedidos simultâneos liam ambos o ciclo como 'activo',
  // sorteavam cada um o SEU vencedor (aleatório, portanto provavelmente
  // pessoas diferentes) e inseriam os dois em `sorteios`. Ficavam dois
  // vencedores registados para o mesmo ciclo — e não há forma honesta de
  // decidir depois qual deles conta. Só um pedido consegue mudar o estado de
  // 'activo' para 'concluido'; o outro sai aqui sem sortear nada.
  const { data: cicloReivindicado } = await admin
    .from('ciclos')
    .update({ estado: 'concluido', concluido_at: new Date().toISOString() })
    .eq('id', ciclo.id)
    .eq('estado', 'activo')
    .select('id')
    .maybeSingle()

  if (!cicloReivindicado) return { error: 'Este ciclo já foi sorteado' }

  // Selecção ponderada: quem deposita mais tem mais chances.
  //
  // Amostragem por rejeição em vez de `% pesoTotal` directo: o módulo só é
  // uniforme quando o divisor divide 2^32 exactamente, e caso contrário os
  // resíduos mais baixos saem com um pouco mais de frequência. O desvio seria
  // ínfimo, mas isto é um sorteio de dinheiro real — o custo de o eliminar é
  // um ciclo while que quase nunca repete.
  const limite = Math.floor(0xFFFFFFFF / pesoTotal) * pesoTotal
  const buf = new Uint32Array(1)
  do {
    crypto.getRandomValues(buf)
  } while (buf[0] >= limite)

  let rand = buf[0] % pesoTotal
  let winner = participants[0]
  for (const p of participants) {
    rand -= p.totalDepositado
    // `< 0` (não `<= 0`): rand começa em [0, pesoTotal-1], por isso `<= 0`
    // daria ao primeiro participante uma hipótese a mais e ao último uma a menos.
    if (rand < 0) { winner = p; break }
  }

  // Sequencial, não Promise.all: o ciclo já está reivindicado acima, falta
  // registar quem ganhou. Se este insert falhar, o ciclo fica fechado sem
  // vencedor registado — estado visível e corrigível, ao contrário de dois
  // vencedores em simultâneo.
  const { error: erroSorteio } = await admin.from('sorteios').insert({
    ciclo_id: ciclo.id,
    vencedor_id: winner.userId,
    total_fundo: ciclo.total_acumulado,
    premio: 200000,
  })

  if (erroSorteio) {
    console.error('[realizarSorteio] Ciclo fechado mas sorteio não registado:', erroSorteio)
    return { error: 'O vencedor foi escolhido mas não ficou registado. Não repitas o sorteio: contacta o suporte técnico.' }
  }

  return { success: true, winnerNome: winner.nome, winnerEmail: winner.email, winnerTelefone: winner.telefone, totalDepositado: winner.totalDepositado }
}

export async function getSorteios() {
  const auth = await requireAdmin(); if (auth.error) return []
  const admin = createAdminClient()
  const { data } = await admin.from('sorteios')
    .select('*, vencedor:vencedor_id(nome, email), ciclo:ciclo_id(total_acumulado)')
    .order('realizado_at', { ascending: false })
  return data ?? []
}

// ─── VERIFICAÇÃO DE BI ─────────────────────────────────────────────────────

export async function getVerificacoesPendentes() {
  const auth = await requireAdmin(); if (auth.error) return []
  await limparVerificacoesExpiradas()
  const admin = createAdminClient()

  const { data } = await admin
    .from('verificacoes')
    .select('*, usuarios(nome, email, telefone)')
    .order('criado_em', { ascending: false })
    .limit(300)
  if (!data) return []

  // Só o envio mais recente de cada utilizador interessa para a revisão.
  const maisRecentePorUsuario = new Map<string, (typeof data)[number]>()
  for (const v of data) {
    if (!maisRecentePorUsuario.has(v.usuario_id)) maisRecentePorUsuario.set(v.usuario_id, v)
  }

  // URLs assinadas — o bucket é privado, por isso o admin precisa de um link
  // temporário (10 min) para ver ou descarregar as fotos antes de confirmar.
  return Promise.all([...maisRecentePorUsuario.values()].map(async (v) => {
    const [frente, verso, selfie] = await Promise.all([
      v.bi_imagem_path ? admin.storage.from('verificacoes').createSignedUrl(v.bi_imagem_path, 600) : null,
      v.bi_imagem_verso_path ? admin.storage.from('verificacoes').createSignedUrl(v.bi_imagem_verso_path, 600) : null,
      v.selfie_imagem_path ? admin.storage.from('verificacoes').createSignedUrl(v.selfie_imagem_path, 600) : null,
    ])
    return {
      ...v,
      bi_imagem_frente_url: frente?.data?.signedUrl ?? null,
      bi_imagem_verso_url: verso?.data?.signedUrl ?? null,
      selfie_url: selfie?.data?.signedUrl ?? null,
    }
  }))
}

export async function aprovarVerificacao(verificacaoId: string, biNumero: string) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const numero = (biNumero ?? '').trim().replace(/<[^>]*>/g, '').slice(0, 30)
  if (numero.length < 5) return { error: 'Número de BI inválido' }

  const admin = createAdminClient()
  const { data: v } = await admin.from('verificacoes').select('usuario_id').eq('id', verificacaoId).maybeSingle()
  if (!v) return { error: 'Verificação não encontrada' }

  const agora = new Date().toISOString()
  await admin.from('verificacoes').update({ status: 'aprovado', revisto_em: agora, bi_numero: numero }).eq('id', verificacaoId)
  const { error } = await admin.from('usuarios').update({ verificado: true, verificado_at: agora, bi_numero: numero }).eq('id', v.usuario_id)
  if (error) return { error: error.message }
  registarAuditoria({ usuarioId: v.usuario_id, evento: 'bi_aprovado', detalhes: { verificacaoId } })
  return { success: true }
}

export async function rejeitarVerificacao(verificacaoId: string, motivo: string) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()
  const motivoLimpo = (motivo ?? '').trim().replace(/<[^>]*>/g, '').slice(0, 300)
    || 'As fotos não estão legíveis. Tenta enviar novamente com boa luz.'

  const { data: v } = await admin.from('verificacoes').select('usuario_id').eq('id', verificacaoId).maybeSingle()

  const { error } = await admin.from('verificacoes').update({
    status: 'rejeitado',
    revisto_em: new Date().toISOString(),
    motivo_rejeicao: motivoLimpo,
  }).eq('id', verificacaoId)
  if (error) return { error: error.message }
  if (v) registarAuditoria({ usuarioId: v.usuario_id, evento: 'bi_rejeitado', detalhes: { verificacaoId, motivo: motivoLimpo } })
  return { success: true }
}

// ─── CONTRATOS ──────────────────────────────────────────────────────────────

export async function getContratosAdmin(filtroEstado?: string) {
  const auth = await requireAdmin(); if (auth.error) return []
  const admin = createAdminClient()

  let query = admin.from('contratos')
    .select('id, numero, estado, dados, pdf_paginas, pdf_versao, rejeitado_motivo, created_at, aprovado_at, assinado_at, usuarios(nome, email, telefone)')
    .order('created_at', { ascending: false })
    .limit(300)

  if (filtroEstado && filtroEstado !== 'todos') query = query.eq('estado', filtroEstado)

  const { data } = await query
  return (data ?? []).map((c) => ({
    ...c,
    usuarios: Array.isArray(c.usuarios) ? c.usuarios[0] ?? null : c.usuarios,
  }))
}

export async function aprovarContrato(contratoId: string) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()

  const { data: c } = await admin.from('contratos').select('usuario_id, estado').eq('id', contratoId).maybeSingle()
  if (!c) return { error: 'Contrato não encontrado' }
  if (!['pendente', 'em_analise'].includes(c.estado)) return { error: 'Este contrato já foi revisto' }

  const agora = new Date().toISOString()
  const { error } = await admin.from('contratos').update({
    estado: 'a_aguardar_assinatura',
    aprovado_at: agora,
    updated_at: agora,
  }).eq('id', contratoId)
  if (error) return { error: error.message }

  registarAuditoria({ usuarioId: c.usuario_id, contratoId, evento: 'contrato_aprovado' })
  return { success: true }
}

export async function rejeitarContrato(contratoId: string, motivo: string) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()
  const motivoLimpo = (motivo ?? '').trim().replace(/<[^>]*>/g, '').slice(0, 300)
    || 'Dados incorrectos. Verifica e reenvia.'

  const { data: c } = await admin.from('contratos').select('usuario_id, estado').eq('id', contratoId).maybeSingle()
  if (!c) return { error: 'Contrato não encontrado' }
  if (!['pendente', 'em_analise'].includes(c.estado)) return { error: 'Este contrato já foi revisto' }

  const { error } = await admin.from('contratos').update({
    estado: 'rejeitado',
    rejeitado_motivo: motivoLimpo,
    updated_at: new Date().toISOString(),
  }).eq('id', contratoId)
  if (error) return { error: error.message }

  registarAuditoria({ usuarioId: c.usuario_id, contratoId, evento: 'contrato_rejeitado', detalhes: { motivo: motivoLimpo } })
  return { success: true }
}

export async function getContratoDownloadAdmin(contratoId: string) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()

  const { data: c } = await admin.from('contratos').select('pdf_path, estado, usuario_id').eq('id', contratoId).maybeSingle()
  if (!c?.pdf_path || !['assinado', 'finalizado'].includes(c.estado)) {
    return { error: 'O contrato ainda não tem PDF disponível' }
  }

  const { data, error } = await admin.storage.from('contratos').createSignedUrl(c.pdf_path, 300, { download: true })
  if (error || !data) return { error: 'Não foi possível gerar o link de download' }

  registarAuditoria({ usuarioId: c.usuario_id, contratoId, evento: 'pdf_descarregado', detalhes: { por: 'admin' } })
  return { success: true, url: data.signedUrl }
}

export async function getAuditoriaContrato(contratoId: string) {
  const auth = await requireAdmin(); if (auth.error) return []
  const admin = createAdminClient()
  const { data } = await admin.from('auditoria').select('*').eq('contrato_id', contratoId).order('criado_em', { ascending: false })
  return data ?? []
}
