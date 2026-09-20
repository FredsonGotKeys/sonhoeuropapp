'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EuropaWatermark } from '@/components/EuropaWatermark'
import { Reveal } from '@/components/Reveal'
import {
  Users, Trophy, TrendingUp, DollarSign, RefreshCw, LogOut,
  Trash2, Edit2, Check, X, ChevronDown, ChevronUp, Search,
  CreditCard, AlertCircle, ShieldCheck, Plus, Eye, BarChart2,
  ArrowLeft, FileText, Download, History,
} from 'lucide-react'
import {
  realizarSorteio, getAdminStats, logoutAdmin,
  eliminarParticipante, editarParticipante, getParticipanteDetalhes,
  getPagamentos, confirmarPagamentoManual, rejeitarPagamento,
  eliminarPagamento, eliminarPagamentosEmMassa,
  getCiclos, alterarEstadoCiclo, criarNovoCiclo, getSorteios,
  getVerificacoesPendentes, aprovarVerificacao, rejeitarVerificacao,
  getContratosAdmin, aprovarContrato, rejeitarContrato,
  getContratoDownloadAdmin, getAuditoriaContrato,
} from '@/app/actions/admin'

type Tab = 'dashboard' | 'participantes' | 'pagamentos' | 'verificacoes' | 'contratos' | 'ciclos' | 'sorteio'

type AdminStats = Awaited<ReturnType<typeof getAdminStats>>
type ParticipanteRow = NonNullable<AdminStats>['participantes'][number]
type ParticipanteDetalhes = Awaited<ReturnType<typeof getParticipanteDetalhes>>
type PagamentoRow = Awaited<ReturnType<typeof getPagamentos>>[number]
type VerificacaoRow = Awaited<ReturnType<typeof getVerificacoesPendentes>>[number]
type ContratoRow = Awaited<ReturnType<typeof getContratosAdmin>>[number]
type AuditoriaRow = Awaited<ReturnType<typeof getAuditoriaContrato>>[number]
type CicloRow = Awaited<ReturnType<typeof getCiclos>>[number]

const BADGE: Record<string, { label: string; bg: string; color: string }> = {
  pendente:               { label: 'Pendente',        bg: 'var(--surface-sunk)',      color: 'var(--fg-muted)' },
  aguardando_comprovativo: { label: 'Sem comprovativo', bg: 'var(--info-tint)',  color: 'var(--info)' },
  pendente_confirmacao:   { label: 'A confirmar',     bg: 'var(--money-tint)',    color: 'var(--money)' },
  confirmado:             { label: 'Confirmado',       bg: 'var(--success-tint)',    color: 'var(--success)' },
  falhado:                { label: 'Falhado',          bg: 'var(--danger-bg)',      color: 'var(--danger)' },
  aguardando_minimo:      { label: 'Aguardando',       bg: 'var(--money-tint)',    color: 'var(--money)' },
  activo:                 { label: 'Activo',           bg: 'var(--success-tint)',    color: 'var(--success)' },
  concluido:              { label: 'Concluído',        bg: 'var(--surface-sunk)',      color: 'var(--fg-muted)' },
  aprovado:               { label: 'Aprovado',         bg: 'var(--success-tint)',    color: 'var(--success)' },
  rejeitado:              { label: 'Rejeitado',        bg: 'var(--danger-bg)',      color: 'var(--danger)' },
  em_analise:             { label: 'Em análise',       bg: 'var(--money-tint)',    color: 'var(--money)' },
  a_aguardar_assinatura:  { label: 'Aguarda assinatura', bg: 'var(--info-tint)',  color: 'var(--info)' },
  assinado:               { label: 'Assinado',         bg: 'var(--success-tint)',    color: 'var(--success)' },
  finalizado:             { label: 'Finalizado',       bg: 'var(--success-tint)',    color: 'var(--success)' },
}

function StatusBadge({ status }: { status: string }) {
  const b = BADGE[status] ?? { label: status, bg: 'var(--surface-sunk)', color: 'var(--fg-muted)' }
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ backgroundColor: b.bg, color: b.color }}>{b.label}</span>
  )
}

