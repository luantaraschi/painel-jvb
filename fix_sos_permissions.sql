-- Permissões / RLS para a Central SOS (chamados_sos)
-- Objetivo:
-- - Usuário autenticado consegue registrar e ver apenas os próprios chamados
-- - Admin consegue ver/atualizar/deletar todos
--
-- Requisitos:
-- - A tabela `chamados_sos` já deve existir
-- - A função `is_admin()` deve existir (veja `fix_admin_permissions.sql`)

-- Garantir colunas esperadas pelo frontend (idempotente)
-- Observação: se você já possui essas colunas com tipos diferentes, ajuste manualmente.
ALTER TABLE chamados_sos
	ADD COLUMN IF NOT EXISTS screenshots jsonb DEFAULT '[]'::jsonb;

ALTER TABLE chamados_sos
	ADD COLUMN IF NOT EXISTS status text DEFAULT 'aberto';

ALTER TABLE chamados_sos ENABLE ROW LEVEL SECURITY;

-- Idempotência: remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "SOS: users can insert own" ON chamados_sos;
DROP POLICY IF EXISTS "SOS: users can view own or admin" ON chamados_sos;
DROP POLICY IF EXISTS "SOS: admins can update" ON chamados_sos;
DROP POLICY IF EXISTS "SOS: admins can delete" ON chamados_sos;

-- Usuário cria chamado SOMENTE para si
CREATE POLICY "SOS: users can insert own"
ON chamados_sos
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Usuário vê os próprios; admin vê todos
CREATE POLICY "SOS: users can view own or admin"
ON chamados_sos
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin());

-- Admin pode atualizar status/SLA/etc
CREATE POLICY "SOS: admins can update"
ON chamados_sos
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Admin pode deletar se precisar (opcional)
CREATE POLICY "SOS: admins can delete"
ON chamados_sos
FOR DELETE
TO authenticated
USING (is_admin());
