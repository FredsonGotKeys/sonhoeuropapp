'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Users, Trophy, ArrowRight, ChevronDown, Shield, Zap, Heart, TrendingUp, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface CicloData {
  id: string
  total_acumulado: number
  meta: number
  participantes_count: number
  estado: string
  minimo_participantes: number
}

export default function LandingPage() {
  const [ciclo, setCiclo] = useState<CicloData | null>(null)
  const [loading, setLoading] = useState(true)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [authUser, setAuthUser] = useState<{ nome?: string } | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('usuarios').select('nome').eq('id', user.id).maybeSingle()
      setAuthUser({ nome: data?.nome })
    })
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const fetchCiclo = async () => {
      const { data } = await supabase
        .from('ciclos')
        .select('*')
        .neq('estado', 'concluido')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setCiclo(data)
      setLoading(false)
    }
    fetchCiclo()
    const channel = supabase
      .channel('landing-ciclo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ciclos' }, (payload) => {
        if (payload.eventType !== 'DELETE') setCiclo(payload.new as CicloData)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setShowInstall(false)
    setDeferredPrompt(null)
  }

  const valorVisivel = ciclo ? Math.round(ciclo.total_acumulado * ((ciclo.meta ?? 200000) / 300000)) : 0
  const progress = ciclo ? Math.min((ciclo.total_acumulado / 300000) * 100, 100) : 0
  const formatMT = (v: number) => v.toLocaleString('pt-PT')

  const faqs = [
    {
      q: 'É seguro? Quem fica com o dinheiro até ao sorteio?',
      a: 'A plataforma é gerida por Fredson Bernardo Muianga, residente em Maputo, que recebe directamente todas as contribuições via E-Mola. O fundo acumulado é visível para todos em tempo real. Quando atinge o valor necessário, o sistema selecciona automaticamente o vencedor, que recebe o prémio directamente via M-Pesa ou conta bancária.',
    },
    {
      q: 'Posso perder o dinheiro que depositei?',
      a: 'Os depósitos não são reembolsáveis após o arranque do ciclo. Pensa nisto como uma contribuição para o fundo comunitário — estás a ajudar a construir o prémio enquanto concorres a ganhá-lo.',
    },
    {
      q: 'Como é escolhido o vencedor? É por ordem de chegada?',
      a: 'Não é por ordem nem por quem depositou primeiro — é um sorteio aleatório ponderado. Todos os que já depositaram entram no sorteio, e quanto mais depositares, mais bilhetes tens nesse sorteio e maiores são as tuas chances. O sistema escolhe o vencedor ao acaso entre todos esses bilhetes, por isso qualquer participante pode ganhar — só que quem contribui mais tem mais probabilidade.',
    },
    {
      q: 'Quais métodos de pagamento?',
      a: 'Só por E-Mola, para o número 876 252 006 (Fredson Bernardo Muianga). Fazes a transferência e envias o comprovativo na plataforma — a contribuição só é contabilizada, e só aumenta as tuas chances no sorteio, depois de confirmada manualmente pelo administrador.',
    },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ─── Nav ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="container-wide flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/images/logo.avif" alt="SonhoEuropa" width={28} height={28} className="rounded-lg" />
            <span className="font-extrabold text-base tracking-tight" style={{ color: 'var(--midnight)' }}>
              Sonho<span style={{ color: 'var(--cobalt)' }}>Europa</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {authUser ? (
              <>
                <span className="text-xs hide-mobile" style={{ color: 'var(--fg-muted)' }}>
                  {authUser.nome?.split(' ')[0]}
                </span>
                <Link href="/dashboard" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13 }}>
                  Dashboard <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 13 }}>
                  Entrar
                </Link>
                <Link href="/register" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13 }}>
                  Criar conta
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden grain" style={{ background: 'var(--bg-dark)', paddingTop: 56 }}>
        <div className="absolute inset-0">
          <Image src="/images/hero1.avif" alt="" fill className="object-cover" priority style={{ opacity: 0.15 }} />
        </div>

        <div className="relative container-wide">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16 py-16 sm:py-20 lg:py-28">

            {/* Left — Copy */}
            <div className="flex-1 text-center lg:text-left">
              <h1
                className="t-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white mb-5 animate-enter-up delay-1"
              >
                O teu sonho começa<br className="hide-mobile" /> com{' '}
                <span style={{ color: 'var(--amber)' }}>100 MT</span> por dia
              </h1>

              <p className="text-base sm:text-lg mb-8 animate-enter-up delay-2" style={{ color: 'rgba(255,255,255,0.55)', maxWidth: 480 }}>
                Deposita a partir de 100 MT, acompanha o fundo a crescer e concorre a um prémio de 200 000 MT.
                Quando o fundo estiver cheio, o sistema escolhe o vencedor.
              </p>

              <div className="flex items-center gap-3 justify-center lg:justify-start animate-enter-up delay-3">
                {authUser ? (
                  <Link href="/dashboard" className="btn btn-amber btn-lg">
                    Ir ao Dashboard <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <>
                    <Link href="/register" className="btn btn-amber btn-lg">
                      Quero Participar <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      href="/login"
                      className="btn btn-lg"
                      style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'white' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
                    >
                      Entrar
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Right — Fund Card */}
            <div className="w-full max-w-sm lg:max-w-xs xl:max-w-sm animate-enter-up delay-4">
              <div
                className="p-6 sm:p-7 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.7)' }}>Fundo actual</span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--emerald)' }}>
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ background: 'var(--emerald)', animation: 'pulse-dot 2s ease-in-out infinite', boxShadow: '0 0 6px var(--emerald)' }}
                    />
                    Ao vivo
                  </span>
                </div>

                <div className="t-mono text-4xl sm:text-5xl font-black text-white mb-1 tracking-tight">
                  {loading ? (
                    <span className="skeleton inline-block w-40 h-12 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)' }} />
                  ) : (
                    <>{formatMT(valorVisivel)}<span className="text-lg font-bold ml-2" style={{ color: 'rgba(255,255,255,0.5)' }}>MT</span></>
                  )}
                </div>
                <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  de {formatMT(ciclo?.meta ?? 200000)} MT necessários
                </p>

                <div className="mb-5">
                  <div className="flex justify-between text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    <span className="t-mono">{progress.toFixed(1)}%</span>
                    <span className="t-mono">{formatMT(ciclo?.meta ?? 200000)}</span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)', height: 8 }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max(progress, 2)}%`,
                        background: 'linear-gradient(90deg, var(--amber), var(--amber-light))',
                        boxShadow: '0 0 12px rgba(245,158,11,0.4)',
                      }}
                    />
                  </div>
                </div>

                <div
                  className="flex items-center justify-between p-3 rounded-lg text-sm"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    <Users className="w-4 h-4" />
                    <span><strong className="text-white t-mono">{ciclo?.participantes_count ?? 0}</strong> participantes</span>
                  </div>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    mín. <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{ciclo?.minimo_participantes ?? 150}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="py-10 sm:py-14" style={{ background: 'var(--bg-alt)' }}>
        <div className="container-wide">
          <div className="grid grid-cols-3 gap-3 sm:gap-6">
            {[
              { value: '200 000', unit: 'MT', label: 'Prémio em dinheiro', color: 'var(--amber)' },
              { value: '100', unit: 'MT/dia', label: 'Depósito mínimo', color: 'var(--cobalt)' },
              { value: '+ dep.', unit: '', label: 'Mais chances', color: 'var(--emerald)' },
            ].map((s) => (
              <div key={s.label} className="text-center py-4 sm:py-6">
                <p className="t-mono text-xl sm:text-3xl lg:text-4xl font-black" style={{ color: s.color }}>
                  {s.value}{s.unit && <span className="text-xs sm:text-sm font-semibold opacity-50 ml-1">{s.unit}</span>}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="py-14 sm:py-20">
        <div className="container-wide">
          <div className="text-center mb-10 sm:mb-14">
            <p className="t-label mb-2" style={{ color: 'var(--cobalt)' }}>Como funciona</p>
            <h2 className="t-heading text-2xl sm:text-3xl" style={{ color: 'var(--fg)' }}>
              Três passos para o teu sonho
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                num: '01',
                icon: <Users className="w-5 h-5" />,
                title: 'Regista-te',
                desc: 'Cria a tua conta gratuitamente em menos de 1 minuto. Só precisas de email e senha.',
                details: [
                  'Recebeste um código de convite de um amigo? Usa-o no registo e ambos ganham vantagens.',
                  'Sem taxas — a conta é totalmente gratuita.',
                  'Assim que fizeres o primeiro depósito, estás oficialmente a concorrer ao prémio de 200 000 MT.',
                ],
                cta: 'Criar conta agora',
                href: '/register',
                color: 'var(--cobalt)',
              },
              {
                num: '02',
                icon: <TrendingUp className="w-5 h-5" />,
                title: 'Deposita',
                desc: 'Cada depósito teu ajuda o fundo a crescer. Acompanha o progresso em tempo real.',
                details: [
                  'A partir de 100 MT por dia — menos do que um café. Deposita o que puderes, quando puderes.',
                  'Paga via E-Mola directamente do telemóvel. Rápido, simples e seguro.',
                  'O fundo é visível para todos. Vês exactamente quanto falta para o prémio ser atribuído.',
                ],
                cta: 'Começar a depositar',
                href: '/register',
                color: 'var(--emerald)',
              },
              {
                num: '03',
                icon: <Trophy className="w-5 h-5" />,
                title: 'Ganha o prémio',
                desc: 'Quando o fundo atinge o valor necessário, o sistema faz um sorteio aleatório — não é por ordem de chegada. Quanto mais depositares, mais bilhetes tens no sorteio e maiores as tuas chances.',
                details: [
                  'Todos os que já depositaram são elegíveis — qualquer um pode ser o escolhido.',
                  'É um sorteio aleatório: o sistema escolhe ao acaso, dando mais bilhetes a quem depositou mais.',
                  'O vencedor recebe 200 000 MT directamente na M-Pesa ou conta bancária. Sem atrasos.',
                ],
                cta: 'Quero participar',
                href: '/register',
                color: 'var(--amber)',
              },
            ].map((step) => (
              <Link
                key={step.num}
                href={step.href}
                className="card p-5 sm:p-6 relative overflow-hidden group block"
                style={{ transition: 'all 0.25s var(--ease)' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; e.currentTarget.style.borderColor = step.color; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <span className="t-mono text-xs font-bold absolute top-4 right-4" style={{ color: 'var(--fg-subtle)' }}>
                  {step.num}
                </span>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: step.color, color: 'white' }}
                >
                  {step.icon}
                </div>
                <h3 className="t-heading text-base mb-2" style={{ color: 'var(--fg)' }}>{step.title}</h3>
                <p className="text-sm font-medium leading-relaxed mb-4" style={{ color: 'var(--fg)' }}>{step.desc}</p>

                <ul className="space-y-2.5 mb-5">
                  {step.details.map((d, i) => (
                    <li key={i} className="flex gap-2.5 text-xs leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                        style={{ background: step.color }}
                      />
                      {d}
                    </li>
                  ))}
                </ul>

                <span
                  className="inline-flex items-center gap-1.5 text-xs font-bold group-hover:gap-2.5 transition-all"
                  style={{ color: step.color }}
                >
                  {step.cta} <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Images ─── */}
      <section className="pb-14 sm:pb-20">
        <div className="container-wide">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            {[
              { src: '/images/hero2.jpg', alt: 'Comunidade SonhoEuropa' },
              { src: '/images/hero3.png', alt: 'Sonho Europeu' },
              { src: '/images/hero4.jpg', alt: 'Oportunidades na Europa' },
              { src: '/images/hero1.avif', alt: 'O teu futuro' },
            ].map((img) => (
              <div key={img.src} className="relative aspect-[4/3] rounded-lg overflow-hidden">
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  className="object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Why ─── */}
      <section className="py-14 sm:py-20" style={{ background: 'var(--bg-alt)' }}>
        <div className="container-wide">
          <div className="text-center mb-10 sm:mb-14">
            <p className="t-label mb-2" style={{ color: 'var(--cobalt)' }}>Vantagens</p>
            <h2 className="t-heading text-2xl sm:text-3xl" style={{ color: 'var(--fg)' }}>
              Por que SonhoEuropa?
            </h2>
          </div>

          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: <Shield className="w-4 h-4" />, title: '100% transparente', desc: 'O fundo é visível em tempo real para todos. Sabes sempre quanto já foi acumulado.', color: 'var(--cobalt)' },
              { icon: <Zap className="w-4 h-4" />, title: 'Acessível a todos', desc: 'Começa com 100 MT por dia — menos do que um chá. Deposita o que puderes.', color: 'var(--amber)' },
              { icon: <TrendingUp className="w-4 h-4" />, title: 'Convida amigos', desc: 'Partilha o teu código de convite e cresce a comunidade junto com o fundo.', color: 'var(--emerald)' },
              { icon: <Heart className="w-4 h-4" />, title: 'Fundo comunitário', desc: 'Cada depósito contribui para o prémio de todos. Juntos construímos a oportunidade.', color: 'var(--red)' },
              { icon: <Star className="w-4 h-4" />, title: 'Dinheiro real', desc: '200 000 MT directamente na tua M-Pesa ou conta bancária.', color: 'var(--amber)' },
              { icon: <Users className="w-4 h-4" />, title: 'M-Pesa e E-Mola', desc: 'Sem banco, sem cartão. Pagamento móvel simples e seguro.', color: 'var(--cobalt)' },
            ].map((f) => (
              <div key={f.title} className="flex gap-3 p-4 rounded-lg" style={{ border: '1px solid var(--border)' }}>
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: `color-mix(in srgb, ${f.color} 10%, transparent)`, color: f.color }}
                >
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-bold text-sm mb-0.5" style={{ color: 'var(--fg)' }}>{f.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Prize Banner ─── */}
      <section className="py-14 sm:py-20">
        <div className="container-wide">
          <div
            className="rounded-xl overflow-hidden relative grain"
            style={{ background: 'var(--bg-dark)' }}
          >
            <div className="relative flex flex-col md:flex-row items-center gap-8 p-6 sm:p-10 lg:p-14">
              <div className="flex-1 text-center md:text-left">
                <p className="t-label mb-3" style={{ color: 'var(--amber)', opacity: 0.8 }}>Grande prémio</p>
                <h2 className="t-display text-3xl sm:text-4xl lg:text-5xl text-white mb-2">
                  <span className="t-mono" style={{ color: 'var(--amber)' }}>200 000</span>{' '}
                  <span className="text-lg sm:text-xl font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>MT</span>
                </h2>
                <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  ≈ 2 300 euros · O sistema escolhe o vencedor automaticamente
                </p>
                <Link href="/register" className="btn btn-amber btn-lg">
                  Começar Agora <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="relative w-full md:w-56 lg:w-72 aspect-[4/3] rounded-lg overflow-hidden flex-shrink-0">
                <Image src="/images/hero3.png" alt="O sonho europeu" fill className="object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="py-14 sm:py-20">
        <div className="container-tight">
          <div className="text-center mb-8">
            <p className="t-label mb-2" style={{ color: 'var(--cobalt)' }}>FAQ</p>
            <h2 className="t-heading text-2xl sm:text-3xl" style={{ color: 'var(--fg)' }}>Perguntas frequentes</h2>
          </div>

          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="font-semibold text-sm pr-4" style={{ color: 'var(--fg)' }}>{faq.q}</span>
                  <ChevronDown
                    className="w-4 h-4 flex-shrink-0 transition-transform duration-200"
                    style={{
                      color: 'var(--fg-subtle)',
                      transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-14 sm:py-20" style={{ background: 'var(--bg-alt)' }}>
        <div className="container-tight text-center">
          {authUser ? (
            <>
              <h2 className="t-heading text-2xl sm:text-3xl mb-2" style={{ color: 'var(--fg)' }}>
                Olá, {authUser.nome?.split(' ')[0]}
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>O teu Dashboard está à espera.</p>
              <Link href="/dashboard" className="btn btn-primary btn-lg">
                Ir para o Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          ) : (
            <>
              <h2 className="t-heading text-2xl sm:text-3xl mb-2" style={{ color: 'var(--fg)' }}>
                Pronto para sonhar?
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>
                Começa hoje com 100 MT. O fundo cresce todos os dias.
              </p>
              <Link href="/register" className="btn btn-primary btn-lg">
                Criar conta grátis <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-xs mt-4" style={{ color: 'var(--fg-subtle)' }}>
                Sem custos ocultos · Paga apenas quando quiseres depositar
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--fg-subtle)' }}>
                Já tens conta?{' '}
                <Link href="/login" className="underline" style={{ color: 'var(--cobalt)' }}>Entrar aqui</Link>
              </p>
            </>
          )}
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-10" style={{ background: 'var(--bg-dark)' }}>
        <div className="container-wide">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Image src="/images/logo.avif" alt="SonhoEuropa" width={24} height={24} className="rounded-md" />
                <span className="font-extrabold text-sm text-white">SonhoEuropa</span>
              </div>
              <p className="text-xs max-w-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Fundo comunitário digital. Deposita, acompanha o fundo e concorre a 200 000 MT.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-xs">
              <div>
                <p className="t-label mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>Plataforma</p>
                <div className="space-y-1.5">
                  <Link href="/register" className="block transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>Criar conta</Link>
                  <Link href="/login" className="block transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>Entrar</Link>
                  {authUser && (
                    <Link href="/dashboard" className="block transition-colors" style={{ color: 'var(--amber)' }}>Dashboard →</Link>
                  )}
                </div>
              </div>
              <div>
                <p className="t-label mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>Informações</p>
                <div className="space-y-1.5">
                  <Link href="/contacto" className="block transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>Contacto</Link>
                  <Link href="/privacidade" className="block transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>Privacidade</Link>
                  <Link href="/admin/login" className="block transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>Admin</Link>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                © {new Date().getFullYear()} SonhoEuropa · Maputo, Moçambique
              </p>
              <div className="flex gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                <Link href="/privacidade">Privacidade</Link>
                <span>·</span>
                <Link href="/contacto">Contacto</Link>
                <span>·</span>
                <span>M-Pesa · E-Mola</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── PWA Install ─── */}
      {showInstall && (
        <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto animate-enter-up">
          <button
            onClick={handleInstall}
            className="btn btn-primary btn-lg w-full"
            style={{ boxShadow: 'var(--shadow-xl)' }}
          >
            Instalar App SonhoEuropa
          </button>
        </div>
      )}
    </div>
  )
}
