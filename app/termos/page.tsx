'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, FileText } from 'lucide-react'

const TERMOS = [
  { t: '1. O que e o SonhoEuropa', p: 'O SonhoEuropa e uma plataforma comunitaria digital onde participantes contribuem com depositos para um fundo colectivo. Quando o fundo atinge a meta de 200 000 MT, o vencedor e escolhido por sorteio aleatorio ponderado — nao e por ordem de inscricao ou de deposito. Quem deposita mais tem maiores chances de ganhar, mas qualquer inscrito pode ser o sorteado. A plataforma e gerida por Fredson Bernardo Muianga, residente em Maputo, Mocambique.' },
  { t: '2. Inscricao e elegibilidade', p: 'Para participar, o utilizador deve: (a) ter pelo menos 18 anos de idade; (b) possuir um numero de telefone valido para M-Pesa ou E-Mola; (c) pagar a taxa de inscricao unica de 200 MT por ciclo. A taxa de inscricao cobre custos operacionais e nao e reembolsavel apos confirmacao do pagamento. Cada pessoa so pode ter uma conta na plataforma.' },
  { t: '3. Depositos', p: 'O valor minimo por deposito e 100 MT, sem limite maximo. Os depositos sao feitos por transferencia directa via E-Mola (876252006) para Fredson Bernardo Muianga, seguidos do envio de comprovativo (texto ou screenshot) na plataforma. O deposito so e contabilizado, e so conta para as chances no sorteio, apos confirmacao manual pelo administrador.' },
  { t: '4. Taxa de gestao e sustentabilidade', p: 'De cada deposito efectuado, 10% (dez por cento) do valor e alocado a gestao e manutencao da plataforma, cobrindo custos operacionais, suporte tecnico, alojamento do sistema, e seguranca. Os restantes 90% sao integralmente direccionados ao fundo comunitario. Exemplo: num deposito de 100 MT, 10 MT vao para gestao e 90 MT vao para o fundo. A taxa de inscricao (200 MT) e integralmente destinada a custos operacionais e nao entra no fundo do premio.' },
  { t: '5. Seleccao do vencedor', p: 'O sistema selecciona automaticamente o vencedor quando o fundo atinge a meta estabelecida. A seleccao e ponderada pelo total depositado: quanto mais depositares, maiores sao as tuas chances de ser seleccionado. O algoritmo utiliza geracao de numeros aleatorios criptograficamente seguros para garantir imparcialidade.' },
  { t: '6. Condicoes para a seleccao', p: 'A seleccao do vencedor so e realizada quando o fundo comunitario atinge a meta estabelecida. Enquanto a meta nao for atingida, o ciclo permanece activo e os depositos continuam a acumular.' },
  { t: '7. Premio', p: 'O vencedor recebe 200 000 MT em dinheiro, entregue directamente via M-Pesa ou transferencia bancaria no prazo de 48 horas apos a seleccao. O premio nao esta sujeito a condicoes adicionais.' },
  { t: '8. Politica de reembolso', p: 'Os depositos efectuados apos confirmacao nao sao reembolsaveis. A taxa de inscricao nao e reembolsavel apos confirmacao. Em caso de cancelamento de um ciclo por motivo de forca maior, os valores serao tratados caso a caso pelo administrador.' },
  { t: '9. Privacidade e dados', p: 'Os dados recolhidos (nome, email, numero de telefone) sao utilizados exclusivamente para o funcionamento da plataforma. Nao partilhamos dados com terceiros. Os comprovativos de pagamento sao armazenados de forma segura e acessiveis apenas ao administrador para fins de verificacao.' },
  { t: '10. Responsabilidade', p: 'A participacao no SonhoEuropa e inteiramente voluntaria. Nao existe garantia de retorno financeiro. O participante reconhece que os depositos sao contribuicoes para um fundo comunitario com seleccao automatica de vencedor. A plataforma nao constitui investimento financeiro, jogo de azar regulamentado, ou esquema de rendimento garantido.' },
  { t: '11. Alteracoes aos termos', p: 'O SonhoEuropa reserva-se o direito de alterar estes termos e condicoes a qualquer momento. As alteracoes serao comunicadas na plataforma e entram em vigor imediatamente apos publicacao. A continuacao do uso da plataforma apos alteracoes constitui aceitacao dos novos termos.' },
  { t: '12. Contacto', p: 'Para duvidas, reclamacoes ou sugestoes, contacta-nos pelo WhatsApp, redes sociais @SonhoEuropa, ou email suporte@sonhoeuropa.co.mz. Resposta em ate 48 horas uteis.' },
]

