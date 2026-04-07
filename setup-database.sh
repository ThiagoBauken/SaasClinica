#!/bin/bash

# =====================================================
# Script de Setup Automático do Banco de Dados
# Sistema de Gestão de Clínica Odontológica
# =====================================================

set -e  # Parar em caso de erro

echo "🗄️  Setup do Banco de Dados - Sistema Clínica Dentista"
echo "======================================================"
echo ""

# Verificar se .env existe
if [ ! -f .env ]; then
    echo "❌ Arquivo .env não encontrado!"
    echo "📝 Copie o arquivo .env.example para .env e configure DATABASE_URL"
    exit 1
fi

# Carregar variáveis do .env
export $(cat .env | grep -v '^#' | xargs)

# Verificar se DATABASE_URL está configurado
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL não configurado no .env!"
    echo "📝 Adicione DATABASE_URL=postgresql://user:password@host:port/database"
    exit 1
fi

echo "✅ Configuração encontrada"
echo "🔗 Conectando em: ${DATABASE_URL%%@*}@***"
echo ""

# Perguntar qual tipo de setup
echo "Escolha o tipo de setup:"
echo "1) Setup completo (banco novo - cria todas as 67 tabelas)"
echo "2) Adicionar apenas campos do Google Calendar (banco existente)"
echo "3) Usar Drizzle Push (recomendado)"
echo ""
read -p "Digite sua escolha (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Executando setup completo..."
        echo ""

        # Verificar se psql está disponível
        if ! command -v psql &> /dev/null; then
            echo "❌ psql não encontrado!"
            echo "📦 Instale o PostgreSQL client"
            exit 1
        fi

        # Executar script de deployment
        psql "$DATABASE_URL" -f server/scripts/deploy-database.sql

        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ Banco de dados criado com sucesso!"
            echo ""
            echo "📊 67 tabelas criadas"
            echo "🔐 Campos do Google Calendar incluídos"
            echo ""
        else
            echo "❌ Erro ao criar banco de dados"
            exit 1
        fi
        ;;

    2)
        echo ""
        echo "🔄 Adicionando campos do Google Calendar..."
        echo ""

        if ! command -v psql &> /dev/null; then
            echo "❌ psql não encontrado!"
            exit 1
        fi

        psql "$DATABASE_URL" -f migrations/add_google_calendar_tokens.sql

        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ Campos adicionados com sucesso!"
            echo ""
        else
            echo "❌ Erro ao adicionar campos"
            exit 1
        fi
        ;;

    3)
        echo ""
        echo "🚀 Usando Drizzle Kit Push..."
        echo ""

        npm run db:push

        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ Schema sincronizado com sucesso!"
            echo ""
        else
            echo "❌ Erro ao sincronizar schema"
            exit 1
        fi
        ;;

    *)
        echo "❌ Opção inválida!"
        exit 1
        ;;
esac

# Perguntar se quer popular dados iniciais
echo ""
read -p "Deseja popular dados iniciais (seed)? (s/n): " seed_choice

if [ "$seed_choice" = "s" ] || [ "$seed_choice" = "S" ]; then
    echo ""
    echo "🌱 Populando dados iniciais..."
    npm run db:seed

    if [ $? -eq 0 ]; then
        echo "✅ Dados iniciais criados!"
    else
        echo "⚠️  Erro ao criar dados iniciais (pode ser normal se já existirem)"
    fi
fi

echo ""
echo "======================================================"
echo "✅ Setup do banco de dados concluído!"
echo ""
echo "📝 Próximos passos:"
echo "   1. Configure as credenciais de APIs no .env"
echo "   2. Execute: npm run dev"
echo "   3. Acesse: http://localhost:5000"
echo ""
echo "🔐 Segurança:"
echo "   - Configure SESSION_SECRET único"
echo "   - Use SSL em produção (sslmode=require)"
echo "   - Configure backups regulares"
echo ""
echo "======================================================"
