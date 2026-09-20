# Base de dados

Registo das alterações aplicadas ao Supabase (projecto `sonhoeuropa`,
ref `zjqhipjhsaewgtttjwdc`), para que o estado da base não viva só no
painel da Supabase.

As migrações aqui são o que **já foi aplicado**, por ordem. Cada uma está
também registada no histórico de migrações do próprio projecto com o mesmo
nome, e pode ser consultada com `list_migrations`.

## Aplicadas em 2026-09-20 (auditoria de segurança)

| Migração | O que faz |
|---|---|
| `revogar_escrita_cliente_em_usuarios` | Tira INSERT/UPDATE de `usuarios` a `anon` e `authenticated` |
| `revogar_toda_escrita_de_cliente_privilegio_minimo` | Estende a revogação a todas as tabelas de `public` |
| `endurecer_politicas_sorteios_e_funcoes` | Remove política pública de `sorteios`; fixa `search_path` nas funções de dinheiro |
| `revogar_execute_publico_rls_auto_enable` | Tira `EXECUTE` de `PUBLIC` na função de event trigger |
| `restricoes_unicidade_contra_dupla_contagem` | UNIQUE em `depositos.referencia_paysuite`, `inscricoes(usuario_id, ciclo_id)`, `sorteios.ciclo_id` |

### Porque é que a revogação de escrita não parte nada

A aplicação **não faz uma única escrita a partir do cliente**. Verificado por
`grep -rnE "\.(update|insert|upsert)\(" app/**/*.tsx` → zero ocorrências.
Todas as escritas passam por server actions que usam a service role
(`lib/supabase/admin.ts`), papel que ignora RLS e não é afectado por estas
migrações. `SELECT` ficou intacto em todas as tabelas, que é de onde dependem
o painel, a página inicial e as subscrições de realtime.

### O que estava exposto antes

`anon` e `authenticated` tinham INSERT e UPDATE em todas as colunas de todas as
tabelas. Onde o RLS não tinha política permissiva para escrita, ficava travado
na mesma — mas onde tinha, a combinação abria a porta a sério:

- **`usuarios` + `usuarios_update_own`** — qualquer pessoa autenticada podia
  fazer `update({ verificado: true })` na própria linha e saltar a verificação
  de identidade, incluindo a barreira do servidor em `app/actions/contrato.ts`.
  Também podia reescrever `bi_numero` e `total_depositado`.
- **`inscricoes` + `inscricoes_insert_own`** — inserir a própria inscrição sem
  pagar a taxa de 149 MT.

## Estado verificado do RLS

Todas as 12 tabelas de `public` têm RLS activo. As tabelas com dados pessoais
(`usuarios`, `depositos`, `verificacoes`, `inscricoes`, `pagamentos`,
`contratos`, `pontos_bonus`) têm políticas de SELECT limitadas ao próprio
(`auth.uid() = usuario_id`). `ciclos` é legível publicamente de propósito: é o
que a página inicial mostra a quem ainda não tem conta.

`admin_financeiro`, `auditoria` e `contrato_templates` têm RLS activo e
nenhuma política — ou seja, ninguém lhes toca excepto a service role. É
intencional: são tabelas só de servidor. O linter da Supabase assinala-as como
INFO, não como problema.

Teste como visitante anónimo, corrido depois das migrações:

| Tabela | Linhas visíveis a `anon` | Esperado |
|---|---|---|
| `ciclos` | 3 | >0 (a landing precisa) |
| `usuarios` | 0 | 0 |
| `depositos` | 0 | 0 |
| `verificacoes` | 0 | 0 |
| `pagamentos` | 0 | 0 |
| `sorteios` | 0 | 0 |

## Por fazer, fora do SQL

**Protecção contra senhas vazadas** está desligada. É um interruptor no painel:
*Authentication → Providers → Email → Leaked password protection*. Liga a
verificação contra o HaveIBeenPwned quando alguém escolhe senha.

## Como verificar o estado a qualquer momento

```sql
-- RLS e políticas por tabela
select t.tablename, t.rowsecurity, count(p.policyname) as politicas
from pg_tables t
left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
group by t.tablename, t.rowsecurity
order by t.rowsecurity, t.tablename;

-- Escritas concedidas aos papéis públicos (deve devolver zero linhas)
select table_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and grantee in ('anon','authenticated')
  and privilege_type in ('INSERT','UPDATE','DELETE');
```
