-- =====================================================
-- SCRIPT DE DEPLOYMENT COMPLETO DO BANCO DE DADOS
-- Sistema de Gestão de Clínica Odontológica
-- =====================================================
-- Data: 2025-11-16
-- Versão: 1.0.0
--
-- Este script cria TODAS as 67 tabelas do sistema
-- incluindo os novos campos do Google Calendar
-- =====================================================

-- IMPORTANTE: Execute este script em um banco de dados vazio
-- Se o banco já existe, use o script de migração separado

-- =====================================================
-- CONFIGURAÇÕES INICIAIS
-- =====================================================

-- Garantir que estamos usando UTF-8
SET client_encoding = 'UTF8';

-- Mostrar mensagens de progresso
\timing on
\set ON_ERROR_STOP on

-- =====================================================
-- INÍCIO DA CRIAÇÃO DAS TABELAS
-- =====================================================

\echo '🚀 Iniciando criação das tabelas...'
\echo ''

-- Carregar o arquivo de migração completo
\i migrations/0000_dark_jean_grey.sql

\echo ''
\echo '✅ Todas as tabelas foram criadas com sucesso!'
\echo ''

-- =====================================================
-- VERIFICAÇÃO PÓS-DEPLOYMENT
-- =====================================================

\echo '📊 Verificando tabelas criadas...'
\echo ''

-- Listar todas as tabelas criadas
SELECT
    schemaname,
    tablename,
    CASE
        WHEN tablename LIKE '%users%' THEN '👤 Usuários'
        WHEN tablename LIKE '%patient%' THEN '🏥 Pacientes'
        WHEN tablename LIKE '%appointment%' THEN '📅 Agendamentos'
        WHEN tablename LIKE '%financial%' THEN '💰 Financeiro'
        WHEN tablename LIKE '%inventory%' THEN '📦 Estoque'
        WHEN tablename LIKE '%prosthesis%' THEN '🦷 Próteses'
        WHEN tablename LIKE '%automation%' THEN '🤖 Automações'
        ELSE '📋 Outras'
    END as categoria
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY categoria, tablename;

\echo ''
\echo '📊 Contagem de tabelas por categoria:'
\echo ''

SELECT
    CASE
        WHEN tablename LIKE '%users%' OR tablename LIKE '%roles%' OR tablename LIKE '%permissions%' THEN 'Usuários e Permissões'
        WHEN tablename LIKE '%patient%' OR tablename LIKE '%anamnesis%' OR tablename LIKE '%exam%' THEN 'Pacientes e Prontuário'
        WHEN tablename LIKE '%appointment%' THEN 'Agendamentos'
        WHEN tablename LIKE '%financial%' OR tablename LIKE '%payment%' OR tablename LIKE '%subscription%' THEN 'Financeiro e Cobrança'
        WHEN tablename LIKE '%inventory%' THEN 'Estoque'
        WHEN tablename LIKE '%prosthesis%' THEN 'Próteses'
        WHEN tablename LIKE '%automation%' THEN 'Automações'
        WHEN tablename LIKE '%treatment%' OR tablename LIKE '%procedure%' OR tablename LIKE '%odontogram%' THEN 'Tratamentos'
        WHEN tablename LIKE '%company%' OR tablename LIKE '%clinic%' THEN 'Empresas e Clínicas'
        ELSE 'Outras'
    END as categoria,
    COUNT(*) as total
FROM pg_tables
WHERE schemaname = 'public'
GROUP BY categoria
ORDER BY total DESC;

\echo ''
\echo '🔍 Verificando campos do Google Calendar...'
\echo ''

-- Verificar se os campos do Google Calendar foram criados
SELECT
    column_name,
    data_type,
    is_nullable,
    CASE
        WHEN column_name = 'google_access_token' THEN '✅ Token de acesso OAuth'
        WHEN column_name = 'google_refresh_token' THEN '✅ Token de renovação OAuth'
        WHEN column_name = 'google_token_expiry' THEN '✅ Data de expiração do token'
        WHEN column_name = 'google_calendar_id' THEN '✅ ID do calendário'
        ELSE ''
    END as descricao
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name LIKE 'google%'
ORDER BY column_name;

\echo ''
\echo '📈 Estatísticas gerais do banco:'
\echo ''

-- Estatísticas gerais
SELECT
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as total_tabelas,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public') as total_colunas,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as total_indices;

\echo ''
\echo '✅ DEPLOYMENT COMPLETO!'
\echo ''
\echo '📝 Próximos passos:'
\echo '1. Execute npm run db:seed para popular dados iniciais'
\echo '2. Configure as credenciais no arquivo .env'
\echo '3. Inicie o servidor com npm run dev'
\echo ''
\echo '🔐 Lembre-se de:'
\echo '- Configurar SESSION_SECRET único no .env'
\echo '- Habilitar SSL para o banco em produção'
\echo '- Configurar backups regulares'
\echo ''

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================