function ConfirmModal({ msg, onConfirm, onCancel }: { msg: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
        <p className="text-center font-semibold text-gray-700 mb-5 text-sm leading-relaxed">{msg}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold text-muted hover:bg-gray-50"
            style={{ borderColor: 'var(--border)' }}>Cancelar</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: DASHBOARD ──────────────────────────────────────────────────────────
function TabDashboard({ stats }: { stats: AdminStats }) {
  const formatMT = (v: number) => `${(v ?? 0).toLocaleString('pt-PT')} MT`
  const ciclo = stats?.cicloActivo
  const fin: Partial<NonNullable<AdminStats>['financeiro']> = stats?.financeiro ?? {}

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Fundo Acumulado', value: formatMT(ciclo?.total_acumulado ?? 0), icon: <TrendingUp className="w-4 h-4" />, color: 'var(--brand)' },
          { label: 'Participantes', value: stats?.totalParticipantes ?? 0, icon: <Users className="w-4 h-4" />, color: 'var(--success)' },
          { label: 'Depósitos (bruto)', value: formatMT(fin.depositosBruto ?? 0), icon: <DollarSign className="w-4 h-4" />, color: 'var(--money)' },
          { label: 'Inscrições (bruto)', value: formatMT(fin.totalInscricoes ?? 0), icon: <CreditCard className="w-4 h-4" />, color: 'var(--info)' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2" style={{ color: s.color }}>
              {s.icon}
              <span className="text-xs font-medium">{s.label}</span>
            </div>
            <p className="text-lg font-black truncate" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Receita do Administrador */}
      <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: '2px solid var(--success-tint-3)' }}>
        <h2 className="font-black mb-1 flex items-center gap-2" style={{ color: 'var(--success)' }}>
          <DollarSign className="w-4 h-4" /> A Minha Receita
        </h2>
        <p className="text-xs text-muted mb-4">Inscrições (100% tuas) + Comissão sobre depósitos (10% antes da cobertura, 20% após)</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'var(--success-tint)', border: '1.5px solid var(--success-tint-2)' }}>
            <p className="text-xs text-muted mb-1">Receita Total</p>
            <p className="text-xl font-black" style={{ color: 'var(--success)' }}>{formatMT(fin.receitaTotal ?? 0)}</p>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'var(--info-tint)' }}>
            <p className="text-xs text-muted mb-1">Inscrições (100%)</p>
            <p className="font-black" style={{ color: 'var(--info)' }}>{formatMT(fin.totalInscricoes ?? 0)}</p>
            <p className="text-xs text-muted mt-0.5">{fin.numInscricoes ?? 0} inscritos</p>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'var(--money-tint)' }}>
            <p className="text-xs text-muted mb-1">10% (pré-cobertura)</p>
            <p className="font-black" style={{ color: 'var(--money)' }}>{formatMT(fin.comissaoPreCobertura ?? 0)}</p>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'var(--danger-tint)' }}>
            <p className="text-xs text-muted mb-1">20% (pós-cobertura)</p>
            <p className="font-black" style={{ color: 'var(--red)' }}>{formatMT(fin.comissaoPosCobertura ?? 0)}</p>
            {fin.coberturaAtingida && <p className="text-xs text-green-500 mt-0.5">Activa</p>}
          </div>
        </div>

        <div className="rounded-xl overflow-hidden text-sm" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--background)' }}>
                <th className="text-left py-2 px-4 text-xs font-bold text-muted">Fonte</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-muted">Valor Recebido</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-muted">Tua Receita</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-muted">Vai para o Fundo</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t" style={{ borderColor: 'var(--surface-sunk)' }}>
                <td className="py-2.5 px-4 font-semibold">Depósitos 10% ({fin.numDepositos ?? 0}x)</td>
                <td className="py-2.5 px-4 text-right">{formatMT(fin.brutoPreCobertura ?? 0)}</td>
                <td className="py-2.5 px-4 text-right font-bold" style={{ color: 'var(--money)' }}>{formatMT(fin.comissaoPreCobertura ?? 0)}</td>
                <td className="py-2.5 px-4 text-right font-bold" style={{ color: 'var(--brand)' }}>{formatMT(fin.fundoAcumulado ?? 0)}</td>
              </tr>
              {(fin.brutoPosCobertura ?? 0) > 0 && (
                <tr className="border-t" style={{ borderColor: 'var(--surface-sunk)' }}>
                  <td className="py-2.5 px-4 font-semibold">Depósitos 20% (pós-cobertura)</td>
                  <td className="py-2.5 px-4 text-right">{formatMT(fin.brutoPosCobertura ?? 0)}</td>
                  <td className="py-2.5 px-4 text-right font-bold" style={{ color: 'var(--red)' }}>{formatMT(fin.comissaoPosCobertura ?? 0)}</td>
                  <td className="py-2.5 px-4 text-right text-muted">0 MT</td>
                </tr>
              )}
              <tr className="border-t" style={{ borderColor: 'var(--surface-sunk)' }}>
                <td className="py-2.5 px-4 font-semibold">Inscrições ({fin.numInscricoes ?? 0}x)</td>
                <td className="py-2.5 px-4 text-right">{formatMT(fin.totalInscricoes ?? 0)}</td>
                <td className="py-2.5 px-4 text-right font-bold" style={{ color: 'var(--success)' }}>{formatMT(fin.totalInscricoes ?? 0)}</td>
                <td className="py-2.5 px-4 text-right text-muted">0 MT</td>
              </tr>
              <tr className="border-t-2 font-black" style={{ borderColor: 'var(--brand)', backgroundColor: 'var(--brand-tint)' }}>
                <td className="py-3 px-4" style={{ color: 'var(--brand)' }}>TOTAL</td>
                <td className="py-3 px-4 text-right">{formatMT((fin.depositosBruto ?? 0) + (fin.totalInscricoes ?? 0))}</td>
                <td className="py-3 px-4 text-right" style={{ color: 'var(--success)' }}>{formatMT(fin.receitaTotal ?? 0)}</td>
                <td className="py-3 px-4 text-right" style={{ color: 'var(--brand)' }}>{formatMT(fin.fundoAcumulado ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Estado do ciclo */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="font-black mb-3" style={{ color: 'var(--brand)' }}>Estado do Ciclo Actual</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div><p className="text-xs text-muted">Estado</p><StatusBadge status={ciclo?.estado ?? '—'} /></div>
          <div><p className="text-xs text-muted">Meta</p><p className="font-bold">{formatMT(ciclo?.meta ?? 200000)}</p></div>
          <div>
            <p className="text-xs text-muted">Fundo (visível aos utilizadores)</p>
            <p className="font-bold" style={{ color: 'var(--money)' }}>{formatMT(ciclo?.total_acumulado ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Total bruto depositado</p>
            <p className="font-bold" style={{ color: 'var(--brand)' }}>{formatMT(fin.depositosBruto ?? 0)}</p>
          </div>
          <div><p className="text-xs text-muted">Inscritos</p><p className="font-bold">{ciclo?.participantes_count ?? 0} / {ciclo?.minimo_participantes ?? 3000}</p></div>
          <div><p className="text-xs text-muted">Pagamentos a confirmar</p><p className="font-bold text-orange-500">{stats?.pagamentosPendentes ?? 0}</p></div>
          <div><p className="text-xs text-muted">Pagamentos confirmados</p><p className="font-bold" style={{ color: 'var(--success)' }}>{stats?.pagamentosConfirmados ?? 0}</p></div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>Progresso (visível ao utilizador)</span>
            <span style={{ color: 'var(--money)' }}>
              {((ciclo?.total_acumulado ?? 0) / 300000 * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(((ciclo?.total_acumulado ?? 0) / 300000) * 100, 100)}%`, background: 'linear-gradient(90deg, var(--money), #f5c056)' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: PARTICIPANTES ──────────────────────────────────────────────────────
function TabParticipantes({ participantes, onRefresh }: { participantes: ParticipanteRow[]; onRefresh: () => void }) {
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ nome: '' })
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const [detalhes, setDetalhes] = useState<ParticipanteDetalhes>(null)
  const [confirm, setConfirm] = useState<{ id: string; nome: string } | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [sortBy, setSortBy] = useState<'registro' | 'depositos'>('depositos')

  const filtered = participantes.filter(u =>
    u.nome?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => sortBy === 'depositos'
    ? (b.total_depositado ?? 0) - (a.total_depositado ?? 0)
    : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
  const formatMT = (v: number) => `${(v ?? 0).toLocaleString('pt-PT')} MT`

  const iniciarEdicao = (u: ParticipanteRow) => {
    setEditId(u.id)
    setEditForm({ nome: u.nome })
  }

  const guardarEdicao = async () => {
    if (!editId) return
    setLoading('edit-' + editId)
    const res = await editarParticipante(editId, { nome: editForm.nome })
    if (res.error) setMsg('Erro: ' + res.error)
    else { setMsg('Guardado com sucesso'); setEditId(null); onRefresh() }
    setLoading(null)
  }

  const eliminar = async (id: string) => {
    setLoading('del-' + id)
    const res = await eliminarParticipante(id)
    if (res.error) setMsg('Erro: ' + res.error)
    else { setMsg('Participante eliminado'); setConfirm(null); onRefresh() }
    setLoading(null)
  }

  const verDetalhes = async (id: string) => {
    if (detalheId === id) { setDetalheId(null); setDetalhes(null); return }
    setDetalheId(id)
    const d = await getParticipanteDetalhes(id)
    setDetalhes(d)
  }

  return (
    <div className="space-y-4">
      {confirm && (
        <ConfirmModal
          msg={`Eliminar "${confirm.nome}" permanentemente? Esta acção remove todos os dados, depósitos e pontos.`}
          onConfirm={() => eliminar(confirm.id)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {msg && (
        <div className="p-3 rounded-xl text-sm font-semibold text-center"
          style={{ backgroundColor: msg.startsWith('Erro') ? 'var(--danger-bg)' : 'var(--success-tint)', color: msg.startsWith('Erro') ? 'var(--danger)' : 'var(--success)' }}>
          {msg}
          <button onClick={() => setMsg('')} className="ml-3 opacity-60 hover:opacity-100"><X className="w-3 h-3 inline" /></button>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text" placeholder="Pesquisar por nome ou email..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)' }}
            onFocus={e => e.target.style.borderColor = 'var(--brand)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
        <p className="text-xs text-muted mt-2">{filtered.length} de {participantes.length} participantes</p>
        <div className="flex gap-2 mt-2">
          <button onClick={() => setSortBy('depositos')}
            className="text-xs px-3 py-1 rounded-full font-semibold transition-colors"
            style={{ backgroundColor: sortBy === 'depositos' ? 'var(--brand)' : 'var(--slate-100)', color: sortBy === 'depositos' ? 'var(--white)' : 'var(--fg-muted)' }}>
            Maior depositante
          </button>
          <button onClick={() => setSortBy('registro')}
            className="text-xs px-3 py-1 rounded-full font-semibold transition-colors"
            style={{ backgroundColor: sortBy === 'registro' ? 'var(--brand)' : 'var(--slate-100)', color: sortBy === 'registro' ? 'var(--white)' : 'var(--fg-muted)' }}>
            Mais recente
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--background)' }}>
                {['#', 'Nome / Email', 'Total Depositado', 'Registo', 'Acções'].map(h => (
                  <th key={h} className="text-left py-2.5 px-4 text-xs font-bold text-muted whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <React.Fragment key={u.id}>
                  <tr className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--surface-sunk)' }}>
                    <td className="py-3 px-4 text-muted font-mono text-xs">{i + 1}</td>
                    <td className="py-3 px-4">
                      {editId === u.id ? (
                        <input className="border rounded-lg px-2 py-1 text-sm w-36 outline-none" style={{ borderColor: 'var(--brand)' }}
                          value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} />
                      ) : (
                        <div>
                          <p className="font-semibold truncate max-w-40">{u.nome}</p>
                          <p className="text-xs text-muted truncate max-w-40">{u.email}</p>
                          <p className="text-xs font-mono" style={{ color: u.telefone ? 'var(--success)' : 'var(--fg-subtle)' }}>
                            {u.telefone ?? 'sem telefone'}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold" style={{ color: (u.total_depositado ?? 0) > 0 ? 'var(--brand)' : 'var(--fg-subtle)' }}>
                        {formatMT(u.total_depositado ?? 0)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted text-xs whitespace-nowrap">{formatDate(u.created_at)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {editId === u.id ? (
                          <>
                            <button onClick={guardarEdicao} disabled={!!loading}
                              className="p-1.5 rounded-lg text-white transition-colors"
                              style={{ backgroundColor: 'var(--success)' }}>
                              {loading === 'edit-' + u.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => setEditId(null)}
                              className="p-1.5 rounded-lg bg-gray-100 text-muted hover:bg-gray-200">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => verDetalhes(u.id)} title="Ver detalhes"
                              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-muted">
                              {detalheId === u.id ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => iniciarEdicao(u)} title="Editar"
                              className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors" style={{ color: 'var(--brand)' }}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setConfirm({ id: u.id, nome: u.nome })} title="Eliminar"
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Detalhe expandido */}
                  {detalheId === u.id && (
                    <tr style={{ borderColor: 'var(--surface-sunk)' }}>
                      <td colSpan={5} className="px-4 pb-4">
                        {!detalhes ? (
                          <div className="flex justify-center py-4"><RefreshCw className="w-4 h-4 animate-spin text-muted" /></div>
                        ) : (
                          <div className="grid sm:grid-cols-3 gap-3 pt-2">
                            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--background)' }}>
                              <p className="text-xs font-bold text-muted mb-2">Depósitos ({detalhes.depositos.length})</p>
                              {detalhes.depositos.slice(0, 5).map((d) => (
                                <div key={d.id} className="flex justify-between text-xs py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                                  <span>{formatMT(d.valor)}</span>
                                  <span className="text-muted">{formatDate(d.data_deposito)}</span>
                                </div>
                              ))}
                              {detalhes.depositos.length === 0 && <p className="text-xs text-muted">Sem depósitos</p>}
                            </div>
                            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--background)' }}>
                              <p className="text-xs font-bold text-muted mb-2">Inscrições ({detalhes.inscricoes.length})</p>
                              {detalhes.inscricoes.map((ins) => (
                                <div key={ins.ciclo_id} className="text-xs py-1">
                                  <StatusBadge status={ins.ciclos?.estado ?? '—'} />
                                  <span className="ml-2 text-muted">{formatMT(ins.taxa_paga)}</span>
                                </div>
                              ))}
                              {detalhes.inscricoes.length === 0 && <p className="text-xs text-muted">Não inscrito</p>}
                            </div>
                            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--background)' }}>
                              <p className="text-xs font-bold text-muted mb-2">Pagamentos ({detalhes.pagamentos.length})</p>
                              {detalhes.pagamentos.slice(0, 4).map((pg) => (
                                <div key={pg.id} className="flex justify-between items-center text-xs py-1">
                                  <span>{formatMT(pg.valor)} · {pg.tipo}</span>
                                  <StatusBadge status={pg.status} />
                                </div>
                              ))}
                              {detalhes.pagamentos.length === 0 && <p className="text-xs text-muted">Sem pagamentos</p>}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-muted text-sm py-10">Nenhum participante encontrado.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── TAB: PAGAMENTOS ─────────────────────────────────────────────────────────
function TabPagamentos() {
  const [pagamentos, setPagamentos] = useState<PagamentoRow[]>([])
  const [filtro, setFiltro] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[]; label: string } | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    const data = await getPagamentos(filtro)
    setPagamentos(data)
    setSelecionados(new Set())
    setLoading(false)
  }, [filtro])

  useEffect(() => {
    const load = async () => {
      try {
        await carregar()
      } catch (e) {
        console.error('[admin] Falha ao carregar pagamentos:', e)
      }
    }
    load()
  }, [carregar])

  const confirmar = async (id: string) => {
    setLoadingId(id)
    const res = await confirmarPagamentoManual(id)
    if (res.error) setMsg('Erro: ' + res.error)
    else { setMsg('Pagamento confirmado manualmente'); carregar() }
    setLoadingId(null)
  }

  const rejeitar = async (id: string) => {
    setLoadingId(id)
    const res = await rejeitarPagamento(id)
    if (res.error) setMsg('Erro: ' + res.error)
    else { setMsg('Pagamento rejeitado'); carregar() }
    setLoadingId(null)
  }

  const eliminar = async (ids: string[]) => {
    setConfirmDelete(null)
    setLoadingId('deleting')
    let res
    if (ids.length === 1) {
      res = await eliminarPagamento(ids[0])
    } else {
      res = await eliminarPagamentosEmMassa(ids)
    }
    if (res.error) setMsg('Erro: ' + res.error)
    else {
      const count = ids.length
      setMsg(count === 1 ? 'Registo eliminado' : `${count} registos eliminados`)
      carregar()
    }
    setLoadingId(null)
  }

  const toggleSelecionado = (id: string) => {
    setSelecionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleTodos = () => {
    if (selecionados.size === pagamentos.length) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(pagamentos.map(p => p.id)))
    }
  }

  const formatMT = (v: number) => `${(v ?? 0).toLocaleString('pt-PT')} MT`
  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  const filtros = ['todos', 'aguardando_comprovativo', 'pendente_confirmacao', 'pendente', 'confirmado', 'falhado']
  const todosSelecionados = pagamentos.length > 0 && selecionados.size === pagamentos.length
  const algumSelecionado = selecionados.size > 0

  return (
    <div className="space-y-4">
      {confirmDelete && (
        <ConfirmModal
          msg={confirmDelete.label}
          onConfirm={() => eliminar(confirmDelete.ids)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {msg && (
        <div className="p-3 rounded-xl text-sm font-semibold flex items-center justify-between"
          style={{ backgroundColor: msg.startsWith('Erro') ? 'var(--danger-bg)' : 'var(--success-tint)', color: msg.startsWith('Erro') ? 'var(--danger)' : 'var(--success)' }}>
          {msg}
          <button onClick={() => setMsg('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Filtros + acções em massa */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          {filtros.map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all"
              style={{
                borderColor: filtro === f ? 'var(--brand)' : 'var(--border)',
                backgroundColor: filtro === f ? 'var(--brand)' : 'white',
                color: filtro === f ? 'white' : 'var(--fg-muted)',
              }}>
              {f === 'todos' ? 'Todos' : BADGE[f]?.label ?? f}
            </button>
          ))}
          <button onClick={carregar} className="ml-auto p-1.5 rounded-lg hover:bg-gray-100">
            <RefreshCw className={`w-4 h-4 text-muted ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Barra de acções em massa — aparece quando há selecções */}
        {algumSelecionado && (
          <div className="flex items-center justify-between p-3 rounded-xl"
            style={{ backgroundColor: 'var(--danger-bg)', border: '1.5px solid #fca5a5' }}>
            <span className="text-sm font-bold text-red-600">
              {selecionados.size} registo{selecionados.size > 1 ? 's' : ''} seleccionado{selecionados.size > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setConfirmDelete({
                ids: [...selecionados],
                label: selecionados.size === 1
                  ? 'Eliminar este registo de pagamento permanentemente?'
                  : `Eliminar ${selecionados.size} registos de pagamento permanentemente? Esta acção não pode ser desfeita.`,
              })}
              disabled={loadingId === 'deleting'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">
              {loadingId === 'deleting'
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : <Trash2 className="w-3.5 h-3.5" />}
              Eliminar seleccionados
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-muted" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--background)' }}>
                  <th className="py-2.5 px-4">
                    <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos}
                      className="w-4 h-4 rounded cursor-pointer accent-blue-700" />
                  </th>
                  {['Participante', 'Tipo', 'Valor', 'Método', 'Data', 'Status', 'Acções'].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-bold text-muted whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagamentos.map(p => {
                  const sel = selecionados.has(p.id)
                  // Inclui comprovativo_enviado_at: a imagem pode ter expirado (24h)
                  // sem que isso deva bloquear a confirmação de um comprovativo que existiu.
                  const temComprovativo = !!p.comprovativo || !!p.comprovativo_imagem_url || !!p.comprovativo_enviado_at
                  const podeConfirmar = p.status === 'pendente' || p.status === 'pendente_confirmacao' || p.status === 'aguardando_comprovativo'
                  return (
                    <React.Fragment key={p.id}>
                      <tr className="border-t transition-colors"
                        style={{ borderColor: 'var(--surface-sunk)', backgroundColor: sel ? '#fef2f2' : p.status === 'pendente_confirmacao' ? 'var(--money-tint)' : undefined }}>
                        <td className="py-3 px-4">
                          <input type="checkbox" checked={sel} onChange={() => toggleSelecionado(p.id)}
                            className="w-4 h-4 rounded cursor-pointer accent-blue-700" />
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-sm truncate max-w-36">{p.usuarios?.nome ?? '—'}</p>
                          <p className="text-xs text-muted truncate max-w-36">{p.usuarios?.email ?? '—'}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs font-bold px-2 py-1 rounded-lg capitalize"
                            style={{ backgroundColor: p.tipo === 'inscricao' ? 'var(--info-tint)' : 'var(--brand)' + '15', color: p.tipo === 'inscricao' ? 'var(--info)' : 'var(--brand)' }}>
                            {p.tipo}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold">{formatMT(p.valor)}</td>
                        <td className="py-3 px-4 text-muted text-xs uppercase">{p.metodo ?? '—'}</td>
                        <td className="py-3 px-4 text-muted text-xs whitespace-nowrap">{formatDate(p.created_at)}</td>
                        <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1 items-center">
                            {podeConfirmar && temComprovativo && (
                              <>
                                <button onClick={() => confirmar(p.id)} disabled={!!loadingId}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white"
                                  style={{ backgroundColor: 'var(--success)' }}>
                                  {loadingId === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                  Confirmar
                                </button>
                                <button onClick={() => rejeitar(p.id)} disabled={!!loadingId}
                                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold text-white bg-red-400 hover:bg-red-500">
                                  <X className="w-3 h-3" />
                                </button>
                              </>
                            )}
                            {podeConfirmar && !temComprovativo && (
                              <span className="text-xs text-muted italic">Sem comprovativo</span>
                            )}
                            <button
                              onClick={() => setConfirmDelete({
                                ids: [p.id],
                                label: `Eliminar este registo de pagamento (${formatMT(p.valor)} · ${p.tipo}) permanentemente?`,
                              })}
                              disabled={!!loadingId}
                              title="Apagar registo"
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Comprovativo expandido */}
                      {(temComprovativo || p.comprovativo_imagem_url || p.comprovativo_enviado_at) && (
                        <tr style={{ borderColor: 'var(--surface-sunk)' }}>
                          <td colSpan={8} className="px-4 pb-3">
                            <div className="ml-8 p-3 rounded-xl text-xs" style={{ backgroundColor: 'var(--surface-sunk)', border: '1px solid var(--border)' }}>
                              <p className="font-bold text-muted mb-2 uppercase tracking-widest" style={{ fontSize: '10px' }}>Comprovativo enviado</p>
                              {p.comprovativo && (
                                <p className="text-gray-600 whitespace-pre-wrap leading-relaxed mb-2">{p.comprovativo}</p>
                              )}
                              {p.comprovativo_imagem_url ? (
                                <a href={p.comprovativo_imagem_url} target="_blank" rel="noopener noreferrer"
                                  className="block rounded-lg overflow-hidden border mb-2 hover:opacity-90 transition-opacity"
                                  style={{ borderColor: 'var(--border)', maxWidth: '320px' }}>
                                  <img src={p.comprovativo_imagem_url} alt="Comprovativo" className="w-full max-h-64 object-contain bg-white" />
                                </a>
                              ) : p.comprovativo_enviado_at && (
                                <p className="italic text-muted mb-2">Imagem já expirou (removida 24h após o envio). Verifica pelo texto acima ou pelo teu telemóvel.</p>
                              )}
                              {p.comprovativo_enviado_at && (
                                <p className="text-muted" style={{ fontSize: '10px' }}>
                                  Enviado: {formatDate(p.comprovativo_enviado_at)}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
            {pagamentos.length === 0 && (
              <p className="text-center text-muted text-sm py-10">Nenhum pagamento encontrado.</p>
            )}
            {pagamentos.length > 0 && (
              <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--surface-sunk)' }}>
                <p className="text-xs text-muted">{pagamentos.length} registo{pagamentos.length !== 1 ? 's' : ''}</p>
                {!algumSelecionado && (
                  <button
                    onClick={() => setConfirmDelete({
                      ids: pagamentos.map(p => p.id),
                      label: `Apagar TODOS os ${pagamentos.length} registos do filtro actual? Esta acção não pode ser desfeita.`,
                    })}
                    className="flex items-center gap-1.5 text-xs text-red-300 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">
                    <Trash2 className="w-3 h-3" /> Apagar todos ({pagamentos.length})
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TAB: VERIFICAÇÕES DE BI ─────────────────────────────────────────────────
function TabVerificacoes() {
  const [lista, setLista] = useState<VerificacaoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [numeroBi, setNumeroBi] = useState<Record<string, string>>({})
  const [motivoRejeicao, setMotivoRejeicao] = useState<Record<string, string>>({})
  const [rejeitando, setRejeitando] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    const data = await getVerificacoesPendentes()
    setLista(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        await carregar()
      } catch (e) {
        console.error('[admin] Falha ao carregar verificações:', e)
      }
    }
    load()
  }, [carregar])

  const aprovar = async (id: string) => {
    const numero = (numeroBi[id] ?? '').trim()
    if (numero.length < 5) { setMsg('Erro: introduz o número do BI antes de aprovar'); return }
    setLoadingId(id)
    const res = await aprovarVerificacao(id, numero)
    if (res.error) setMsg('Erro: ' + res.error)
    else { setMsg('BI verificado com sucesso'); carregar() }
    setLoadingId(null)
  }

  const rejeitar = async (id: string) => {
    setLoadingId(id)
    const res = await rejeitarVerificacao(id, motivoRejeicao[id] ?? '')
    if (res.error) setMsg('Erro: ' + res.error)
    else { setMsg('Verificação rejeitada'); setRejeitando(null); carregar() }
    setLoadingId(null)
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className="p-3 rounded-xl text-sm font-semibold flex items-center justify-between"
          style={{ backgroundColor: msg.startsWith('Erro') ? 'var(--danger-bg)' : 'var(--success-tint)', color: msg.startsWith('Erro') ? 'var(--danger)' : 'var(--success)' }}>
          {msg}
          <button onClick={() => setMsg('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10 bg-white rounded-2xl shadow-sm"><RefreshCw className="w-5 h-5 animate-spin text-muted" /></div>
      ) : lista.length === 0 ? (
        <p className="text-center text-muted text-sm py-10 bg-white rounded-2xl shadow-sm">Nenhuma verificação de BI enviada ainda.</p>
      ) : (
        lista.map((v) => (
          <div key={v.id} className="bg-white rounded-2xl shadow-sm p-5"
            style={{ border: v.status === 'pendente' ? '2px solid var(--money-tint-3)' : undefined }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold">{v.usuarios?.nome ?? '—'}</p>
                <p className="text-xs text-muted">{v.usuarios?.email} · {v.usuarios?.telefone ?? 'sem telefone'}</p>
              </div>
              <StatusBadge status={v.status} />
            </div>

            {(v.bi_imagem_frente_url || v.bi_imagem_verso_url || v.selfie_url) ? (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { url: v.bi_imagem_frente_url, label: 'Frente', alt: 'Frente do BI' },
                  { url: v.bi_imagem_verso_url, label: 'Verso', alt: 'Verso do BI' },
                  { url: v.selfie_url, label: 'Selfie', alt: 'Selfie do titular' },
                ].filter(f => f.url).map(f => (
                  <a key={f.label} href={f.url} target="_blank" rel="noopener noreferrer" download
                    className="block rounded-xl overflow-hidden border hover:opacity-90 transition-opacity"
                    style={{ borderColor: 'var(--border)' }}>
                    <img src={f.url} alt={f.alt} className="w-full h-32 object-cover bg-gray-50" />
                    <p className="text-xs text-center py-1 text-muted">{f.label} · tocar para descarregar</p>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-muted mb-4">Fotos já expiraram (removidas 24h após o envio).</p>
            )}

            {v.status === 'pendente' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text" placeholder="Número do BI (para confirmar)"
                    value={numeroBi[v.id] ?? ''}
                    onChange={(e) => setNumeroBi(m => ({ ...m, [v.id]: e.target.value }))}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--border)' }}
                  />
                  <button onClick={() => aprovar(v.id)} disabled={!!loadingId}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: 'var(--success)' }}>
                    {loadingId === v.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Aprovar
                  </button>
                </div>
                {rejeitando === v.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text" placeholder="Motivo da rejeição (opcional)"
                      value={motivoRejeicao[v.id] ?? ''}
                      onChange={(e) => setMotivoRejeicao(m => ({ ...m, [v.id]: e.target.value }))}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ borderColor: 'var(--border)' }}
                    />
                    <button onClick={() => rejeitar(v.id)} disabled={!!loadingId}
                      className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 flex-shrink-0">
                      Confirmar
                    </button>
                    <button onClick={() => setRejeitando(null)}
                      className="px-3 py-2 rounded-lg text-xs font-bold text-muted bg-gray-100 flex-shrink-0">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setRejeitando(v.id)} disabled={!!loadingId}
                    className="text-xs font-bold text-red-400 hover:text-red-600">
                    Rejeitar
                  </button>
                )}
              </div>
            )}

            {v.status === 'rejeitado' && v.motivo_rejeicao && (
              <p className="text-xs text-red-500 mt-1">Motivo: {v.motivo_rejeicao}</p>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ─── TAB: CONTRATOS ───────────────────────────────────────────────────────────
function TabContratos() {
  const [lista, setLista] = useState<ContratoRow[]>([])
  const [filtro, setFiltro] = useState('pendente')
  const [loading, setLoading] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [motivoRejeicao, setMotivoRejeicao] = useState<Record<string, string>>({})
  const [rejeitando, setRejeitando] = useState<string | null>(null)
  const [auditoriaId, setAuditoriaId] = useState<string | null>(null)
  const [auditoria, setAuditoria] = useState<AuditoriaRow[]>([])

  const carregar = useCallback(async () => {
    setLoading(true)
    const data = await getContratosAdmin(filtro)
    setLista(data)
    setLoading(false)
  }, [filtro])

  useEffect(() => {
    const load = async () => {
      try {
        await carregar()
      } catch (e) {
        console.error('[admin] Falha ao carregar contratos:', e)
      }
    }
    load()
  }, [carregar])

  const aprovar = async (id: string) => {
    setLoadingId(id)
    const res = await aprovarContrato(id)
    if (res.error) setMsg('Erro: ' + res.error)
    else { setMsg('Contrato aprovado. O participante já pode assinar'); carregar() }
    setLoadingId(null)
  }

  const rejeitar = async (id: string) => {
    setLoadingId(id)
    const res = await rejeitarContrato(id, motivoRejeicao[id] ?? '')
    if (res.error) setMsg('Erro: ' + res.error)
    else { setMsg('Correcção pedida ao participante'); setRejeitando(null); carregar() }
    setLoadingId(null)
  }

  const descarregar = async (id: string) => {
    setLoadingId(id)
    const res = await getContratoDownloadAdmin(id)
    if (res.error) setMsg('Erro: ' + res.error)
    else if (res.url) window.open(res.url, '_blank')
    setLoadingId(null)
  }

  const verAuditoria = async (id: string) => {
    if (auditoriaId === id) { setAuditoriaId(null); return }
    setAuditoriaId(id)
    setAuditoria(await getAuditoriaContrato(id))
  }

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
  const filtros = ['pendente', 'em_analise', 'a_aguardar_assinatura', 'assinado', 'rejeitado', 'todos']

  return (
    <div className="space-y-4">
      {msg && (
        <div className="p-3 rounded-xl text-sm font-semibold flex items-center justify-between"
          style={{ backgroundColor: msg.startsWith('Erro') ? 'var(--danger-bg)' : 'var(--success-tint)', color: msg.startsWith('Erro') ? 'var(--danger)' : 'var(--success)' }}>
          {msg}
          <button onClick={() => setMsg('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-wrap gap-2 items-center">
        {filtros.map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all"
            style={{
              borderColor: filtro === f ? 'var(--brand)' : 'var(--border)',
              backgroundColor: filtro === f ? 'var(--brand)' : 'white',
              color: filtro === f ? 'white' : 'var(--fg-muted)',
            }}>
            {f === 'todos' ? 'Todos' : BADGE[f]?.label ?? f}
          </button>
        ))}
        <button onClick={carregar} className="ml-auto p-1.5 rounded-lg hover:bg-gray-100">
          <RefreshCw className={`w-4 h-4 text-muted ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10 bg-white rounded-2xl shadow-sm"><RefreshCw className="w-5 h-5 animate-spin text-muted" /></div>
      ) : lista.length === 0 ? (
        <p className="text-center text-muted text-sm py-10 bg-white rounded-2xl shadow-sm">Nenhum contrato neste estado.</p>
      ) : (
        lista.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl shadow-sm p-5"
            style={{ border: c.estado === 'pendente' ? '2px solid var(--money-tint-3)' : undefined }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-muted" /> {c.numero}</p>
                <p className="text-xs text-muted">{c.usuarios?.nome ?? '—'} · {c.usuarios?.email}</p>
              </div>
              <StatusBadge status={c.estado} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mb-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--background)' }}>
              <div><p className="text-muted">Nascimento</p><p className="font-semibold">{c.dados?.nascimento ?? '—'}</p></div>
              <div><p className="text-muted">Nacionalidade</p><p className="font-semibold">{c.dados?.nacionalidade ?? '—'}</p></div>
              <div><p className="text-muted">BI</p><p className="font-semibold">{c.dados?.biNumero ?? '—'} · vál. {c.dados?.biValidade ?? '—'}</p></div>
              <div><p className="text-muted">NUIT</p><p className="font-semibold">{c.dados?.nuit ?? '—'}</p></div>
              <div><p className="text-muted">Telefone</p><p className="font-semibold">{c.dados?.telefone ?? '—'}</p></div>
              <div className="col-span-2 sm:col-span-1"><p className="text-muted">Morada</p><p className="font-semibold truncate">{c.dados?.morada ?? '—'}</p></div>
            </div>

            {c.estado === 'rejeitado' && c.rejeitado_motivo && (
              <p className="text-xs text-red-500 mb-3">Motivo enviado: {c.rejeitado_motivo}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {['pendente', 'em_analise'].includes(c.estado) && (
                rejeitando === c.id ? (
                  <>
                    <input type="text" placeholder="Motivo da correcção"
                      value={motivoRejeicao[c.id] ?? ''}
                      onChange={(e) => setMotivoRejeicao(m => ({ ...m, [c.id]: e.target.value }))}
                      className="flex-1 min-w-[140px] border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--border)' }} />
                    <button onClick={() => rejeitar(c.id)} disabled={!!loadingId}
                      className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600">Confirmar</button>
                    <button onClick={() => setRejeitando(null)} className="px-3 py-2 rounded-lg text-xs font-bold text-muted bg-gray-100">Cancelar</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => aprovar(c.id)} disabled={!!loadingId}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ backgroundColor: 'var(--success)' }}>
                      {loadingId === c.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Aprovar
                    </button>
                    <button onClick={() => setRejeitando(c.id)} disabled={!!loadingId}
                      className="px-3 py-2 rounded-lg text-xs font-bold text-red-400 hover:bg-red-50">Pedir correcção</button>
                  </>
                )
              )}

              {['assinado', 'finalizado'].includes(c.estado) && (
                <button onClick={() => descarregar(c.id)} disabled={!!loadingId}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ backgroundColor: 'var(--brand)' }}>
                  <Download className="w-3.5 h-3.5" /> Descarregar PDF · {c.pdf_paginas ?? '?'} pág.
                </button>
              )}

              <button onClick={() => verAuditoria(c.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-muted hover:bg-gray-100">
                <History className="w-3.5 h-3.5" /> Histórico
              </button>
            </div>

            {auditoriaId === c.id && (
              <div className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: 'var(--surface-sunk)' }}>
                {auditoria.length === 0 ? (
                  <p className="text-xs text-muted">Sem registos.</p>
                ) : auditoria.map((a) => (
                  <div key={a.id} className="flex justify-between text-xs">
                    <span className="text-muted">{a.evento}</span>
                    <span className="text-muted">{formatDate(a.criado_em)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ─── TAB: CICLOS ─────────────────────────────────────────────────────────────
function TabCiclos({ onRefresh }: { onRefresh: () => void }) {
  const [ciclos, setCiclos] = useState<CicloRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [criando, setCriando] = useState(false)

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const formatMT = (v: number) => `${(v ?? 0).toLocaleString('pt-PT')} MT`

  useEffect(() => {
    getCiclos().then(data => { setCiclos(data); setLoading(false) })
  }, [])

  const alterarEstado = async (id: string, estado: string) => {
    setLoadingId(id)
    const res = await alterarEstadoCiclo(id, estado)
    if (res.error) setMsg('Erro: ' + res.error)
    else { setMsg('Estado alterado'); const data = await getCiclos(); setCiclos(data); onRefresh() }
    setLoadingId(null)
  }

  const novoCiclo = async () => {
    if (!confirm('Criar novo ciclo? O ciclo actual será fechado e as inscrições resetadas.')) return
    setCriando(true)
    const res = await criarNovoCiclo()
    if (res.error) setMsg('Erro: ' + res.error)
    else { setMsg('Novo ciclo criado'); const data = await getCiclos(); setCiclos(data); onRefresh() }
    setCriando(false)
  }

  const estados = ['aguardando_minimo', 'activo', 'concluido']

  return (
    <div className="space-y-4">
      {msg && (
        <div className="p-3 rounded-xl text-sm font-semibold flex items-center justify-between"
          style={{ backgroundColor: msg.startsWith('Erro') ? 'var(--danger-bg)' : 'var(--success-tint)', color: msg.startsWith('Erro') ? 'var(--danger)' : 'var(--success)' }}>
          {msg}
          <button onClick={() => setMsg('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={novoCiclo} disabled={criando}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white text-sm transition-all"
          style={{ backgroundColor: 'var(--brand)' }}>
          {criando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Novo Ciclo
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-muted" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--background)' }}>
                  {['Estado', 'Acumulado', 'Meta', 'Inscritos', 'Mínimo', 'Criado', 'Concluído', 'Alterar Estado'].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-bold text-muted whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ciclos.map(c => (
                  <tr key={c.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--surface-sunk)' }}>
                    <td className="py-3 px-4"><StatusBadge status={c.estado} /></td>
                    <td className="py-3 px-4 font-bold" style={{ color: 'var(--money)' }}>{formatMT(c.total_acumulado)}</td>
                    <td className="py-3 px-4">{formatMT(c.meta)}</td>
                    <td className="py-3 px-4 font-bold" style={{ color: 'var(--brand)' }}>{c.participantes_count}</td>
                    <td className="py-3 px-4 text-muted">{c.minimo_participantes}</td>
                    <td className="py-3 px-4 text-muted text-xs whitespace-nowrap">{formatDate(c.created_at)}</td>
                    <td className="py-3 px-4 text-muted text-xs whitespace-nowrap">{formatDate(c.concluido_at)}</td>
                    <td className="py-3 px-4">
                      <select
                        value={c.estado}
                        onChange={e => alterarEstado(c.id, e.target.value)}
                        disabled={loadingId === c.id}
                        className="text-xs border rounded-lg px-2 py-1.5 outline-none"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        {estados.map(e => <option key={e} value={e}>{BADGE[e]?.label ?? e}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TAB: SORTEIO ────────────────────────────────────────────────────────────
function TabSorteio({ stats, onRefresh }: { stats: AdminStats; onRefresh: () => void }) {
  const [realizando, setRealizando] = useState(false)
  const [resultado, setResultado] = useState<{ nome: string; email: string; telefone?: string } | null>(null)
  const [erro, setErro] = useState('')
  const [historico, setHistorico] = useState<Awaited<ReturnType<typeof getSorteios>>>([])
  const [confirm, setConfirm] = useState(false)
  const formatMT = (v: number) => `${(v ?? 0).toLocaleString('pt-PT')} MT`
  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  useEffect(() => {
    getSorteios().then(setHistorico)
  }, [])

  const canSorteio = stats?.cicloActivo?.estado === 'activo'
  const ciclo = stats?.cicloActivo

  const executar = async () => {
    setConfirm(false)
    setRealizando(true)
    setErro('')
    setResultado(null)
    const res = await realizarSorteio()
    if (res.error) setErro(res.error)
    else {
      setResultado({ nome: res.winnerNome!, email: res.winnerEmail!, telefone: res.winnerTelefone ?? undefined })
      getSorteios().then(setHistorico)
      onRefresh()
    }
    setRealizando(false)
  }

  return (
    <div className="space-y-4">
      {confirm && (
        <ConfirmModal
          msg={`Realizar o sorteio agora? Esta acção fecha o ciclo actual e selecciona o vencedor. Irreversível.`}
          onConfirm={executar}
          onCancel={() => setConfirm(false)}
        />
      )}

      {/* Estado do ciclo para sorteio */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="font-black mb-4" style={{ color: 'var(--brand)' }}>Condições para o Sorteio</h2>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: 'Estado do ciclo', value: <StatusBadge status={ciclo?.estado ?? '—'} />, ok: ciclo?.estado === 'activo' },
            { label: 'Participantes', value: `${ciclo?.participantes_count ?? 0} / ${ciclo?.minimo_participantes ?? 3000}`, ok: (ciclo?.participantes_count ?? 0) >= (ciclo?.minimo_participantes ?? 3000) },
            { label: 'Fundo acumulado', value: formatMT(ciclo?.total_acumulado ?? 0), ok: (ciclo?.total_acumulado ?? 0) >= 300000 },
            { label: 'Alvo real necessário', value: formatMT(300000), ok: true },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: c.ok ? 'var(--success-tint)' : 'var(--surface-sunk)' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: c.ok ? 'var(--success)' : 'var(--border)' }}>
                {c.ok ? <Check className="w-3.5 h-3.5 text-white" /> : <X className="w-3.5 h-3.5 text-white" />}
              </div>
              <div>
                <p className="text-xs text-muted">{c.label}</p>
                <div className="font-bold text-sm">{c.value}</div>
              </div>
            </div>
          ))}
        </div>

        {resultado && (
          <div className="mb-4 p-4 rounded-2xl text-center" style={{ backgroundColor: 'var(--success-tint)', border: '2px solid var(--success-tint-3)' }}>
            <Trophy className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--money)' }} />
            <p className="font-black text-lg" style={{ color: 'var(--success)' }}>Vencedor Seleccionado!</p>
            <p className="font-bold text-xl mt-1">{resultado.nome}</p>
            <p className="text-sm text-muted">{resultado.email}</p>
            {resultado.telefone && (
              <p className="text-base font-mono font-bold mt-2" style={{ color: 'var(--brand)' }}>{resultado.telefone}</p>
            )}
          </div>
        )}

        {erro && (
          <div className="mb-4 p-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100">{erro}</div>
        )}

        <button
          onClick={() => setConfirm(true)}
          disabled={realizando || !canSorteio}
          className="w-full py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all disabled:opacity-40"
          style={{ backgroundColor: 'var(--money)', color: 'var(--brand)' }}
        >
          {realizando
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> A realizar sorteio...</>
            : <><Trophy className="w-4 h-4" /> Seleccionar Vencedor</>}
        </button>
        {!canSorteio && (
          <p className="text-xs text-center text-muted mt-2">
            O ciclo precisa de estar em estado <strong>Activo</strong> para realizar o sorteio.
          </p>
        )}
      </div>

      {/* Histórico */}
      {historico.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 pb-3">
            <h2 className="font-black" style={{ color: 'var(--brand)' }}>Histórico de Sorteios</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--background)' }}>
                  {['Vencedor', 'Email', 'Prémio', 'Fundo Total', 'Data'].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-bold text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historico.map(s => (
                  <tr key={s.id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--surface-sunk)' }}>
                    <td className="py-3 px-4 font-bold">{s.vencedor?.nome ?? '—'}</td>
                    <td className="py-3 px-4 text-muted text-xs">{s.vencedor?.email ?? '—'}</td>
                    <td className="py-3 px-4 font-bold" style={{ color: 'var(--money)' }}>{formatMT(s.premio)}</td>
                    <td className="py-3 px-4">{formatMT(s.ciclo?.total_acumulado)}</td>
                    <td className="py-3 px-4 text-muted text-xs whitespace-nowrap">{formatDate(s.realizado_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PÁGINA PRINCIPAL ────────────────────────────────────────────────────────
export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('dashboard')
  const router = useRouter()

  const loadStats = useCallback(async () => {
    setLoading(true)
    const data = await getAdminStats()
    setStats(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        await loadStats()
      } catch (e) {
        console.error('[admin] Falha ao carregar estatísticas:', e)
      }
    }
    load()
  }, [loadStats])

  const handleLogout = async () => {
    await logoutAdmin()
    router.push('/')
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard',     label: 'Dashboard',     icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'participantes', label: 'Participantes',  icon: <Users className="w-4 h-4" />, badge: stats?.totalParticipantes },
    { id: 'pagamentos',    label: 'Pagamentos',     icon: <CreditCard className="w-4 h-4" />, badge: stats?.pagamentosPendentes || undefined },
    { id: 'verificacoes',  label: 'Verificação BI', icon: <ShieldCheck className="w-4 h-4" />, badge: stats?.verificacoesPendentes || undefined },
    { id: 'contratos',     label: 'Contratos',      icon: <FileText className="w-4 h-4" />, badge: stats?.contratosPendentes || undefined },
    { id: 'ciclos',        label: 'Ciclos',         icon: <RefreshCw className="w-4 h-4" /> },
    { id: 'sorteio',       label: 'Sorteio',        icon: <Trophy className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <header className="bg-white sticky top-0 z-40 relative overflow-hidden" style={{ borderBottom: '3px solid var(--brand)' }}>
        <EuropaWatermark size={220} color="var(--brand)" opacity={0.06} className="absolute -top-16 -right-10 pointer-events-none hidden sm:block" />
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1.5 rounded-lg hover:bg-gray-100 text-muted hover:text-gray-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <p className="font-black text-base" style={{ color: 'var(--brand)' }}>SonhoEuropa · Admin</p>
              <p className="text-xs text-muted">Painel de Gestão</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadStats} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Actualizar">
              <RefreshCw className={`w-4 h-4 text-muted ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto pb-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all relative"
              style={{
                borderColor: tab === t.id ? 'var(--brand)' : 'transparent',
                color: tab === t.id ? 'var(--brand)' : 'var(--fg-muted)',
              }}>
              {t.icon}
              {t.label}
              {!!t.badge && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-white text-xs font-black"
                  style={{ backgroundColor: t.id === 'pagamentos' || t.id === 'verificacoes' || t.id === 'contratos' ? 'var(--money)' : 'var(--brand)', fontSize: '10px' }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-5">
        {loading && !stats ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {tab === 'dashboard'     && <Reveal><TabDashboard stats={stats} /></Reveal>}
            {tab === 'participantes' && <Reveal><TabParticipantes participantes={stats?.participantes ?? []} onRefresh={loadStats} /></Reveal>}
            {tab === 'pagamentos'    && <Reveal><TabPagamentos /></Reveal>}
            {tab === 'verificacoes'  && <Reveal><TabVerificacoes /></Reveal>}
            {tab === 'contratos'     && <Reveal><TabContratos /></Reveal>}
            {tab === 'ciclos'        && <Reveal><TabCiclos onRefresh={loadStats} /></Reveal>}
            {tab === 'sorteio'       && <Reveal><TabSorteio stats={stats} onRefresh={loadStats} /></Reveal>}
          </>
        )}
      </div>
    </div>
  )
}
