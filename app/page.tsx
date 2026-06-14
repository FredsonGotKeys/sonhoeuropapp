'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Users, Trophy, ArrowRight, ChevronDown, Shield, Zap, Heart, TrendingUp, Star, MapPin, Plane, Flame, Share2 } from 'lucide-react'
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

  const progress = ciclo ? Math.min((ciclo.total_acumulado / ciclo.meta) * 100, 100) : 0
  const formatMT = (v: number) => `${v.toLocaleString('pt-PT')} MT`

  const faqs = [
    {
      q: 'É seguro? Como sei que o prémio será pago?',
      a: 'O sorteio é realizado ao vivo no Instagram e YouTube, com o resultado registado em tempo real na plataforma. O fundo acumulado é visível por todos. O vencedor recebe directamente via M-Pesa ou conta bancária.',
    },
    {
      q: 'Posso perder o dinheiro que depositei?',
      a: 'Os depósitos após o arranque do ciclo não são reembolsáveis. No entanto, os teus pontos nunca se perdem — passam para o ciclo seguinte como vantagem, aumentando as tuas hipóteses futuras.',
    },
    {
      q: 'Como funciona o sorteio ponderado?',
      a: 'Cada ponto que acumulas representa uma "entrada" no sorteio. Quem deposita mais tem mais pontos e, portanto, mais hipóteses de ganhar. O sorteio é automático e verificável.',
    },
    {
      q: 'O que é a taxa de inscrição de 150 MT?',
      a: 'É uma taxa única de 200 MT por ciclo que cobre os custos operacionais da plataforma. Não entra no fundo do prémio. Só é cobrada uma vez por ciclo — os depósitos diários são separados.',
    },
    {
      q: 'Quais métodos de pagamento estão disponíveis?',
      a: 'Podes pagar via M-Pesa (846283051) ou E-Mola (876252006). Fazes a transferencia e envias o comprovativo na plataforma.',
    },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F5F0' }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b" style={{ borderColor: '#e5e7eb' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/logo.avif"
              alt="SonhoEuropa"
              width={36}
              height={36}
              className="rounded-xl w-8 h-8 sm:w-9 sm:h-9"
            />
            <span className="font-black text-lg tracking-tight" style={{ color: '#003399' }}>SonhoEuropa</span>
          </div>

          <div className="flex items-center gap-2">
            {authUser ? (
              <>
                <span className="text-xs text-gray-400 hidden sm:block">
                  Olá, <strong className="text-gray-600">{authUser.nome?.split(' ')[0]}</strong>
                </span>
                <Link
                  href="/dashboard"
                  className="px-4 py-1.5 text-sm font-black text-white rounded-lg transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#003399' }}
                >
                  Dashboard →
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3 sm:px-4 py-1.5 text-sm font-semibold rounded-lg border-2 transition-colors hover:bg-gray-50"
                  style={{ borderColor: '#003399', color: '#003399' }}
                >
                  Entrar
                </Link>
                <Link
                  href="/register"
                  className="px-3 sm:px-4 py-1.5 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#003399' }}
                >
                  Criar conta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-16 overflow-hidden" style={{ minHeight: '100vh' }}>
        {/* Hero background image */}
        <div className="absolute inset-0">
          <Image
            src="/images/hero1.avif"
            alt=""
            fill
            className="object-cover"
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(160deg, rgba(0,31,107,0.92) 0%, rgba(0,51,153,0.88) 40%, rgba(10,79,160,0.85) 70%, rgba(29,158,117,0.8) 100%)',
            }}
          />
        </div>

        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'radial-gradient(circle at 25% 50%, white 1px, transparent 1px), radial-gradient(circle at 75% 20%, white 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 text-center text-white" style={{ minHeight: 'calc(100vh - 64px)' }}>
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6 sm:mb-8"
            style={{
              backgroundColor: 'rgba(239,159,39,0.2)',
              border: '1px solid rgba(239,159,39,0.5)',
              color: '#EF9F27',
            }}
          >
            <MapPin className="w-3 h-3" />
            Maputo, Moçambique
            <span className="opacity-50 mx-0.5">·</span>
            <Plane className="w-3 h-3" />
            rumo à Europa
          </div>

          {/* Logo */}
          <Image
            src="/images/logo.avif"
            alt="SonhoEuropa"
            width={80}
            height={80}
            className="rounded-2xl mb-6 w-16 h-16 sm:w-20 sm:h-20 shadow-2xl"
          />

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-4 tracking-tight leading-none">
            Sonho<span style={{ color: '#EF9F27' }}>Europa</span>
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl font-light mb-2 opacity-95 max-w-md lg:max-w-lg mx-auto leading-snug">
            O teu sonho começa com{' '}
            <span className="font-bold" style={{ color: '#EF9F27' }}>20 meticais por dia</span>
          </p>

          <p className="text-sm sm:text-base opacity-60 max-w-xs sm:max-w-sm mx-auto mb-8 sm:mb-12 leading-relaxed">
            Deposita, acumula pontos e concorre a um prémio de <strong className="opacity-90">150 000 MT</strong>.
            Sorteio ao vivo quando o fundo estiver cheio.
          </p>

          {/* Live Fund Card */}
          <div
            className="w-full max-w-xs sm:max-w-sm mx-auto rounded-2xl p-5 sm:p-6 mb-8 text-left"
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold opacity-60 uppercase tracking-widest">Fundo Actual</span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: '#4ade80' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                Tempo real
              </span>
            </div>

            <div className="text-2xl sm:text-3xl font-black mb-4" style={{ color: '#EF9F27' }}>
              {loading ? (
                <span className="inline-block w-32 h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
              ) : formatMT(ciclo?.total_acumulado ?? 0)}
            </div>

            <div className="mb-1.5">
              <div className="flex justify-between text-xs opacity-50 mb-1.5">
                <span>0 MT</span>
                <span className="font-semibold" style={{ color: '#EF9F27', opacity: 1 }}>
                  {progress.toFixed(1)}%
                </span>
                <span>150 000 MT</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700 relative"
                  style={{ width: `${progress || 2}%`, background: 'linear-gradient(90deg, #EF9F27, #f5c056)' }}
                >
                  <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(90deg, transparent 70%, rgba(255,255,255,0.3))' }} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4 pt-4 border-t text-sm" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="flex items-center gap-1.5 opacity-80">
                <Users className="w-3.5 h-3.5" />
                <span><strong>{ciclo?.participantes_count ?? 0}</strong> participantes</span>
              </div>
              <span className="opacity-30">•</span>
              <span className="opacity-50 text-xs">
                mín. <strong>{ciclo?.minimo_participantes ?? 150}</strong> para arrancar
              </span>
            </div>
          </div>

          {authUser ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-black text-sm sm:text-base transition-all active:scale-95 hover:scale-105 shadow-lg"
              style={{ backgroundColor: '#EF9F27', color: '#001f6b', boxShadow: '0 8px 30px rgba(239,159,39,0.4)' }}
            >
              Ir para o meu Dashboard <ArrowRight className="w-5 h-5" />
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="inline-flex items-center gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-black text-sm sm:text-base transition-all active:scale-95 hover:scale-105 shadow-lg"
                style={{ backgroundColor: '#EF9F27', color: '#001f6b', boxShadow: '0 8px 30px rgba(239,159,39,0.4)' }}
              >
                Quero Participar <ArrowRight className="w-5 h-5" />
              </Link>
              <p className="mt-4 text-sm opacity-40">
                Já tens conta?{' '}
                <Link href="/login" className="underline opacity-70 hover:opacity-100">Entrar aqui</Link>
              </p>
            </>
          )}

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce opacity-40">
            <ChevronDown className="w-5 h-5" />
          </div>
        </div>

        {/* Wave */}
        <div style={{ height: 60, overflow: 'hidden', marginTop: -1 }}>
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block', fill: '#F5F5F0' }}>
            <path d="M0,30 C360,60 720,0 1080,30 C1260,45 1380,20 1440,30 L1440,60 L0,60 Z" />
          </svg>
        </div>
      </section>

      {/* Stats banner */}
      <section className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {[
              { value: '150 000 MT', label: 'Prémio em dinheiro', color: '#EF9F27' },
              { value: '20 MT', label: 'Depósito mínimo diário', color: '#1D9E75' },
              { value: '100%', label: 'Sorteio ao vivo', color: '#003399' },
            ].map((s) => (
              <div key={s.label} className="text-center bg-white rounded-2xl p-3 sm:p-5 shadow-sm">
                <p className="text-base sm:text-2xl lg:text-3xl font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Image showcase */}
      <section className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              { src: '/images/hero2.jpg', alt: 'Comunidade SonhoEuropa' },
              { src: '/images/hero3.png', alt: 'Sonho Europeu' },
              { src: '/images/hero4.jpg', alt: 'Oportunidades na Europa' },
              { src: '/images/hero1.avif', alt: 'O teu futuro' },
            ].map((img) => (
              <div key={img.src} className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-md">
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  className="object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-2" style={{ color: '#003399' }}>Como funciona?</h2>
            <p className="text-gray-400 text-sm">Três passos simples para concorreres ao teu sonho</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                num: '1',
                icon: <Users className="w-5 h-5" />,
                color: '#003399',
                title: 'Regista-te',
                desc: 'Cria a tua conta com email e senha. Usa o código de convite de um amigo e ganha 50 pontos bónus.',
              },
              {
                num: '2',
                icon: <TrendingUp className="w-5 h-5" />,
                color: '#1D9E75',
                title: 'Deposita diariamente',
                desc: 'Cada 10 MT depositados = 1 ponto. Mais pontos = mais hipóteses de ganhar no sorteio ponderado.',
              },
              {
                num: '3',
                icon: <Trophy className="w-5 h-5" />,
                color: '#EF9F27',
                title: 'Concorre ao prémio',
                desc: 'Com 150+ participantes e 150 000 MT no fundo, fazemos o sorteio ao vivo no Instagram e YouTube.',
              },
            ].map((step) => (
              <div key={step.num} className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
                <div
                  className="absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-5"
                  style={{ backgroundColor: step.color }}
                />
                <div
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-md"
                  style={{ backgroundColor: step.color }}
                >
                  {step.icon}
                </div>
                <h3 className="font-black text-sm sm:text-base mb-2 text-center" style={{ color: step.color }}>
                  {step.title}
                </h3>
                <p className="text-gray-400 text-xs sm:text-sm leading-relaxed text-center">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why SonhoEuropa */}
      <section className="py-10 sm:py-14 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: 'white' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-2" style={{ color: '#003399' }}>Por que SonhoEuropa?</h2>
            <p className="text-gray-400 text-sm">O que nos torna diferentes</p>
          </div>

          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <Shield className="w-5 h-5" />,
                color: '#003399',
                title: '100% transparente',
                desc: 'Fundo visível em tempo real para todos. Sorteio ao vivo no Instagram e YouTube.',
              },
              {
                icon: <Zap className="w-5 h-5" />,
                color: '#EF9F27',
                title: 'Acessível a todos',
                desc: 'Começa com apenas 20 MT por dia — menos do que um chá.',
              },
              {
                icon: <TrendingUp className="w-5 h-5" />,
                color: '#1D9E75',
                title: 'Convida e ganha',
                desc: 'Cada amigo que convidas vale 50 pontos. E 10% dos pontos dele são teus.',
              },
              {
                icon: <Heart className="w-5 h-5" />,
                color: '#e74c3c',
                title: 'Nunca perdes tudo',
                desc: 'Os teus pontos passam para o próximo ciclo como vantagem.',
              },
              {
                icon: <Star className="w-5 h-5" />,
                color: '#7c3aed',
                title: 'Dinheiro real',
                desc: '150 000 MT directamente na tua M-Pesa ou conta bancária.',
              },
              {
                icon: <Users className="w-5 h-5" />,
                color: '#003399',
                title: 'Paga com M-Pesa',
                desc: 'Sem banco, sem cartão. M-Pesa ou E-Mola — simples e seguro.',
              },
            ].map((f) => (
              <div key={f.title} className="flex gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl" style={{ backgroundColor: '#F5F5F0' }}>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: f.color + '15', color: f.color }}
                >
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-bold text-sm mb-1" style={{ color: '#1A1A2E' }}>{f.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Prize Banner with hero image */}
      <section className="py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
        <div
          className="max-w-5xl mx-auto rounded-3xl p-6 sm:p-10 lg:p-14 text-white overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #001f6b 0%, #003399 50%, #0055cc 100%)' }}
        >
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-10" style={{ backgroundColor: '#EF9F27' }} />
          <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full opacity-10" style={{ backgroundColor: '#1D9E75' }} />

          <div className="relative flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 text-center md:text-left">
              <div
                className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl mb-4"
                style={{ backgroundColor: 'rgba(239,159,39,0.2)', border: '2px solid rgba(239,159,39,0.4)' }}
              >
                <Trophy className="w-7 h-7 sm:w-8 sm:h-8" style={{ color: '#EF9F27' }} />
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mb-2">
                Prémio de <span style={{ color: '#EF9F27' }}>150 000 MT</span>
              </h2>
              <p className="opacity-50 text-sm mb-2">≈ 2 300 euros · Entregue directamente ao vencedor</p>
              <p className="opacity-60 text-sm mb-6 sm:mb-8 max-w-sm mx-auto md:mx-0 leading-relaxed">
                Sorteio ponderado pelos teus pontos — mais depositas, mais hipóteses tens.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-2xl font-black text-sm sm:text-base transition-all hover:scale-105 active:scale-95 shadow-lg"
                style={{ backgroundColor: '#EF9F27', color: '#001f6b', boxShadow: '0 6px 20px rgba(239,159,39,0.4)' }}
              >
                Começar Agora <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="relative w-full md:w-64 lg:w-80 aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl flex-shrink-0">
              <Image
                src="/images/hero3.png"
                alt="O sonho europeu"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Points System */}
      <section className="py-10 sm:py-14 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: 'white' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-black mb-2" style={{ color: '#003399' }}>Sistema de Pontos</h2>
            <p className="text-gray-400 text-sm">Ganha pontos de várias formas</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 max-w-2xl mx-auto">
            {[
              { icon: <TrendingUp className="w-3.5 h-3.5" />, action: '10 MT depositados', pts: '1 ponto', color: '#003399' },
              { icon: <Users className="w-3.5 h-3.5" />, action: 'Convite aceite', pts: '+50 pontos', color: '#1D9E75' },
              { icon: <Flame className="w-3.5 h-3.5" />, action: '7 dias consecutivos', pts: '+20% bónus', color: '#EF9F27' },
              { icon: <Share2 className="w-3.5 h-3.5" />, action: 'Partilha verificada', pts: '+100 pontos', color: '#7c3aed' },
            ].map((p) => (
              <div key={p.action} className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl border-2" style={{ borderColor: '#F5F5F0' }}>
                <div className="flex items-center gap-2.5">
                  <span style={{ color: p.color }}>{p.icon}</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-600">{p.action}</span>
                </div>
                <span className="text-xs sm:text-sm font-black" style={{ color: p.color }}>{p.pts}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-black mb-2" style={{ color: '#003399' }}>Perguntas Frequentes</h2>
            <p className="text-gray-400 text-sm">Tens dúvidas? Aqui estão as respostas.</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left"
                >
                  <span className="font-semibold text-xs sm:text-sm pr-4" style={{ color: '#1A1A2E' }}>{faq.q}</span>
                  <ChevronDown
                    className="w-4 h-4 flex-shrink-0 transition-transform duration-200"
                    style={{
                      color: '#003399',
                      transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-10 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-sm mx-auto">
          {authUser ? (
            <>
              <p className="text-xl sm:text-2xl font-black mb-2" style={{ color: '#003399' }}>
                Bem-vindo de volta, {authUser.nome?.split(' ')[0]}!
              </p>
              <p className="text-gray-400 text-sm mb-6">O teu Dashboard está à espera de ti.</p>
              <Link
                href="/dashboard"
                className="block w-full py-3.5 sm:py-4 rounded-2xl font-black text-white text-sm sm:text-base transition-all hover:opacity-90 active:scale-95 shadow-lg"
                style={{ backgroundColor: '#003399', boxShadow: '0 6px 20px rgba(0,51,153,0.3)' }}
              >
                Ir para o Dashboard →
              </Link>
            </>
          ) : (
            <>
              <p className="text-xl sm:text-2xl font-black mb-2" style={{ color: '#003399' }}>Pronto para sonhar?</p>
              <p className="text-gray-400 text-sm mb-6">Começa hoje com 20 MT. O sorteio espera por ti.</p>
              <Link
                href="/register"
                className="block w-full py-3.5 sm:py-4 rounded-2xl font-black text-white text-sm sm:text-base transition-all hover:opacity-90 active:scale-95 shadow-lg"
                style={{ backgroundColor: '#003399', boxShadow: '0 6px 20px rgba(0,51,153,0.3)' }}
              >
                Criar conta grátis →
              </Link>
              <p className="text-xs text-gray-400 mt-3">Sem custos ocultos · Paga apenas quando quiseres depositar</p>
              <p className="text-xs text-gray-300 mt-2">
                Já tens conta?{' '}
                <Link href="/login" className="underline" style={{ color: '#003399' }}>Entrar aqui</Link>
              </p>
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 sm:px-6 lg:px-8 pt-10 pb-6 mt-4" style={{ backgroundColor: '#1A1A2E' }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <Image
                  src="/images/logo.avif"
                  alt="SonhoEuropa"
                  width={32}
                  height={32}
                  className="rounded-xl"
                />
                <span className="font-black text-lg" style={{ color: '#EF9F27' }}>SonhoEuropa</span>
              </div>
              <p className="text-xs text-gray-600 max-w-xs leading-relaxed">
                Fundo comunitário digital. Deposita, acumula pontos e concorre a 150 000 MT.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-xs">
              <div>
                <p className="text-gray-500 font-bold uppercase tracking-widest mb-2">Plataforma</p>
                <div className="space-y-1.5">
                  <Link href="/register" className="block text-gray-400 hover:text-white transition-colors">Criar conta</Link>
                  <Link href="/login" className="block text-gray-400 hover:text-white transition-colors">Entrar</Link>
                  {authUser && (
                    <Link href="/dashboard" className="block transition-colors" style={{ color: '#EF9F27' }}>Dashboard →</Link>
                  )}
                </div>
              </div>
              <div>
                <p className="text-gray-500 font-bold uppercase tracking-widest mb-2">Informacoes</p>
                <div className="space-y-1.5">
                  <Link href="/contacto" className="block text-gray-400 hover:text-white transition-colors">Contacto e Suporte</Link>
                  <Link href="/privacidade" className="block text-gray-400 hover:text-white transition-colors">Politica de Privacidade</Link>
                  <Link href="/admin/login" className="block text-gray-400 hover:text-white transition-colors">Area Administrativa</Link>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-xs text-gray-700">© {new Date().getFullYear()} SonhoEuropa · Maputo, Moçambique</p>
              <div className="flex gap-3 text-xs text-gray-700">
                <Link href="/privacidade" className="hover:text-gray-400 transition-colors">Privacidade</Link>
                <span>·</span>
                <Link href="/contacto" className="hover:text-gray-400 transition-colors">Contacto</Link>
                <span>·</span>
                <span>M-Pesa · E-Mola</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* PWA Install Banner */}
      {showInstall && (
        <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto">
          <button
            onClick={handleInstall}
            className="w-full py-3.5 rounded-2xl font-bold text-white shadow-2xl flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #1D9E75, #0d8060)', boxShadow: '0 8px 30px rgba(29,158,117,0.5)' }}
          >
            Instalar App SonhoEuropa no telemóvel
          </button>
        </div>
      )}
    </div>
  )
}
