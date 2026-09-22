-- APLICADA em 2026-09-22 (migração `bloqueio_de_login_admin_persistente`).
--
-- Contador de tentativas de login de administrador, por IP e persistente.
--
-- O que estava errado, em app/actions/admin.ts:
--
--   const adminAttempts = new Map(...)
--   const key = 'admin-login'
--
-- Dois defeitos independentes:
--
--  1. O Map vive na memória de UMA instância. Em serverless há várias, e
--     arrancam e morrem — portanto o limite efectivo era 5 x (instâncias
--     quentes), e bastava esperar um arranque a frio para o contador zerar.
--  2. A chave era a constante 'admin-login', igual para toda a gente. O
--     bloqueio não distinguia quem falhava, por isso qualquer pessoa podia
--     trancar o administrador fora do painel durante 15 minutos falhando
--     cinco vezes de propósito. Um mecanismo de defesa que se vira contra
--     quem devia proteger.
--
-- Agora a contagem é por IP e vive na base de dados, partilhada por todas as
-- instâncias. Se a base não responder, o código cai para a contagem antiga em
-- memória — pior, mas melhor do que não contar. O que nunca acontece é saltar
-- a verificação da senha.

-- ─── 1. TABELA ──────────────────────────────────────────────────────────────

create table if not exists public.admin_login_tentativas (
  ip             text primary key,
  tentativas     int         not null default 0,
  bloqueado_ate  timestamptz,
  actualizado_at timestamptz not null default now()
);

alter table public.admin_login_tentativas enable row level security;

-- Sem políticas, de propósito: tabela só de servidor, como `auditoria` e
-- `admin_financeiro`. Só a service role lhe toca.
revoke all on public.admin_login_tentativas from anon, authenticated, public;


-- ─── 2. INCREMENTO ATÓMICO ──────────────────────────────────────────────────
-- Ler-somar-escrever em três passos deixava tentativas em paralelo a
-- atropelarem-se e a perderem contagens. Aqui é uma instrução só.

create or replace function public.registar_tentativa_admin(
  p_ip       text,
  p_max      int,
  p_bloqueio interval
) returns timestamptz
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_tentativas int;
  v_bloqueado  timestamptz;
begin
  -- Limpeza oportunista das linhas que já não bloqueiam ninguém.
  delete from public.admin_login_tentativas
   where actualizado_at < now() - interval '24 hours'
     and (bloqueado_ate is null or bloqueado_ate < now());

  insert into public.admin_login_tentativas as t (ip, tentativas, actualizado_at)
       values (p_ip, 1, now())
  on conflict (ip) do update
       set tentativas     = t.tentativas + 1,
           actualizado_at = now()
    returning t.tentativas into v_tentativas;

  if v_tentativas >= p_max then
    update public.admin_login_tentativas
       set bloqueado_ate = now() + p_bloqueio,
           tentativas    = 0
     where ip = p_ip
    returning bloqueado_ate into v_bloqueado;
  end if;

  return v_bloqueado;
end;
$$;

revoke all on function public.registar_tentativa_admin(text, int, interval) from public, anon, authenticated;


-- ─── 3. VERIFICAÇÃO PÓS-APLICAÇÃO ───────────────────────────────────────────

-- Comportamento: a 5ª tentativa devolve um carimbo, as anteriores devolvem
-- null. Corrido com um IP de teste (203.0.113.7, da gama reservada a
-- documentação) e a linha apagada a seguir.
--
--   select n, public.registar_tentativa_admin('203.0.113.7', 5, interval '15 minutes')
--   from generate_series(1, 6) as n;
--
--   1 → null   2 → null   3 → null   4 → null
--   5 → 2026-09-22 10:15:26+00      6 → null (o código nem lá chega: vê o
--                                    bloqueio antes e recusa)

-- Ninguém além da service role toca nisto (esperado: zero linhas).
select 'tabela' as objecto, grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and table_name = 'admin_login_tentativas'
  and grantee in ('anon','authenticated','PUBLIC')
union all
select 'funcao', r.rolname, 'EXECUTE'
from pg_proc p
cross join lateral (select unnest(array['anon','authenticated']) as rolname) r
where p.proname = 'registar_tentativa_admin'
  and has_function_privilege(r.rolname, p.oid, 'EXECUTE');
