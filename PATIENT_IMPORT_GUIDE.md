# Guia de Importação de Pacientes

## 📋 Visão Geral

Sistema completo de importação de pacientes integrado ao sistema principal da clínica. Permite:

1. **Digitalização de Fichas Físicas** - Upload de fotos que são automaticamente processadas usando OCR + IA
2. **Importação de Planilhas Excel** - Importação em massa via arquivos XLSX/CSV
3. **Merge Inteligente** - Prioriza dados existentes e evita duplicações

---

## 🏗️ Arquitetura

### Backend (TypeScript/Node.js)

```
server/
├── services/
│   ├── ocr.ts                    # Serviço de OCR (Google Cloud Vision API)
│   ├── aiExtraction.ts           # Extração de dados com OpenAI GPT-4o-mini
│   └── patientImport.ts          # Lógica de importação e merge
└── routes/
    └── patient-import.routes.ts  # Endpoints da API
```

### Frontend (React/TypeScript)

```
client/src/
└── pages/
    └── patient-import-page.tsx   # Interface de upload e importação
```

### APIs Externas

- **Google Cloud Vision API** - OCR (detecção de texto em imagens)
- **OpenAI API** - GPT-4o-mini (extração inteligente de dados)

---

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis ao arquivo `.env`:

```bash
# OpenAI API (já deve estar configurado)
OPENAI_API_KEY=sk-...

# Google Cloud Vision API
GOOGLE_APPLICATION_CREDENTIALS=path/to/google-credentials.json
```

### 2. Google Cloud Vision API

#### Passo 1: Criar Projeto no Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a **Cloud Vision API**:
   - Menu → APIs & Services → Library
   - Busque "Cloud Vision API"
   - Clique em "Enable"

#### Passo 2: Criar Credenciais

1. Menu → APIs & Services → Credentials
2. Clique em "Create Credentials" → "Service Account"
3. Preencha os detalhes:
   - Nome: `vision-ocr-service`
   - Role: `Cloud Vision API User`
4. Clique em "Create Key" → JSON
5. Salve o arquivo JSON no diretório do projeto

#### Passo 3: Configurar Path das Credenciais

```bash
# Linux/Mac
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"

# Windows (CMD)
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\credentials.json

# Windows (PowerShell)
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\credentials.json"

# .env (recomendado)
GOOGLE_APPLICATION_CREDENTIALS=./config/google-credentials.json
```

### 3. Instalar Dependências

As dependências já foram instaladas. Se necessário, execute:

```bash
npm install @google-cloud/vision xlsx multer @types/multer
```

---

## 🚀 Como Usar

### 1. Acessar a Página de Importação

Navegue para: `/pacientes/importar`

Ou adicione um botão na página de pacientes:

```tsx
<Button onClick={() => navigate('/pacientes/importar')}>
  <Upload className="w-4 h-4 mr-2" />
  Importar Pacientes
</Button>
```

### 2. Importação de Fichas Físicas (Fotos)

#### Passo a Passo

1. **Tire fotos das fichas** com boa iluminação e foco
2. **Faça upload** das imagens (PNG, JPG, JPEG, TIFF)
3. **Configure opções de merge** (opcional)
4. **Clique em "Importar"**
5. **Aguarde o processamento** (OCR + AI)
6. **Revise os resultados**

#### Dicas para Melhores Resultados

✅ **Boas Práticas:**
- Fotos bem iluminadas e focadas
- Fichas completas e legíveis
- Texto preferencialmente impresso ou letra de forma
- Máximo 50 imagens por upload

❌ **Evite:**
- Fotos borradas ou escuras
- Fichas dobradas ou amassadas
- Texto manuscrito ilegível
- Arquivos muito grandes (>20MB)

#### Campos Detectados Automaticamente

O sistema identifica automaticamente:

- ✅ Nome completo
- ✅ Telefone(s)
- ✅ Celular/WhatsApp
- ✅ Email
- ✅ CPF
- ✅ Data de nascimento
- ✅ Endereço completo
- ✅ Cidade, Estado, CEP
- ✅ Bairro

### 3. Importação de Planilhas Excel

#### Template XLSX

Baixe o template clicando no botão **"Baixe o template Excel"** na página de importação.

#### Colunas do Template

| Coluna | Obrigatório | Formato | Exemplo |
|--------|-------------|---------|---------|
| Nome | ✅ Sim | Texto | João Silva |
| Telefone | ⚪ Não | (XX) XXXX-XXXX | (11) 3333-4444 |
| Celular | ⚪ Não | (XX) XXXXX-XXXX | (11) 99999-8888 |
| Email | ⚪ Não | email@exemplo.com | joao@email.com |
| CPF | ⚪ Não | XXX.XXX.XXX-XX | 123.456.789-00 |
| Data de Nascimento | ⚪ Não | DD/MM/AAAA | 15/06/1985 |
| Endereço | ⚪ Não | Texto | Rua Principal 123 |
| Cidade | ⚪ Não | Texto | São Paulo |
| Estado | ⚪ Não | UF | SP |
| CEP | ⚪ Não | XXXXX-XXX | 01234-567 |
| Bairro | ⚪ Não | Texto | Centro |

#### Passo a Passo

1. **Preencha o template** com os dados dos pacientes
2. **Salve como XLSX** ou CSV
3. **Faça upload** do arquivo
4. **Configure opções de merge** (opcional)
5. **Clique em "Importar Planilha"**
6. **Revise os resultados**

---

## 🔧 Opções de Configuração

### Configurações de Merge

#### 1. Priorizar dados existentes

