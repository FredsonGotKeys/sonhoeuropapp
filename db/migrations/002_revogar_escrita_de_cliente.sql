-- APLICADA em 2026-09-20 (migrações `revogar_escrita_cliente_em_usuarios` e
-- `revogar_toda_escrita_de_cliente_privilegio_minimo` no projecto Supabase).
-- Guardada aqui para o estado da base não viver só no painel. Ver db/README.md.

-- anon e authenticated tinham INSERT e UPDATE em todas as colunas de todas as
-- tabelas. Onde o RLS tinha política permissiva de escrita, isso abria a porta:
--   usuarios + usuarios_update_own   -> update({verificado:true}) na própria
--                                       linha, saltando a verificação de BI
--   inscricoes + inscricoes_insert_own -> inscrever-se sem pagar os 149 MT
--
-- A aplicação não escreve nada do cliente (grep a .update/.insert/.upsert em
-- app/**/*.tsx: zero). SELECT fica intacto.

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;
