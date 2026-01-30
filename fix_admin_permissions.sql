-- 1. Garantir que a coluna 'status' existe
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- 2. Habilitar RLS na tabela profiles (caso não esteja)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Criar função auxiliar para checar se é admin (se não existir)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Remover políticas antigas de UPDATE para evitar conflitos
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;

-- 5. Criar política para permitir que ADMINS atualizem QUALQUER perfil
CREATE POLICY "Admins can update all profiles" 
ON profiles FOR UPDATE
TO authenticated
USING ( is_admin() )
WITH CHECK ( is_admin() );

-- 6. Criar política para permitir que usuários atualizem APENAS SEU PRÓPRIO perfil
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE
TO authenticated
USING ( auth.uid() = id )
WITH CHECK ( auth.uid() = id );

-- 7. Permitir leitura pública dos perfis (necessário para o admin listar os usuários)
CREATE POLICY "Profiles are viewable by everyone" 
ON profiles FOR SELECT 
TO authenticated 
USING ( true );
