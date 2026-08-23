'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Shield, ArrowLeft } from 'lucide-react'

const seccoes = [
  {
    titulo: '1. Responsável pelo tratamento',
    texto: 'O responsável pelo tratamento dos dados pessoais é Fredson Bernardo Muianga, residente em Maputo, Moçambique, contactável através do email minville@outlook.pt ou telefone +258 846 283 051.',
  },
  {
    titulo: '2. Dados recolhidos',
    texto: 'Recolhemos os seguintes dados pessoais: nome completo, endereço de email, histórico de depósitos e transacções na plataforma. Não recolhemos dados bancários directos — os pagamentos são feitos via M-Pesa e E-Mola, plataformas independentes.',
  },
  {
    titulo: '3. Finalidade do tratamento',
    texto: 'Os dados são utilizados exclusivamente para: (a) gestão da conta do participante; (b) processamento de depósitos e inscrições; (c) elegibilidade para selecção do vencedor; (d) comunicação sobre o estado do ciclo e resultados; (e) cumprimento de obrigações legais.',
  },
  {
    titulo: '4. Base legal',
    texto: 'O tratamento dos dados baseia-se no consentimento do utilizador ao criar a conta e aceitar os termos e condições da plataforma. O utilizador pode retirar o consentimento a qualquer momento, solicitando a eliminação da sua conta.',
  },
  {
    titulo: '5. Partilha de dados',
    texto: 'Os dados pessoais não são vendidos, alugados ou partilhados com terceiros para fins de marketing. Os dados podem ser partilhados com: (a) Supabase (alojamento da base de dados, servidores na UE); (b) autoridades competentes quando exigido por lei.',
  },
  {
    titulo: '6. Segurança',
    texto: 'Implementamos medidas técnicas e organizativas para proteger os dados pessoais, incluindo: encriptação de passwords, comunicação via HTTPS, autenticação segura, e acesso restrito à base de dados apenas ao administrador autorizado.',
  },
  {
    titulo: '7. Retenção de dados',
    texto: 'Os dados pessoais são mantidos enquanto a conta estiver activa. Após solicitar a eliminação da conta, todos os dados pessoais são removidos no prazo de 30 dias, excepto registos de transacções que podem ser mantidos por obrigação legal por um período de 5 anos.',
  },
  {
    titulo: '8. Direitos do utilizador',
    texto: 'O utilizador tem direito a: (a) aceder aos seus dados pessoais; (b) rectificar dados incorrectos; (c) solicitar a eliminação da conta e dados; (d) obter uma cópia dos seus dados; (e) apresentar reclamação junto das autoridades competentes. Para exercer estes direitos, contacte minville@outlook.pt.',
  },
  {
    titulo: '9. Cookies e rastreamento',
    texto: 'A plataforma utiliza apenas cookies essenciais para o funcionamento da sessão de autenticação. Não utilizamos cookies de rastreamento, analytics de terceiros ou ferramentas de publicidade.',
  },
  {
    titulo: '10. Alterações a esta política',
    texto: 'Reservamo-nos o direito de actualizar esta política de privacidade. Alterações significativas serão comunicadas aos utilizadores através da plataforma. A data da última actualização é indicada no final deste documento.',
  },
]

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen flex flex-col items-center px-5 py-12" style={{ background: 'var(--bg)' }}>

      <Link href="/" className="flex items-center gap-2.5 mb-10 animate-enter-down">
        <Image src="/images/logo.avif" alt="SonhoEuropa" width={36} height={36} className="rounded-lg" />
        <span className="font-extrabold text-lg tracking-tight" style={{ color: 'var(--fg)' }}>
          Sonho<span style={{ color: 'var(--cobalt)' }}>Europa</span>
        </span>
      </Link>

      <div className="w-full max-w-2xl animate-enter-up delay-1">
        <div className="card p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: 'var(--emerald-muted)', color: 'var(--emerald)' }}>
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="t-heading text-xl" style={{ color: 'var(--fg)' }}>Política de Privacidade</h2>
              <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Última actualização: 14 de Junho de 2026</p>
            </div>
          </div>

          <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--fg-muted)' }}>
            A SonhoEuropa compromete-se a proteger a privacidade dos seus utilizadores. Esta política descreve como recolhemos, utilizamos e protegemos os dados pessoais dos participantes da plataforma.
          </p>

          <div className="space-y-5">
            {seccoes.map((s, i) => (
              <div key={i}>
                <h3 className="font-bold text-sm mb-1" style={{ color: 'var(--fg)' }}>{s.titulo}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{s.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-6 mt-8">
        <Link href="/" className="text-xs flex items-center gap-1 group" style={{ color: 'var(--fg-subtle)' }}>
          <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" /> Início
        </Link>
        <Link href="/contacto" className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Contacto</Link>
        <Link href="/dashboard" className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Painel</Link>
      </div>
    </div>
  )
}
