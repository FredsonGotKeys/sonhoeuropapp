-- Torna o bucket `comprovativos` privado.
--
-- APLICADA em 2026-09-22 (migração `comprovativos_bucket_privado`), depois de
-- o código que assina os URLs estar em produção (e26b7b7) — e não antes, que
-- era o ponto: a vista de admin só passa a assinar os URLs a partir do commit
-- que acompanha esta migração. O código novo funciona com o bucket em qualquer
-- um dos dois estados (assinar um objecto de um bucket público também
-- funciona), por isso a ordem segura era deploy primeiro, migração a seguir.
--
-- Porquê: um comprovativo de E-Mola mostra o nome, o número e muitas vezes o
-- saldo de quem transferiu. Com o bucket público, qualquer pessoa com o URL
-- via a imagem sem sessão nenhuma. Estava mitigado pela limpeza às 24h e pela
-- entropia do nome do ficheiro, mas mitigação não é controlo de acesso.
--
-- Depois disto, ler um objecto de `comprovativos` exige a service role — não
-- há política de SELECT em storage.objects para este bucket, de propósito.
-- Quem precisa de ver (o admin) recebe URLs assinados de 30 minutos gerados
-- em app/actions/admin.ts. O upload continua igual: a política de INSERT
-- "Auth users upload comprovativos" não é tocada, e `public` só governa a
-- leitura anónima.

-- ─── 1. ESTADO ANTES ────────────────────────────────────────────────────────

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('comprovativos', 'verificacoes', 'contratos');


-- ─── 2. ALTERAÇÃO ───────────────────────────────────────────────────────────

update storage.buckets set public = false where id = 'comprovativos';


-- ─── 3. VERIFICAÇÃO ─────────────────────────────────────────────────────────

select id, public from storage.buckets order by id;
-- Esperado: os três buckets com public = false. Confirmado em 2026-09-22:
--   comprovativos  false  10485760  {image/jpeg,image/png,image/webp,image/heic,image/heif}
--   contratos      false  10485760  {application/pdf}
--   verificacoes   false   5242880  {image/jpeg,image/png,image/webp,image/heic,image/heif}

-- E que nenhuma política deixe `anon` ou `authenticated` ler este bucket:
select policyname, cmd, roles::text
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT';
-- Esperado: zero linhas (a leitura passa toda pela service role).
-- Confirmado em 2026-09-22: zero linhas.