function gerarPdfTermos() {
  const content = [
    'SONHOEUROPA — TERMOS E CONDICOES DE UTILIZACAO',
    '══════════════════════════════════════════════',
    '',
    'Data de vigencia: Junho 2026',
    'Responsavel: Fredson Bernardo Muianga',
    'Plataforma: sonhoeuropa.co.mz',
    '',
    '────────────────────────────────────────────',
    '',
    ...TERMOS.flatMap((s) => [s.t, s.p, '']),
    'Objectivo do Projecto',
    'O SonhoEuropa nasceu da necessidade real de milhares de mocambicanos que sonham em imigrar para a Europa mas enfrentam barreiras financeiras significativas. Vistos, passagens aereas, alojamento inicial e documentacao podem facilmente ultrapassar 200 000 MT.',
    '',
    'A plataforma cria um fundo comunitario onde cada participante contribui com depositos. Quando o fundo atinge a meta, o vencedor e escolhido por sorteio aleatorio — nao e por ordem de inscricao nem de deposito. Cada participante entra no sorteio com um numero de bilhetes proporcional ao que depositou, por isso quanto mais depositares, maiores sao as tuas chances, mas qualquer inscrito pode ganhar. O vencedor recebe o premio integral, permitindo-lhe dar o primeiro passo rumo ao sonho europeu.',
  ].join('\n')

  const blob = new Blob(['﻿' + content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'SonhoEuropa_Termos_e_Condicoes.txt'
  a.click()
  URL.revokeObjectURL(url)
}

export default function TermosPage() {
  return (
    <div className="min-h-screen px-5 py-8" style={{ background: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5 mb-6">
          <Image src="/images/logo.avif" alt="SonhoEuropa" width={32} height={32} className="rounded-lg" />
          <span className="font-extrabold text-lg tracking-tight" style={{ color: 'var(--fg)' }}>
            Sonho<span style={{ color: 'var(--cobalt)' }}>Europa</span>
          </span>
        </Link>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-1">
            <h1 className="t-heading text-xl" style={{ color: 'var(--fg)' }}>Termos e Condições</h1>
            <button onClick={gerarPdfTermos}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ color: 'var(--cobalt)', border: '1.5px solid var(--border)' }}>
              <FileText className="w-3.5 h-3.5" /> Baixar
            </button>
          </div>
          <p className="text-sm mb-5" style={{ color: 'var(--fg-muted)' }}>Lê com atenção antes de participares</p>

          <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
            {TERMOS.map((s) => (
              <div key={s.t}>
                <p className="font-bold mb-1" style={{ color: 'var(--fg)' }}>{s.t}</p>
                <p>{s.p}</p>
              </div>
            ))}

            <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="font-bold mb-1" style={{ color: 'var(--fg)' }}>Objectivo do Projecto</p>
              <p>O SonhoEuropa nasceu da necessidade real de milhares de moçambicanos que sonham em imigrar para a Europa mas enfrentam barreiras financeiras significativas. Vistos, passagens aéreas, alojamento inicial e documentação podem facilmente ultrapassar 200 000 MT.</p>
              <p className="mt-2">A plataforma cria um fundo comunitário onde cada participante contribui com depósitos. Quando o fundo atinge a meta, o vencedor é escolhido por sorteio aleatório — não é por ordem de inscrição nem de depósito. Cada participante entra no sorteio com um número de bilhetes proporcional ao que depositou, por isso quanto mais depositares, maiores são as tuas chances, mas qualquer inscrito pode ganhar. O vencedor recebe o prémio integral.</p>
            </div>
          </div>
        </div>

        <Link href="/" className="mt-6 text-xs flex items-center gap-1 group w-fit" style={{ color: 'var(--fg-subtle)' }}>
          <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" /> Voltar ao início
        </Link>
      </div>
    </div>
  )
}
