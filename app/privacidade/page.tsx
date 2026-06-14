'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Shield, ArrowLeft } from 'lucide-react'

const seccoes = [
  {
    titulo: '1. Responsavel pelo tratamento',
    texto: 'O responsavel pelo tratamento dos dados pessoais e Fredson Bernardo Muianga, residente em Maputo, Mocambique, contactavel atraves do email minville@outlook.pt ou telefone +258 846 283 051.',
  },
  {
    titulo: '2. Dados recolhidos',
    texto: 'Recolhemos os seguintes dados pessoais: nome completo, endereco de email, historico de depositos e transaccoes na plataforma, pontuacao e actividade no sistema. Nao recolhemos dados bancarios directos — os pagamentos sao feitos via M-Pesa e E-Mola, plataformas independentes.',
  },
  {
    titulo: '3. Finalidade do tratamento',
    texto: 'Os dados sao utilizados exclusivamente para: (a) gestao da conta do participante; (b) processamento de depositos e inscricoes; (c) calculo de pontos e elegibilidade para sorteios; (d) comunicacao sobre o estado do ciclo e resultados; (e) cumprimento de obrigacoes legais.',
  },
  {
    titulo: '4. Base legal',
    texto: 'O tratamento dos dados baseia-se no consentimento do utilizador ao criar a conta e aceitar os termos e condicoes da plataforma. O utilizador pode retirar o consentimento a qualquer momento, solicitando a eliminacao da sua conta.',
  },
  {
    titulo: '5. Partilha de dados',
    texto: 'Os dados pessoais nao sao vendidos, alugados ou partilhados com terceiros para fins de marketing. Os dados podem ser partilhados com: (a) Supabase (alojamento da base de dados, servidores na UE); (b) autoridades competentes quando exigido por lei.',
  },
  {
    titulo: '6. Seguranca',
    texto: 'Implementamos medidas tecnicas e organizativas para proteger os dados pessoais, incluindo: encriptacao de passwords, comunicacao via HTTPS, autenticacao segura, e acesso restrito a base de dados apenas ao administrador autorizado.',
  },
  {
    titulo: '7. Retencao de dados',
    texto: 'Os dados pessoais sao mantidos enquanto a conta estiver activa. Apos solicitar a eliminacao da conta, todos os dados pessoais sao removidos no prazo de 30 dias, excepto registos de transaccoes que podem ser mantidos por obrigacao legal por um periodo de 5 anos.',
  },
  {
    titulo: '8. Direitos do utilizador',
    texto: 'O utilizador tem direito a: (a) aceder aos seus dados pessoais; (b) rectificar dados incorrectos; (c) solicitar a eliminacao da conta e dados; (d) obter uma copia dos seus dados; (e) apresentar reclamacao junto das autoridades competentes. Para exercer estes direitos, contacte minville@outlook.pt.',
  },
  {
    titulo: '9. Cookies e rastreamento',
    texto: 'A plataforma utiliza apenas cookies essenciais para o funcionamento da sessao de autenticacao. Nao utilizamos cookies de rastreamento, analytics de terceiros ou ferramentas de publicidade.',
  },
  {
    titulo: '10. Alteracoes a esta politica',
    texto: 'Reservamo-nos o direito de actualizar esta politica de privacidade. Alteracoes significativas serao comunicadas aos utilizadores atraves da plataforma. A data da ultima actualizacao e indicada no final deste documento.',
  },
]

export default function PrivacidadePage() {
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
      </div>

      {/* Card */}
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b flex items-center gap-3" style={{ borderColor: '#F5F5F0' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#1D9E7515' }}>
            <Shield className="w-5 h-5" style={{ color: '#1D9E75' }} />
          </div>
          <div>
            <h2 className="font-black text-xl" style={{ color: '#003399' }}>Politica de Privacidade</h2>
            <p className="text-xs text-gray-400">Ultima actualizacao: 14 de Junho de 2026</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-gray-500 leading-relaxed">
            A SonhoEuropa compromete-se a proteger a privacidade dos seus utilizadores. Esta politica descreve como recolhemos, utilizamos e protegemos os dados pessoais dos participantes da plataforma.
          </p>

          {seccoes.map((s, i) => (
            <div key={i}>
              <h3 className="font-bold text-sm mb-1.5" style={{ color: '#003399' }}>{s.titulo}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{s.texto}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="flex gap-4 mt-6">
        <Link href="/" className="text-white/30 text-xs hover:text-white/60 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Inicio
        </Link>
        <Link href="/contacto" className="text-white/30 text-xs hover:text-white/60 transition-colors">
          Contacto
        </Link>
        <Link href="/dashboard" className="text-white/30 text-xs hover:text-white/60 transition-colors">
          Dashboard
        </Link>
      </div>
    </div>
  )
}
