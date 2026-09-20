-- APLICADA em 2026-09-20 (migrações `endurecer_politicas_sorteios_e_funcoes` e
-- `revogar_execute_publico_rls_auto_enable`). Ver db/README.md.

-- 1. sorteios tinha duas políticas de SELECT em conflito: uma com qual = true
--    (toda a gente, incluindo anónimos) e outra a exigir sessão iniciada. O
--    Postgres combina políticas permissivas com OR, por isso a de `true` ganhava
--    e o vencedor, o total do fundo e o prémio ficavam públicos.
drop policy if exists "Users read sorteios" on public.sorteios;

-- 2. search_path fixo nas funções que mexem em dinheiro: com search_path
--    mutável, uma função SECURITY DEFINER pode ser levada a resolver um nome
--    para um objecto do atacante e executá-lo com os privilégios do dono.
alter function public.increment_fundo(uuid, numeric, numeric) set search_path = public, pg_temp;
alter function public.increment_user_deposito(uuid, numeric) set search_path = public, pg_temp;
alter function public.increment_participantes(uuid, integer) set search_path = public, pg_temp;

-- 3. rls_auto_enable é um event trigger (auto-activa RLS em tabelas novas).
--    O EXECUTE estava concedido a PUBLIC; postgres e service_role têm
--    concessões próprias e mantêm o acesso.
revoke execute on function public.rls_auto_enable() from public;
