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
| `limites_de_tamanho_e_tipo_nos_buckets` | Limite de tamanho e tipos permitidos nos três buckets de Storage |
| `comprovativos_bucket_privado` | Tira a leitura pública do bucket `comprovativos` |
| `bloqueio_de_login_admin_persistente` | Contador de tentativas de login de admin, por IP e partilhado entre instâncias |

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

`admin_financeiro`, `auditoria`, `contrato_templates` e
`admin_login_tentativas` têm RLS activo e nenhuma política — ou seja, ninguém lhes toca excepto a service role. É
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

## Storage

| Bucket | Público | Tamanho máximo | Tipos aceites |
|---|---|---|---|
| `comprovativos` | não | 10 MB | JPEG, PNG, WEBP, HEIC, HEIF |
| `contratos` | não | 10 MB | PDF |
| `verificacoes` | não | 5 MB | JPEG, PNG, WEBP, HEIC, HEIF |

As fotos de BI e selfies (`verificacoes`) estão privadas e a política exige que
cada pessoa só escreva na sua própria pasta (`auth.uid()`). O admin vê-as por
URLs assinados de 10 minutos. Os contratos também são privados, com URLs
assinados de 5 minutos.

Antes desta migração nenhum bucket tinha limite de tamanho nem restrição de
tipo. Como os uploads vão directos do browser, a validação que existe em
`app/dashboard/page.tsx` é conveniência, não barreira: quem chame a API do
Storage directamente contorna-a. Os limites acima são aplicados pelo próprio
Storage e valem para qualquer caminho de upload.

### `comprovativos` deixou de ser público

Os comprovativos de pagamento mostram tipicamente nome, número e saldo de quem
transferiu, e o bucket era de leitura pública — quem tivesse o URL via a imagem
sem sessão nenhuma. Estava mitigado por `limparComprovativosExpirados()`, que
apaga as imagens ao fim de 24h, e pela entropia do nome do ficheiro, mas
mitigação não é controlo de acesso.

Agora o bucket é privado, como `verificacoes` e `contratos`. O que mudou no
código:

- `app/dashboard/page.tsx` deixou de chamar `getPublicUrl`. O envio passa ao
  servidor o **caminho** do ficheiro dentro do bucket.
- `pagamentos.comprovativo_imagem_url` passa a guardar esse caminho. Linhas
  antigas guardam o URL público completo e continuam a funcionar:
  `caminhoNoBucket()` aceita as duas formas.
- `getPagamentos()` (em `app/actions/admin.ts`) assina cada caminho com
  `createSignedUrls`, 30 minutos, numa só chamada para a lista toda. A vista de
  admin recebe o mesmo campo com o mesmo significado — o JSX não mudou.
- Quando não há assinatura (ficheiro já apagado pelas 24h) o campo fica a
  `null` e aparece a mensagem de imagem expirada que já existia, em vez de uma
  imagem partida.

Aproveitou-se para fechar um buraco lateral que não tinha nada que ver com o
bucket ser público: a validação antiga só exigia que o URL apontasse para
dentro de `comprovativos`, portanto qualquer pessoa autenticada podia anexar ao
seu próprio pagamento o comprovativo de outra. O nome do ficheiro passa a ser
`<referencia>_<carimbo>.<extensão>` e o servidor exige que corresponda à
referência que está a ser enviada (`caminhoPertenceA`), referência essa que já
era verificada como pertencendo a quem envia.

A leitura do bucket passa toda pela service role: não há política de `SELECT`
em `storage.objects` para `comprovativos`, de propósito. O upload não foi
tocado — a política de `INSERT` continua a mesma, e `public` só governa a
leitura anónima.

## Bloqueio de login do administrador

O contador de tentativas vivia num `Map` em memória do processo, com a chave
constante `'admin-login'`. Dois defeitos independentes:

1. Em serverless há várias instâncias, cada uma com o seu `Map`. O limite
   efectivo era 5 × (instâncias quentes), e um arranque a frio zerava a
   contagem.
2. A chave era igual para toda a gente. O bloqueio não distinguia quem
   falhava, portanto qualquer pessoa trancava o administrador fora do painel
   durante 15 minutos falhando cinco vezes de propósito — uma defesa virada
   contra quem devia proteger.

Agora a contagem é por IP, em `admin_login_tentativas`, partilhada por todas
as instâncias, e o incremento é atómico (`registar_tentativa_admin`). Se a
base de dados não responder, o código cai para a contagem antiga em memória:
pior, mas melhor do que não contar. O que nunca acontece é saltar a
verificação da senha.

O IP vem de `x-vercel-forwarded-for` ou `x-real-ip` — cabeçalhos escritos pela
plataforma — e só depois de `x-forwarded-for`. Ler a primeira posição de
`x-forwarded-for` às cegas seria ler um valor que o atacante escolhe, e
escolher o valor é escolher um contador novo a cada tentativa.

Continua a ser limitação de IP: quem tenha muitos endereços tem cinco
tentativas em cada um. A barreira real é a senha.

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
