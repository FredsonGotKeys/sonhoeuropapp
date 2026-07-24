'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Phone, Mail, MessageCircle, ArrowLeft, Clock, Shield, ArrowRight } from 'lucide-react'

export default function ContactoPage() {
  const whatsappUrl = 'https://wa.me/258846283051?text=' + encodeURIComponent('Ola, preciso de ajuda com o SonhoEuropa!')

  const channels = [
    {
      href: whatsappUrl,
      target: '_blank',
      icon: MessageCircle,
      color: 'var(--emerald)',
      title: 'WhatsApp',
      subtitle: '+258 84 628 3051',
      badge: 'Rápido',
    },
    {
      href: 'tel:+258846283051',
      icon: Phone,
      color: 'var(--cobalt)',
      title: 'Ligar',
      subtitle: '+258 84 628 3051',
    },
    {
      href: 'tel:+258876252006',
      icon: Phone,
      color: 'var(--cobalt)',
      title: 'Ligar (alternativo)',
      subtitle: '+258 87 625 2006',
    },
    {
      href: 'mailto:minville@outlook.pt',
      icon: Mail,
      color: 'var(--amber)',
      title: 'Email',
      subtitle: 'minville@outlook.pt',
    },
  ]

  return (
    <div className="min-h-screen flex flex-col items-center px-5 py-12" style={{ background: 'var(--bg)' }}>

      <Link href="/" className="flex items-center gap-2.5 mb-10 animate-enter-down">
        <Image src="/images/logo.avif" alt="SonhoEuropa" width={36} height={36} className="rounded-lg" />
        <span className="font-extrabold text-lg tracking-tight" style={{ color: 'var(--fg)' }}>
          Sonho<span style={{ color: 'var(--cobalt)' }}>Europa</span>
        </span>
      </Link>

      <div className="w-full max-w-md animate-enter-up delay-1">
        <div className="card p-6">
          <h2 className="t-heading text-xl mb-1" style={{ color: 'var(--fg)' }}>Contacto e Suporte</h2>
          <p className="text-sm mb-5" style={{ color: 'var(--fg-muted)' }}>Resposta em menos de 24 horas</p>

          <div className="space-y-2">
            {channels.map((ch, i) => (
              <a
                key={i}
                href={ch.href}
                target={ch.target}
                rel={ch.target ? 'noopener noreferrer' : undefined}
                className="flex items-center gap-3 p-3 rounded-lg transition-all hover:shadow-sm"
                style={{ border: '1px solid var(--border)' }}
              >
                <div
                  className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: `color-mix(in srgb, ${ch.color} 10%, transparent)`, color: ch.color }}
                >
                  <ch.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm" style={{ color: 'var(--fg)' }}>{ch.title}</p>
                    {ch.badge && (
                      <span className="badge" style={{ background: `color-mix(in srgb, ${ch.color} 10%, transparent)`, color: ch.color }}>{ch.badge}</span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>{ch.subtitle}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--fg-subtle)' }} />
              </a>
            ))}
          </div>

          <hr className="divider my-5" />

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--fg-subtle)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Horário</p>
                <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>Segunda a Sábado, 08h00 - 20h00</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--fg-subtle)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Responsável</p>
                <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>Fredson Bernardo Muianga · Maputo</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-6 mt-8">
        <Link href="/" className="text-xs flex items-center gap-1 group" style={{ color: 'var(--fg-subtle)' }}>
          <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" /> Início
        </Link>
        <Link href="/privacidade" className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Privacidade</Link>
        <Link href="/dashboard" className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Dashboard</Link>
      </div>
    </div>
  )
}
