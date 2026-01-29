-- Executar no SQL Editor do Supabase

-- 1. Adicionar colunas necessárias na tabela processos
ALTER TABLE processos 
ADD COLUMN IF NOT EXISTS status_aprovacao text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id);

-- 2. Tabela de Logs de Auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    action text NOT NULL,
    target_id text, -- ID do processo pode ser texto ou uuid, dependendo da sua tabela
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS em audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Permitir que todos os usuários autenticados criem logs
CREATE POLICY "Enable insert for authenticated users" 
ON audit_logs FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Apenas admins podem ver logs
CREATE POLICY "Admins can view logs" 
ON audit_logs FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 3. Políticas de Segurança (RLS) para Processos

-- Habilitar RLS em processos
ALTER TABLE processos ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar se é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Política: Admin pode fazer TUDO
CREATE POLICY "Admins full access" 
ON processos 
TO authenticated 
USING (is_admin()) 
WITH CHECK (is_admin());

-- Política: Usuários Comuns só podem VER (SELECT) e apenas os seus processos (ou todos, se preferir)
-- Opção A: Usuário vê apenas processos onde é responsável
-- CREATE POLICY "Users view own processes" 
-- ON processos FOR SELECT 
-- TO authenticated 
-- USING (responsavel_id = auth.uid());

-- Opção B: Usuário vê processos aprovados (leitura pública interna) e os seus pendentes
CREATE POLICY "Users view approved or own" 
ON processos FOR SELECT 
TO authenticated 
USING (
  (status_aprovacao = 'approved') OR 
  (responsavel_id = auth.uid()) OR
  (is_admin()) -- Redundante se tiver a politica acima, mas garante
);

-- Política: Usuários podem criar (INSERT) processos (via upload)
CREATE POLICY "Users can insert processes" 
ON processos FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Política: Usuários NÃO podem deletar (DELETE)
-- (Como não criamos política de DELETE para não-admins, fica bloqueado por padrão)

-- Política: Usuários podem atualizar (UPDATE) certos campos se forem responsáveis
CREATE POLICY "Users update own processes" 
ON processos FOR UPDATE 
TO authenticated 
USING (responsavel_id = auth.uid())
WITH CHECK (responsavel_id = auth.uid());