✅ **Ativado (padrão)**
- Mantém dados já cadastrados no banco
- Importa apenas campos novos ou vazios

❌ **Desativado**
- Sobrescreve todos os dados com informações importadas
- Útil para atualizar cadastros antigos

#### 2. Preencher campos vazios

✅ **Ativado (padrão)**
- Preenche campos vazios com dados importados
- Mantém dados existentes não vazios

❌ **Desativado**
- Não preenche campos vazios
- Útil para importar apenas novos pacientes

#### 3. Pular pacientes duplicados

✅ **Ativado**
- Ignora pacientes que já existem no banco
- Não atualiza nenhum dado

❌ **Desativado (padrão)**
- Atualiza pacientes existentes conforme configurações acima

---

## 🔍 Detecção de Duplicados

O sistema identifica duplicatas por:

### 1. CPF (Prioridade Máxima)
Se o CPF importado já existe no banco, o paciente é considerado duplicado.

### 2. Email
Se o email importado já existe no banco.

### 3. Nome + Telefone
Se o nome completo E telefone (ou celular) já existem no banco.

---

## 📊 Resultados da Importação

Após o processamento, você verá:

### Métricas

- ✅ **Importados** - Pacientes adicionados ou atualizados com sucesso
- ❌ **Falharam** - Registros com erros (dados inválidos, processamento falhou)
- ⚠️ **Ignorados** - Duplicatas puladas (se configurado)

### Erros

Lista detalhada de erros encontrados com:
- Número da linha/imagem
- Motivo do erro
- Detalhes para correção

---

## 🔬 Testando a Integração

### Endpoint de Teste OCR

Use o endpoint de teste para validar o OCR:

```bash
curl -X POST http://localhost:5000/api/v1/patients/import/test-ocr \
  -F "image=@/path/to/ficha.jpg" \
  -H "Cookie: connect.sid=..."
```

Resposta:

```json
{
  "message": "OCR processado",
  "ocr": {
    "text": "NOME: João Silva\nTELEFONE: (11) 99999-8888...",
    "confidence": 95.5
  },
  "extractedData": {
    "fullName": "João Silva",
    "cellphone": "(11) 99999-8888",
    ...
  }
}
```

---

## 🛠️ Troubleshooting

### Erro: "Tipo de arquivo não suportado"

**Causa:** Formato de imagem inválido

**Solução:** Use apenas PNG, JPG, JPEG ou TIFF

---

### Erro: "Erro ao processar OCR"

**Causa:** Credenciais do Google Cloud Vision inválidas ou API não ativada

**Solução:**
1. Verifique `GOOGLE_APPLICATION_CREDENTIALS` no `.env`
2. Confirme que a Cloud Vision API está ativada
3. Verifique se o arquivo JSON de credenciais existe

---

### Erro: "Falha ao processar extração AI"

**Causa:** Chave da OpenAI inválida ou limite de quota excedido

**Solução:**
1. Verifique `OPENAI_API_KEY` no `.env`
2. Confirme que há créditos disponíveis na conta OpenAI
3. Verifique os logs para mais detalhes

---

### OCR não detecta texto corretamente

**Soluções:**
1. **Melhore a qualidade da foto:**
   - Mais iluminação
   - Melhor foco
   - Maior resolução

2. **Verifique orientação:**
   - Foto deve estar na posição correta
   - Texto não deve estar de cabeça para baixo

3. **Teste com outra imagem:**
   - Use fotos diferentes da mesma ficha
   - Tente escanear em vez de fotografar

---

### Dados extraídos incorretamente

**Causa:** IA interpretou mal o texto OCR

**Solução:**
1. **Melhore a ficha original:**
   - Use letra de forma
   - Escreva com caneta preta
   - Separe claramente os campos

2. **Revise manualmente:**
   - Após importação, revise os dados
   - Corrija campos incorretos

3. **Use template XLSX:**
   - Para dados críticos, prefira importação manual via Excel

---

## 📈 Limites e Restrições

### Limites por Upload

| Tipo | Limite |
|------|--------|
| Imagens por upload | 50 |
| Tamanho por imagem | 20 MB |
| Tamanho total | 1 GB |
| Linhas por XLSX | Ilimitado |

### Custos APIs

#### Google Cloud Vision API
- **Gratuito:** Primeiras 1.000 unidades/mês
- **Pago:** $1.50 por 1.000 unidades adicionais

#### OpenAI API (GPT-4o-mini)
- **Input:** $0.00015 por 1K tokens (~$0.01 por 100 fichas)
- **Output:** $0.0006 por 1K tokens

---

## 🎯 Próximas Melhorias

- [ ] Preview antes de importar (confirmar dados extraídos)
- [ ] Suporte a PDF (fichas digitalizadas)
- [ ] Processamento em background (para grandes volumes)
- [ ] Histórico de importações
- [ ] Exportação de relatórios
- [ ] Validação avançada de CPF e email

---

## 🆘 Suporte

Se encontrar problemas:

1. **Verifique os logs do servidor** para erros detalhados
2. **Consulte a documentação** das APIs externas
3. **Teste com dados de exemplo** primeiro
4. **Entre em contato** com o desenvolvedor

---

## 📝 Changelog

### v1.0.0 (2025-01-15)
- ✅ Implementação inicial
- ✅ OCR com Google Cloud Vision
- ✅ Extração AI com OpenAI GPT-4o-mini
- ✅ Importação XLSX/CSV
- ✅ Merge inteligente
- ✅ Interface UI completa
- ✅ Detecção de duplicados

---

**Desenvolvido com ❤️ para facilitar a digitalização de fichas de pacientes**
