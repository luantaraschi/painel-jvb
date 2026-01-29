# Implementação de Permissões e Auditoria

O sistema foi atualizado para suportar perfis de usuários (Admin vs Usuário) e logs de auditoria.

## 1. Alterações no Banco de Dados (Supabase)

Para que as funcionalidades funcionem, execute o conteúdo do arquivo `supabase_migration.sql` no SQL Editor do seu projeto Supabase.

Isso irá:
- Adicionar colunas `status_aprovacao` e `responsavel_id` na tabela `processos`.
- Criar a tabela `audit_logs`.
- Criar políticas de segurança (RLS) para proteger os dados.

## 2. Funcionalidades Implementadas

### Admin
- **Visualização Completa**: Vê todos os processos.
- **Filtro de Aprovação**: Nova opção no filtro de status "🛡️ Aguardando Aprovação" para ver processos pendentes.
- **Exclusão**: Apenas admins veem o botão de lixeira nos cards de processo.
- **Log de Auditoria**: Ações de exclusão e alteração de status são registradas.

### Usuário Comum
- **Visualização Restrita**: Vê apenas processos aprovados (`status_aprovacao = 'approved'`) OU processos que ele mesmo importou/é responsável.
- **Sem Exclusão**: Não pode excluir processos.
- **Upload**: Processos importados por usuários entram como `pending` (pendente de aprovação) por padrão (dependendo da configuração do banco, o padrão é 'pending').

## 3. Detalhes Técnicos

- **Frontend**:
  - `App.jsx`: Lógica de autenticação busca o perfil na tabela `profiles`.
  - `ProcessCard`: Botão de delete condicional.
  - `handleFileUpload`: Envia `user_id` e `role` para o webhook (N8N pode usar isso futuramente).
  - `logAction`: Função auxiliar para salvar logs no Supabase.

- **Backend (Supabase)**:
  - Tabela `profiles` define quem é admin (`role = 'admin'`).
  - Tabela `audit_logs` guarda histórico.
