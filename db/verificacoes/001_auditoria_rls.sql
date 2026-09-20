-- ════════════════════════════════════════════════════════════════════════════
-- POR CORRER — verificação de RLS
--
-- Porque isto importa mais do que tudo o resto neste repositório:
--
-- O browser fala DIRECTAMENTE com o Supabase usando a chave anónima, que vai
-- no bundle de JavaScript e é pública por design. app/dashboard/page.tsx e
-- app/page.tsx fazem select a `usuarios`, `depositos`, `verificacoes`,
-- `inscricoes` e `ciclos` a partir do cliente.
--
-- Isso significa que a ÚNICA coisa que impede qualquer visitante de ler os
-- dados de toda a gente — nomes, telefones, números de BI, histórico de
-- depósitos — são as políticas de RLS destas tabelas. Não é o código da
-- aplicação: quem tenha a chave anónima pode ignorar a aplicação por completo
-- e falar com a API do Supabase directamente.
--
-- Isto não pôde ser verificado quando a auditoria foi feita: o projecto
-- Supabase estava hibernado e a ligação à base de dados recusava autenticação.
-- Corre isto assim que o projecto acordar.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 1. Alguma tabela sem RLS activo? ───────────────────────────────────────
-- Qualquer linha devolvida aqui com rowsecurity = false é uma tabela que
-- QUALQUER PESSOA com a chave anónima pode ler por inteiro.

select
  tablename,
  rowsecurity as rls_activo
from pg_tables
where schemaname = 'public'
order by rowsecurity, tablename;


-- ─── 2. Que políticas existem, e o que permitem ─────────────────────────────
-- Atenção a qualificadores `true` em tabelas com dados pessoais: significam
-- "toda a gente vê tudo".

select
  tablename,
  policyname,
  cmd as operacao,
  roles,
  qual as condicao_leitura,
  with_check as condicao_escrita
from pg_policies
where schemaname = 'public'
order by tablename, cmd;


-- ─── 3. Tabelas com RLS activo mas SEM políticas ────────────────────────────
-- Estas ficam inacessíveis a toda a gente excepto à service role. Se a
-- aplicação lê alguma delas do browser, essa funcionalidade está partida.

select t.tablename
from pg_tables t
left join pg_policies p
  on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
  and t.rowsecurity = true
  and p.policyname is null;


-- ─── 4. Buckets de Storage: quais são públicos ──────────────────────────────
-- `comprovativos` é usado com getPublicUrl() pela aplicação, portanto é
-- público por desenho actual — comprovativos de pagamento (que mostram nome,
-- número e saldo de quem transferiu) ficam legíveis por quem tenha o URL.
-- Está mitigado por limparComprovativosExpirados(), que apaga as imagens ao
-- fim de 24h, mas o desenho correcto é bucket privado + URLs assinados.
--
-- `verificacoes` guarda fotos de BI e selfies. Se aparecer como público aqui,
-- é incidente grave e imediato.

select id, name, public as e_publico, file_size_limit, allowed_mime_types
from storage.buckets;


-- ─── 5. Políticas de Storage ────────────────────────────────────────────────

select bucket_id, name as policy_name, operation, definition
from storage.policies;
