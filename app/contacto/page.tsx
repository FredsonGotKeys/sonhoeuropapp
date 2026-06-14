'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Phone, Mail, MessageCircle, ArrowLeft, Clock, Shield } from 'lucide-react'

export default function ContactoPage() {
  const whatsappUrl = 'https://wa.me/258846283051?text=' + encodeURIComponent('Ola, preciso de ajuda com o SonhoEuropa!')

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-10"
      style={{ background: 'linear-gradient(160deg, #001f6b 0%, #003399 50%, #1D9E75 100%)' }}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex flex-col items-center gap-2 group">
          <Image
            src="/images/logo.avif"
            alt="SonhoEuropa"
            width={56}
            height={56}
            className="rounded-2xl shadow-lg group-hover:scale-105 transition-transform"
          />
          <h1 className="text-white font-black text-2xl tracking-tight">SonhoEuropa</h1>
        </Link>
        <p className="text-white/50 text-sm mt-1">Estamos aqui para te ajudar</p>
      </div>

      {/* Card principal */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: '#F5F5F0' }}>
          <h2 className="font-black text-xl" style={{ color: '#003399' }}>Contacto e Suporte</h2>
          <p className="text-xs text-gray-400 mt-0.5">Resposta em menos de 24 horas</p>
        </div>

        <div className="p-6 space-y-4">
          {/* WhatsApp - principal */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 rounded-2xl transition-all hover:scale-[1.02] active:scale-95"
            style={{ backgroundColor: '#25D36610', border: '2px solid #25D36630' }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#25D366' }}>
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-black text-sm" style={{ color: '#25D366' }}>WhatsApp</p>
              <p className="text-gray-500 text-sm">+258 84 628 3051</p>
              <p className="text-xs text-gray-400 mt-0.5">Resposta rapida · Clica para abrir</p>
            </div>
            <ArrowLeft className="w-4 h-4 text-gray-300 rotate-180" />
          </a>

          {/* Telefone */}
          <a
            href="tel:+258846283051"
            className="flex items-center gap-4 p-4 rounded-2xl transition-all hover:scale-[1.02] active:scale-95"
            style={{ backgroundColor: '#00339908', border: '1.5px solid #00339920' }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#003399' }}>
              <Phone className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-black text-sm" style={{ color: '#003399' }}>Ligar</p>
              <p className="text-gray-500 text-sm">+258 84 628 3051</p>
            </div>
          </a>

          {/* Telefone 2 */}
          <a
            href="tel:+258876252006"
            className="flex items-center gap-4 p-4 rounded-2xl transition-all hover:scale-[1.02] active:scale-95"
            style={{ backgroundColor: '#00339908', border: '1.5px solid #00339920' }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#003399' }}>
              <Phone className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-black text-sm" style={{ color: '#003399' }}>Ligar (alternativo)</p>
              <p className="text-gray-500 text-sm">+258 87 625 2006</p>
            </div>
          </a>

          {/* Email */}
          <a
            href="mailto:minville@outlook.pt"
            className="flex items-center gap-4 p-4 rounded-2xl transition-all hover:scale-[1.02] active:scale-95"
            style={{ backgroundColor: '#EF9F2708', border: '1.5px solid #EF9F2720' }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EF9F27' }}>
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-black text-sm" style={{ color: '#EF9F27' }}>Email</p>
              <p className="text-gray-500 text-sm">minville@outlook.pt</p>
            </div>
          </a>

          {/* Info */}
          <div className="pt-4 border-t space-y-3" style={{ borderColor: '#F5F5F0' }}>
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-600">Horario de atendimento</p>
                <p className="text-xs text-gray-400">Segunda a Sabado, 08h00 - 20h00</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-600">Responsavel</p>
                <p className="text-xs text-gray-400">Fredson Bernardo Muianga · Maputo, Mocambique</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="flex gap-4 mt-6">
        <Link href="/" className="text-white/30 text-xs hover:text-white/60 transition-colors">
          Inicio
        </Link>
        <Link href="/privacidade" className="text-white/30 text-xs hover:text-white/60 transition-colors">
          Privacidade
        </Link>
        <Link href="/dashboard" className="text-white/30 text-xs hover:text-white/60 transition-colors">
          Dashboard
        </Link>
      </div>
    </div>
  )
}
