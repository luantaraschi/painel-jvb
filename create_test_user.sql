-- 1. Habilitar extensão de criptografia (caso não tenha)
create extension if not exists pgcrypto;

-- 2. (Opcional) Limpar usuário de teste anterior se existir falha
DELETE FROM auth.users WHERE email = 'teste@teste.com';

-- 3. Inserir APENAS na tabela de autenticação
-- A trigger do seu banco ("handle_new_user") vai criar o profile automaticamente
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_super_admin
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'teste@teste.com',
    crypt('teste123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Usuário Teste"}',
    now(),
    now(),
    false
);
