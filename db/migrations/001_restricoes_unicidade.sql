-- APLICADA em 2026-09-20 (migração `restricoes_unicidade_contra_dupla_contagem`).
--
-- Diagnóstico corrido antes de aplicar: 0 depósitos com referência repetida,
-- 0 inscrições repetidas, 0 ciclos com mais de um sorteio. Nenhum dado
-- existente entrava em conflito.
--
-- Defesa de último recurso contra dupla contagem de dinheiro: o código em
-- app/actions/admin.ts já reivindica o pagamento e o ciclo atomicamente antes
-- de creditar, e isto fecha a janela no único sítio onde código futuro não a
-- pode reabrir por distracção. Ver db/README.md.

-- ─── 1. DIAGNÓSTICO: já existem duplicados? ─────────────────────────────────

-- Depósitos creditados mais do que uma vez a partir do mesmo pagamento.
-- Cada linha aqui é dinheiro contado a dobrar: peso a mais no sorteio para
-- essa pessoa e fundo inflacionado para toda a gente.
select referencia_paysuite, count(*) as vezes, sum(valor) as total_contado
from depositos
where referencia_paysuite is not null
group by referencia_paysuite
having count(*) > 1
order by vezes desc;

-- Inscrições repetidas no mesmo ciclo.
select usuario_id, ciclo_id, count(*) as vezes
from inscricoes
group by usuario_id, ciclo_id
having count(*) > 1;

-- Ciclos com mais do que um sorteio registado. Se isto devolver alguma linha,
-- houve mais do que um vencedor para o mesmo ciclo e é preciso decidir
-- manualmente qual conta — não há forma automática e honesta de o fazer.
select ciclo_id, count(*) as vezes
from sorteios
group by ciclo_id
having count(*) > 1;


-- ─── 2. RESTRIÇÕES ──────────────────────────────────────────────────────────

-- Um pagamento só pode gerar um depósito.
alter table depositos
  add constraint depositos_referencia_paysuite_unica
  unique (referencia_paysuite);

-- Uma inscrição por pessoa por ciclo.
alter table inscricoes
  add constraint inscricoes_usuario_ciclo_unica
  unique (usuario_id, ciclo_id);

-- Um sorteio por ciclo.
alter table sorteios
  add constraint sorteios_ciclo_unico
  unique (ciclo_id);


-- ─── 3. VERIFICAÇÃO PÓS-APLICAÇÃO ───────────────────────────────────────────

select conname, conrelid::regclass as tabela
from pg_constraint
where conname in (
  'depositos_referencia_paysuite_unica',
  'inscricoes_usuario_ciclo_unica',
  'sorteios_ciclo_unico'
);
-- Esperado: 3 linhas.
