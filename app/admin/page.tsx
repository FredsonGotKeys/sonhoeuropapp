'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Trophy, TrendingUp, DollarSign, RefreshCw, LogOut,
  Trash2, Edit2, Check, X, ChevronDown, ChevronUp, Search,
  CreditCard, AlertCircle, ShieldCheck, Plus, Eye, BarChart2,
  ArrowLeft,
} from 'lucide-react'
import {
  realizarSorteio, getAdminStats, logoutAdmin,
  eliminarParticipante, editarParticipante, getParticipanteDetalhes,
  getPagamentos, confirmarPagamentoManual, rejeitarPagamento,
  eliminarPagamento, eliminarPagamentosEmMassa,
  getCiclos, alterarEstadoCiclo, criarNovoCiclo, getSorteios,
} from '@/app/actions/admin'

type Tab = 'dashboard' | 'participantes' | 'pagamentos' | 'ciclos' | 'sorteio'

const BADGE: Record<string, { label: string; bg: string; color: string }> = {
  pendente:               { label: 'Pendente',        bg: '#F5F5F0',      color: '#888' },
  aguardando_comprovativo: { label: 'Sem comprovativo', bg: '#7c3aed15',  color: '#7c3aed' },
  pendente_confirmacao:   { label: 'A confirmar',     bg: '#EF9F2715',    color: '#EF9F27' },
  confirmado:             { label: 'Confirmado',       bg: '#1D9E7515',    color: '#1D9E75' },
  falhado:                { label: 'Falhado',          bg: '#fee2e2',      color: '#dc2626' },
  aguardando_minimo:      { label: 'Aguardando',       bg: '#EF9F2715',    color: '#EF9F27' },
  activo:                 { label: 'Activo',           bg: '#1D9E7515',    color: '#1D9E75' },
  concluido:              { label: 'Concluído',        bg: '#F5F5F0',      color: '#888' },
}

