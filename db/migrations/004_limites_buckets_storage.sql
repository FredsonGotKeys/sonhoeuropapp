-- APLICADA em 2026-09-20 (migração `limites_de_tamanho_e_tipo_nos_buckets`).
-- Ver db/README.md.
--
-- Nenhum dos três buckets tinha limite de tamanho nem restrição de tipo, e os
-- uploads de comprovativos e verificações vão DIRECTOS do browser para o
-- Storage com a chave anónima. Toda a validação vivia no cliente, onde é
-- contornável chamando a API do Storage sem passar pela interface.
--
-- Em comprovativos era pior: a política deixa qualquer utilizador autenticado
-- escrever qualquer ficheiro com qualquer nome, e o bucket é público. Dava
-- para encher a quota do projecto, ou alojar conteúdo arbitrário servido a
-- partir de um domínio associado ao projecto.
--
-- Os valores acompanham o que a interface já pedia, para não recusar nada que
-- hoje funciona.

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif']
where id = 'comprovativos';

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif']
where id = 'verificacoes';

-- contratos recebe PDFs gerados no servidor (app/actions/contrato.ts:308, com
-- contentType 'application/pdf' explícito).
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf']
where id = 'contratos';
