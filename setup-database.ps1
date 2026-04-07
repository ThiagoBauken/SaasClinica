# =====================================================
# Script de Setup Automático do Banco de Dados (Windows)
# Sistema de Gestão de Clínica Odontológica
# =====================================================

$ErrorActionPreference = "Stop"

Write-Host "🗄️  Setup do Banco de Dados - Sistema Clínica Dentista" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se .env existe
if (-Not (Test-Path .env)) {
    Write-Host "❌ Arquivo .env não encontrado!" -ForegroundColor Red
    Write-Host "📝 Copie o arquivo .env.example para .env e configure DATABASE_URL" -ForegroundColor Yellow
    exit 1
}

# Carregar variáveis do .env
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($key, $value)
    }
}

$DATABASE_URL = $env:DATABASE_URL

# Verificar se DATABASE_URL está configurado
if ([string]::IsNullOrEmpty($DATABASE_URL)) {
    Write-Host "❌ DATABASE_URL não configurado no .env!" -ForegroundColor Red
    Write-Host "📝 Adicione DATABASE_URL=postgresql://user:password@host:port/database" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Configuração encontrada" -ForegroundColor Green
$maskedUrl = $DATABASE_URL -replace '(://[^:]+:)[^@]+(@)', '$1***$2'
Write-Host "🔗 Conectando em: $maskedUrl" -ForegroundColor Cyan
Write-Host ""

# Menu de escolha
Write-Host "Escolha o tipo de setup:" -ForegroundColor Yellow
Write-Host "1) Setup completo (banco novo - cria todas as 67 tabelas)"
Write-Host "2) Adicionar apenas campos do Google Calendar (banco existente)"
Write-Host "3) Usar Drizzle Push (recomendado)"
Write-Host ""

$choice = Read-Host "Digite sua escolha (1-3)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "🚀 Executando setup completo..." -ForegroundColor Cyan
        Write-Host ""

        # Verificar se psql está disponível
        try {
            $null = Get-Command psql -ErrorAction Stop
        }
        catch {
            Write-Host "❌ psql não encontrado!" -ForegroundColor Red
            Write-Host "📦 Instale o PostgreSQL client" -ForegroundColor Yellow
            Write-Host "   Download: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
            exit 1
        }

        # Executar script de deployment
        try {
            & psql $DATABASE_URL -f server/scripts/deploy-database.sql

            Write-Host ""
            Write-Host "✅ Banco de dados criado com sucesso!" -ForegroundColor Green
            Write-Host ""
            Write-Host "📊 67 tabelas criadas" -ForegroundColor Cyan
            Write-Host "🔐 Campos do Google Calendar incluídos" -ForegroundColor Cyan
            Write-Host ""
        }
        catch {
            Write-Host "❌ Erro ao criar banco de dados" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
            exit 1
        }
    }

    "2" {
        Write-Host ""
        Write-Host "🔄 Adicionando campos do Google Calendar..." -ForegroundColor Cyan
        Write-Host ""

        try {
            $null = Get-Command psql -ErrorAction Stop
        }
        catch {
            Write-Host "❌ psql não encontrado!" -ForegroundColor Red
            exit 1
        }

        try {
            & psql $DATABASE_URL -f migrations/add_google_calendar_tokens.sql

            Write-Host ""
            Write-Host "✅ Campos adicionados com sucesso!" -ForegroundColor Green
            Write-Host ""
        }
        catch {
            Write-Host "❌ Erro ao adicionar campos" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
            exit 1
        }
    }

    "3" {
        Write-Host ""
        Write-Host "🚀 Usando Drizzle Kit Push..." -ForegroundColor Cyan
        Write-Host ""

        try {
            npm run db:push

            Write-Host ""
            Write-Host "✅ Schema sincronizado com sucesso!" -ForegroundColor Green
            Write-Host ""
        }
        catch {
            Write-Host "❌ Erro ao sincronizar schema" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
            exit 1
        }
    }

    default {
        Write-Host "❌ Opção inválida!" -ForegroundColor Red
        exit 1
    }
}

# Perguntar se quer popular dados iniciais
Write-Host ""
$seedChoice = Read-Host "Deseja popular dados iniciais (seed)? (s/n)"

if ($seedChoice -eq "s" -or $seedChoice -eq "S") {
    Write-Host ""
    Write-Host "🌱 Populando dados iniciais..." -ForegroundColor Cyan

    try {
        npm run db:seed
        Write-Host "✅ Dados iniciais criados!" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Erro ao criar dados iniciais (pode ser normal se já existirem)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "✅ Setup do banco de dados concluído!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Próximos passos:" -ForegroundColor Yellow
Write-Host "   1. Configure as credenciais de APIs no .env"
Write-Host "   2. Execute: npm run dev"
Write-Host "   3. Acesse: http://localhost:5000"
Write-Host ""
Write-Host "🔐 Segurança:" -ForegroundColor Yellow
Write-Host "   - Configure SESSION_SECRET único"
Write-Host "   - Use SSL em produção (sslmode=require)"
Write-Host "   - Configure backups regulares"
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