function StatusBadge({ status }: { status: string }) {
  const b = BADGE[status] ?? { label: status, bg: '#F5F5F0', color: '#888' }
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
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold text-gray-500 hover:bg-gray-50"
            style={{ borderColor: '#e5e7eb' }}>Cancelar</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: DASHBOARD ──────────────────────────────────────────────────────────
function TabDashboard({ stats }: { stats: any }) {
  const formatMT = (v: number) => `${(v ?? 0).toLocaleString('pt-PT')} MT`
  const ciclo = stats?.cicloActivo
  const fin = stats?.financeiro ?? {}

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Fundo Acumulado', value: formatMT(ciclo?.total_acumulado ?? 0), icon: <TrendingUp className="w-4 h-4" />, color: '#003399' },
          { label: 'Participantes', value: stats?.totalParticipantes ?? 0, icon: <Users className="w-4 h-4" />, color: '#1D9E75' },
          { label: 'Depósitos (bruto)', value: formatMT(fin.depositosBruto ?? 0), icon: <DollarSign className="w-4 h-4" />, color: '#EF9F27' },
          { label: 'Inscrições (bruto)', value: formatMT(fin.totalInscricoes ?? 0), icon: <CreditCard className="w-4 h-4" />, color: '#7c3aed' },
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
      <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: '2px solid #1D9E7530' }}>
        <h2 className="font-black mb-1 flex items-center gap-2" style={{ color: '#1D9E75' }}>
          <DollarSign className="w-4 h-4" /> A Minha Receita
        </h2>
        <p className="text-xs text-gray-400 mb-4">Inscrições (100% tuas) + Comissão sobre depósitos (10% antes da cobertura, 20% após)</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: '#1D9E7510', border: '1.5px solid #1D9E7525' }}>
            <p className="text-xs text-gray-500 mb-1">Receita Total</p>
            <p className="text-xl font-black" style={{ color: '#1D9E75' }}>{formatMT(fin.receitaTotal ?? 0)}</p>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: '#7c3aed10' }}>
            <p className="text-xs text-gray-500 mb-1">Inscrições (100%)</p>
            <p className="font-black" style={{ color: '#7c3aed' }}>{formatMT(fin.totalInscricoes ?? 0)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{fin.numInscricoes ?? 0} inscritos</p>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: '#EF9F2710' }}>
            <p className="text-xs text-gray-500 mb-1">10% (pré-cobertura)</p>
            <p className="font-black" style={{ color: '#EF9F27' }}>{formatMT(fin.comissaoPreCobertura ?? 0)}</p>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: '#ef444410' }}>
            <p className="text-xs text-gray-500 mb-1">20% (pós-cobertura)</p>
            <p className="font-black" style={{ color: '#ef4444' }}>{formatMT(fin.comissaoPosCobertura ?? 0)}</p>
            {fin.coberturaAtingida && <p className="text-xs text-green-500 mt-0.5">Activa</p>}
          </div>
        </div>

        <div className="rounded-xl overflow-hidden text-sm" style={{ border: '1px solid #e5e7eb' }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--background)' }}>
                <th className="text-left py-2 px-4 text-xs font-bold text-gray-400">Fonte</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-gray-400">Valor Recebido</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-gray-400">Tua Receita</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-gray-400">Vai para o Fundo</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t" style={{ borderColor: '#F5F5F0' }}>
                <td className="py-2.5 px-4 font-semibold">Depósitos 10% ({fin.numDepositos ?? 0}x)</td>
                <td className="py-2.5 px-4 text-right">{formatMT(fin.brutoPreCobertura ?? 0)}</td>
                <td className="py-2.5 px-4 text-right font-bold" style={{ color: '#EF9F27' }}>{formatMT(fin.comissaoPreCobertura ?? 0)}</td>
                <td className="py-2.5 px-4 text-right font-bold" style={{ color: '#003399' }}>{formatMT(fin.fundoAcumulado ?? 0)}</td>
              </tr>
              {(fin.brutoPosCobertura ?? 0) > 0 && (
                <tr className="border-t" style={{ borderColor: '#F5F5F0' }}>
                  <td className="py-2.5 px-4 font-semibold">Depósitos 20% (pós-cobertura)</td>
                  <td className="py-2.5 px-4 text-right">{formatMT(fin.brutoPosCobertura ?? 0)}</td>
                  <td className="py-2.5 px-4 text-right font-bold" style={{ color: '#ef4444' }}>{formatMT(fin.comissaoPosCobertura ?? 0)}</td>
                  <td className="py-2.5 px-4 text-right text-gray-300">0 MT</td>
                </tr>
              )}
              <tr className="border-t" style={{ borderColor: '#F5F5F0' }}>
                <td className="py-2.5 px-4 font-semibold">Inscrições ({fin.numInscricoes ?? 0}x)</td>
                <td className="py-2.5 px-4 text-right">{formatMT(fin.totalInscricoes ?? 0)}</td>
                <td className="py-2.5 px-4 text-right font-bold" style={{ color: '#1D9E75' }}>{formatMT(fin.totalInscricoes ?? 0)}</td>
                <td className="py-2.5 px-4 text-right text-gray-300">0 MT</td>
              </tr>
              <tr className="border-t-2 font-black" style={{ borderColor: '#003399', backgroundColor: '#00339908' }}>
                <td className="py-3 px-4" style={{ color: '#003399' }}>TOTAL</td>
                <td className="py-3 px-4 text-right">{formatMT((fin.depositosBruto ?? 0) + (fin.totalInscricoes ?? 0))}</td>
                <td className="py-3 px-4 text-right" style={{ color: '#1D9E75' }}>{formatMT(fin.receitaTotal ?? 0)}</td>
                <td className="py-3 px-4 text-right" style={{ color: '#003399' }}>{formatMT(fin.fundoAcumulado ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Estado do ciclo */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="font-black mb-3" style={{ color: '#003399' }}>Estado do Ciclo Actual</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div><p className="text-xs text-gray-400">Estado</p><StatusBadge status={ciclo?.estado ?? '—'} /></div>
          <div><p className="text-xs text-gray-400">Meta</p><p className="font-bold">{formatMT(ciclo?.meta ?? 200000)}</p></div>
          <div>
            <p className="text-xs text-gray-400">Fundo (visível aos utilizadores)</p>
            <p className="font-bold" style={{ color: '#EF9F27' }}>{formatMT(ciclo?.total_acumulado ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Total bruto depositado</p>
            <p className="font-bold" style={{ color: '#003399' }}>{formatMT(fin.depositosBruto ?? 0)}</p>
          </div>
          <div><p className="text-xs text-gray-400">Inscritos</p><p className="font-bold">{ciclo?.participantes_count ?? 0} / {ciclo?.minimo_participantes ?? 150}</p></div>
          <div><p className="text-xs text-gray-400">Pagamentos a confirmar</p><p className="font-bold text-orange-500">{stats?.pagamentosPendentes ?? 0}</p></div>
          <div><p className="text-xs text-gray-400">Pagamentos confirmados</p><p className="font-bold" style={{ color: '#1D9E75' }}>{stats?.pagamentosConfirmados ?? 0}</p></div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Progresso (visível ao utilizador)</span>
            <span style={{ color: '#EF9F27' }}>
              {((ciclo?.total_acumulado ?? 0) / 300000 * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(((ciclo?.total_acumulado ?? 0) / 300000) * 100, 100)}%`, background: 'linear-gradient(90deg, #EF9F27, #f5c056)' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: PARTICIPANTES ──────────────────────────────────────────────────────
function TabParticipantes({ participantes, onRefresh }: { participantes: any[]; onRefresh: () => void }) {
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ nome: '' })
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const [detalhes, setDetalhes] = useState<any>(null)
  const [confirm, setConfirm] = useState<{ id: string; nome: string } | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const filtered = participantes.filter(u =>
    u.nome?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => sortBy === 'depositos'
    ? (b.total_depositado ?? 0) - (a.total_depositado ?? 0)
    : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
  const formatMT = (v: number) => `${(v ?? 0).toLocaleString('pt-PT')} MT`

  const [sortBy, setSortBy] = useState<'registro' | 'depositos'>('depositos')

  const iniciarEdicao = (u: any) => {
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
          style={{ backgroundColor: msg.startsWith('Erro') ? '#fee2e2' : '#1D9E7515', color: msg.startsWith('Erro') ? '#dc2626' : '#1D9E75' }}>
          {msg}
          <button onClick={() => setMsg('')} className="ml-3 opacity-60 hover:opacity-100"><X className="w-3 h-3 inline" /></button>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" placeholder="Pesquisar por nome ou email..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 text-sm outline-none"
            style={{ borderColor: '#e5e7eb' }}
            onFocus={e => e.target.style.borderColor = '#003399'}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">{filtered.length} de {participantes.length} participantes</p>
        <div className="flex gap-2 mt-2">
          <button onClick={() => setSortBy('depositos')}
            className="text-xs px-3 py-1 rounded-full font-semibold transition-colors"
            style={{ backgroundColor: sortBy === 'depositos' ? '#003399' : '#f3f4f6', color: sortBy === 'depositos' ? '#fff' : '#666' }}>
            Maior depositante
          </button>
          <button onClick={() => setSortBy('registro')}
            className="text-xs px-3 py-1 rounded-full font-semibold transition-colors"
            style={{ backgroundColor: sortBy === 'registro' ? '#003399' : '#f3f4f6', color: sortBy === 'registro' ? '#fff' : '#666' }}>
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
                  <th key={h} className="text-left py-2.5 px-4 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <React.Fragment key={u.id}>
                  <tr className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: '#F5F5F0' }}>
                    <td className="py-3 px-4 text-gray-300 font-mono text-xs">{i + 1}</td>
                    <td className="py-3 px-4">
                      {editId === u.id ? (
                        <input className="border rounded-lg px-2 py-1 text-sm w-36 outline-none" style={{ borderColor: '#003399' }}
                          value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} />
                      ) : (
                        <div>
                          <p className="font-semibold truncate max-w-40">{u.nome}</p>
                          <p className="text-xs text-gray-400 truncate max-w-40">{u.email}</p>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold" style={{ color: (u.total_depositado ?? 0) > 0 ? '#003399' : '#ccc' }}>
                        {formatMT(u.total_depositado ?? 0)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">{formatDate(u.created_at)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {editId === u.id ? (
                          <>
                            <button onClick={guardarEdicao} disabled={!!loading}
                              className="p-1.5 rounded-lg text-white transition-colors"
                              style={{ backgroundColor: '#1D9E75' }}>
                              {loading === 'edit-' + u.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => setEditId(null)}
                              className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => verDetalhes(u.id)} title="Ver detalhes"
                              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
                              {detalheId === u.id ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => iniciarEdicao(u)} title="Editar"
                              className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors" style={{ color: '#003399' }}>
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
                    <tr style={{ borderColor: '#F5F5F0' }}>
                      <td colSpan={5} className="px-4 pb-4">
                        {!detalhes ? (
                          <div className="flex justify-center py-4"><RefreshCw className="w-4 h-4 animate-spin text-gray-300" /></div>
                        ) : (
                          <div className="grid sm:grid-cols-3 gap-3 pt-2">
                            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--background)' }}>
                              <p className="text-xs font-bold text-gray-500 mb-2">Depósitos ({detalhes.depositos.length})</p>
                              {detalhes.depositos.slice(0, 5).map((d: any) => (
                                <div key={d.id} className="flex justify-between text-xs py-1 border-b" style={{ borderColor: '#e5e7eb' }}>
                                  <span>{formatMT(d.valor)}</span>
                                  <span className="text-gray-400">{formatDate(d.data_deposito)}</span>
                                </div>
                              ))}
                              {detalhes.depositos.length === 0 && <p className="text-xs text-gray-400">Sem depósitos</p>}
                            </div>
                            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--background)' }}>
                              <p className="text-xs font-bold text-gray-500 mb-2">Inscrições ({detalhes.inscricoes.length})</p>
                              {detalhes.inscricoes.map((ins: any) => (
                                <div key={ins.ciclo_id} className="text-xs py-1">
                                  <StatusBadge status={ins.ciclos?.estado ?? '—'} />
                                  <span className="ml-2 text-gray-400">{formatMT(ins.taxa_paga)}</span>
                                </div>
                              ))}
                              {detalhes.inscricoes.length === 0 && <p className="text-xs text-gray-400">Não inscrito</p>}
                            </div>
                            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--background)' }}>
                              <p className="text-xs font-bold text-gray-500 mb-2">Pagamentos ({detalhes.pagamentos.length})</p>
                              {detalhes.pagamentos.slice(0, 4).map((pg: any) => (
                                <div key={pg.id} className="flex justify-between items-center text-xs py-1">
                                  <span>{formatMT(pg.valor)} · {pg.tipo}</span>
                                  <StatusBadge status={pg.status} />
                                </div>
                              ))}
                              {detalhes.pagamentos.length === 0 && <p className="text-xs text-gray-400">Sem pagamentos</p>}
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
            <p className="text-center text-gray-400 text-sm py-10">Nenhum participante encontrado.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── TAB: PAGAMENTOS ─────────────────────────────────────────────────────────
function TabPagamentos() {
  const [pagamentos, setPagamentos] = useState<any[]>([])
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

  useEffect(() => { carregar() }, [carregar])

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
          style={{ backgroundColor: msg.startsWith('Erro') ? '#fee2e2' : '#1D9E7515', color: msg.startsWith('Erro') ? '#dc2626' : '#1D9E75' }}>
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
                borderColor: filtro === f ? '#003399' : '#e5e7eb',
                backgroundColor: filtro === f ? '#003399' : 'white',
                color: filtro === f ? 'white' : '#666',
              }}>
              {f === 'todos' ? 'Todos' : BADGE[f]?.label ?? f}
            </button>
          ))}
          <button onClick={carregar} className="ml-auto p-1.5 rounded-lg hover:bg-gray-100">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Barra de acções em massa — aparece quando há selecções */}
        {algumSelecionado && (
          <div className="flex items-center justify-between p-3 rounded-xl"
            style={{ backgroundColor: '#fee2e2', border: '1.5px solid #fca5a5' }}>
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
          <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-gray-300" /></div>
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
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagamentos.map(p => {
                  const sel = selecionados.has(p.id)
                  const temComprovativo = !!p.comprovativo || !!p.comprovativo_imagem_url
                  const podeConfirmar = p.status === 'pendente' || p.status === 'pendente_confirmacao' || p.status === 'aguardando_comprovativo'
                  return (
                    <React.Fragment key={p.id}>
                      <tr className="border-t transition-colors"
                        style={{ borderColor: '#F5F5F0', backgroundColor: sel ? '#fef2f2' : p.status === 'pendente_confirmacao' ? '#EF9F2708' : undefined }}>
                        <td className="py-3 px-4">
                          <input type="checkbox" checked={sel} onChange={() => toggleSelecionado(p.id)}
                            className="w-4 h-4 rounded cursor-pointer accent-blue-700" />
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-sm truncate max-w-36">{p.usuarios?.nome ?? '—'}</p>
                          <p className="text-xs text-gray-400 truncate max-w-36">{p.usuarios?.email ?? '—'}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs font-bold px-2 py-1 rounded-lg capitalize"
                            style={{ backgroundColor: p.tipo === 'inscricao' ? '#7c3aed15' : '#003399' + '15', color: p.tipo === 'inscricao' ? '#7c3aed' : '#003399' }}>
                            {p.tipo}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold">{formatMT(p.valor)}</td>
                        <td className="py-3 px-4 text-gray-400 text-xs uppercase">{p.metodo ?? '—'}</td>
                        <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">{formatDate(p.created_at)}</td>
                        <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1 items-center">
                            {podeConfirmar && temComprovativo && (
                              <>
                                <button onClick={() => confirmar(p.id)} disabled={!!loadingId}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white"
                                  style={{ backgroundColor: '#1D9E75' }}>
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
                              <span className="text-xs text-gray-300 italic">Sem comprovativo</span>
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
                      {(temComprovativo || p.comprovativo_imagem_url) && (
                        <tr style={{ borderColor: '#F5F5F0' }}>
                          <td colSpan={8} className="px-4 pb-3">
                            <div className="ml-8 p-3 rounded-xl text-xs" style={{ backgroundColor: '#F5F5F0', border: '1px solid #e5e7eb' }}>
                              <p className="font-bold text-gray-500 mb-2 uppercase tracking-widest" style={{ fontSize: '10px' }}>Comprovativo enviado</p>
                              {p.comprovativo && (
                                <p className="text-gray-600 whitespace-pre-wrap leading-relaxed mb-2">{p.comprovativo}</p>
                              )}
                              {p.comprovativo_imagem_url && (
                                <a href={p.comprovativo_imagem_url} target="_blank" rel="noopener noreferrer"
                                  className="block rounded-lg overflow-hidden border mb-2 hover:opacity-90 transition-opacity"
                                  style={{ borderColor: '#e5e7eb', maxWidth: '320px' }}>
                                  <img src={p.comprovativo_imagem_url} alt="Comprovativo" className="w-full max-h-64 object-contain bg-white" />
                                </a>
                              )}
                              {p.comprovativo_enviado_at && (
                                <p className="text-gray-300" style={{ fontSize: '10px' }}>
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
              <p className="text-center text-gray-400 text-sm py-10">Nenhum pagamento encontrado.</p>
            )}
            {pagamentos.length > 0 && (
              <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: '#F5F5F0' }}>
                <p className="text-xs text-gray-400">{pagamentos.length} registo{pagamentos.length !== 1 ? 's' : ''}</p>
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

// ─── TAB: CICLOS ─────────────────────────────────────────────────────────────
function TabCiclos({ onRefresh }: { onRefresh: () => void }) {
  const [ciclos, setCiclos] = useState<any[]>([])
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
          style={{ backgroundColor: msg.startsWith('Erro') ? '#fee2e2' : '#1D9E7515', color: msg.startsWith('Erro') ? '#dc2626' : '#1D9E75' }}>
          {msg}
          <button onClick={() => setMsg('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={novoCiclo} disabled={criando}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white text-sm transition-all"
          style={{ backgroundColor: '#003399' }}>
          {criando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Novo Ciclo
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-gray-300" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--background)' }}>
                  {['Estado', 'Acumulado', 'Meta', 'Inscritos', 'Mínimo', 'Criado', 'Concluído', 'Alterar Estado'].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ciclos.map(c => (
                  <tr key={c.id} className="border-t hover:bg-gray-50" style={{ borderColor: '#F5F5F0' }}>
                    <td className="py-3 px-4"><StatusBadge status={c.estado} /></td>
                    <td className="py-3 px-4 font-bold" style={{ color: '#EF9F27' }}>{formatMT(c.total_acumulado)}</td>
                    <td className="py-3 px-4">{formatMT(c.meta)}</td>
                    <td className="py-3 px-4 font-bold" style={{ color: '#003399' }}>{c.participantes_count}</td>
                    <td className="py-3 px-4 text-gray-400">{c.minimo_participantes}</td>
                    <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">{formatDate(c.created_at)}</td>
                    <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">{formatDate(c.concluido_at)}</td>
                    <td className="py-3 px-4">
                      <select
                        value={c.estado}
                        onChange={e => alterarEstado(c.id, e.target.value)}
                        disabled={loadingId === c.id}
                        className="text-xs border rounded-lg px-2 py-1.5 outline-none"
                        style={{ borderColor: '#e5e7eb' }}
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
function TabSorteio({ stats, onRefresh }: { stats: any; onRefresh: () => void }) {
  const [realizando, setRealizando] = useState(false)
  const [resultado, setResultado] = useState<{ nome: string; email: string } | null>(null)
  const [erro, setErro] = useState('')
  const [historico, setHistorico] = useState<any[]>([])
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
      setResultado({ nome: res.winnerNome!, email: res.winnerEmail! })
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
        <h2 className="font-black mb-4" style={{ color: '#003399' }}>Condições para o Sorteio</h2>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: 'Estado do ciclo', value: <StatusBadge status={ciclo?.estado ?? '—'} />, ok: ciclo?.estado === 'activo' },
            { label: 'Participantes', value: `${ciclo?.participantes_count ?? 0} / ${ciclo?.minimo_participantes ?? 150}`, ok: (ciclo?.participantes_count ?? 0) >= (ciclo?.minimo_participantes ?? 150) },
            { label: 'Fundo acumulado', value: formatMT(ciclo?.total_acumulado ?? 0), ok: (ciclo?.total_acumulado ?? 0) >= 300000 },
            { label: 'Alvo real necessário', value: formatMT(300000), ok: true },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: c.ok ? '#1D9E7510' : '#F5F5F0' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: c.ok ? '#1D9E75' : '#ddd' }}>
                {c.ok ? <Check className="w-3.5 h-3.5 text-white" /> : <X className="w-3.5 h-3.5 text-white" />}
              </div>
              <div>
                <p className="text-xs text-gray-400">{c.label}</p>
                <div className="font-bold text-sm">{c.value}</div>
              </div>
            </div>
          ))}
        </div>

        {resultado && (
          <div className="mb-4 p-4 rounded-2xl text-center" style={{ backgroundColor: '#1D9E7515', border: '2px solid #1D9E7530' }}>
            <Trophy className="w-8 h-8 mx-auto mb-2" style={{ color: '#EF9F27' }} />
            <p className="font-black text-lg" style={{ color: '#1D9E75' }}>Vencedor Seleccionado!</p>
            <p className="font-bold text-xl mt-1">{resultado.nome}</p>
            <p className="text-sm text-gray-400">{resultado.email}</p>
          </div>
        )}

        {erro && (
          <div className="mb-4 p-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100">{erro}</div>
        )}

        <button
          onClick={() => setConfirm(true)}
          disabled={realizando || !canSorteio}
          className="w-full py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all disabled:opacity-40"
          style={{ backgroundColor: '#EF9F27', color: '#003399' }}
        >
          {realizando
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> A realizar sorteio...</>
            : <><Trophy className="w-4 h-4" /> Seleccionar Vencedor</>}
        </button>
        {!canSorteio && (
          <p className="text-xs text-center text-gray-400 mt-2">
            O ciclo precisa de estar em estado <strong>Activo</strong> para realizar o sorteio.
          </p>
        )}
      </div>

      {/* Histórico */}
      {historico.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 pb-3">
            <h2 className="font-black" style={{ color: '#003399' }}>Histórico de Sorteios</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--background)' }}>
                  {['Vencedor', 'Email', 'Prémio', 'Fundo Total', 'Data'].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-bold text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historico.map(s => (
                  <tr key={s.id} className="border-t hover:bg-gray-50" style={{ borderColor: '#F5F5F0' }}>
                    <td className="py-3 px-4 font-bold">{s.vencedor?.nome ?? '—'}</td>
                    <td className="py-3 px-4 text-gray-400 text-xs">{s.vencedor?.email ?? '—'}</td>
                    <td className="py-3 px-4 font-bold" style={{ color: '#EF9F27' }}>{formatMT(s.premio)}</td>
                    <td className="py-3 px-4">{formatMT(s.ciclo?.total_acumulado)}</td>
                    <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">{formatDate(s.realizado_at)}</td>
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
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('dashboard')
  const router = useRouter()

  const loadStats = useCallback(async () => {
    setLoading(true)
    const data = await getAdminStats()
    setStats(data)
    setLoading(false)
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const handleLogout = async () => {
    await logoutAdmin()
    router.push('/')
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard',     label: 'Dashboard',     icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'participantes', label: 'Participantes',  icon: <Users className="w-4 h-4" />, badge: stats?.totalParticipantes },
    { id: 'pagamentos',    label: 'Pagamentos',     icon: <CreditCard className="w-4 h-4" />, badge: stats?.pagamentosPendentes || undefined },
    { id: 'ciclos',        label: 'Ciclos',         icon: <RefreshCw className="w-4 h-4" /> },
    { id: 'sorteio',       label: 'Sorteio',        icon: <Trophy className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <header className="bg-white sticky top-0 z-40" style={{ borderBottom: '3px solid #003399' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </a>
            <div>
              <p className="font-black text-base" style={{ color: '#003399' }}>SonhoEuropa · Admin</p>
              <p className="text-xs text-gray-400">Painel de Gestão</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadStats} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Actualizar">
              <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">
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
                borderColor: tab === t.id ? '#003399' : 'transparent',
                color: tab === t.id ? '#003399' : '#888',
              }}>
              {t.icon}
              {t.label}
              {!!t.badge && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-white text-xs font-black"
                  style={{ backgroundColor: t.id === 'pagamentos' ? '#EF9F27' : '#003399', fontSize: '10px' }}>
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
              style={{ borderColor: '#003399', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {tab === 'dashboard'     && <TabDashboard stats={stats} />}
            {tab === 'participantes' && <TabParticipantes participantes={stats?.participantes ?? []} onRefresh={loadStats} />}
            {tab === 'pagamentos'    && <TabPagamentos />}
            {tab === 'ciclos'        && <TabCiclos onRefresh={loadStats} />}
            {tab === 'sorteio'       && <TabSorteio stats={stats} onRefresh={loadStats} />}
          </>
        )}
      </div>
    </div>
  )
}
