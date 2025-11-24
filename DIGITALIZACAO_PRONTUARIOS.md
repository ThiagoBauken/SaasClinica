# Digitalização de Prontuários - Sistema Integrado

## 📋 Visão Geral

A funcionalidade de **Digitalização de Prontuários** foi migrada do sistema antigo (dentistav1) e totalmente integrada ao sistema SaaS unificado. Esta funcionalidade permite digitalizar fichas físicas de pacientes através de fotos, extraindo automaticamente os dados usando OCR e IA.

## ✅ Status da Implementação

**COMPLETO** - Todas as funcionalidades foram implementadas e integradas.

### Componentes Implementados

- ✅ Página de digitalização no frontend (React/TypeScript)
- ✅ Upload de múltiplas imagens com drag-and-drop
- ✅ Integração com Google Cloud Vision API (OCR)
- ✅ Processamento com DeepSeek AI (econômico e eficiente)
- ✅ Salvamento automático no banco de dados
- ✅ Exportação para Excel, CSV e JSON
- ✅ Rota adicionada na navegação de pacientes
- ✅ Backend completo com processamento assíncrono

## 🎯 Funcionalidades

### 1. Upload de Imagens
- **Drag and Drop** de múltiplas imagens
- Suporte para: PNG, JPG, JPEG, TIFF, WEBP
- Preview das imagens selecionadas
- Remoção individual de arquivos
- Limite de 10MB por arquivo

### 2. Processamento Inteligente
- **OCR**: Extração de texto usando Google Cloud Vision API
- **IA**: Processamento com DeepSeek para estruturação dos dados
- Campos extraídos automaticamente:
  - Nome completo
  - Telefone
  - Email
  - CPF
  - Data de nascimento
  - Endereço completo

### 3. Opções de Saída
- **Salvar no Banco**: Integração direta com banco de pacientes
- **Exportar Excel**: Arquivo XLSX com dados estruturados
- **Exportar CSV**: Formato CSV para importação
- **Exportar JSON**: Dados em formato JSON

### 4. Modelos de IA
- **DeepSeek Chat**: Rápido e econômico (recomendado)
- **DeepSeek Reasoner**: Mais preciso para casos complexos

## 📍 Como Acessar

1. Acesse o sistema
2. Vá para **Pacientes**
3. Clique no botão **"Digitalizar Prontuários"**
4. OU acesse diretamente: `/pacientes/digitalizar`

## 🔧 Configuração

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis no arquivo `.env`:

```bash
# DeepSeek API (RECOMENDADO - 95% mais barato que OpenAI!)
# Obter em: https://platform.deepseek.com/
DEEPSEEK_API_KEY=sk-...

# Google Cloud Vision API (para OCR)
# Caminho para o arquivo JSON de credenciais do Service Account
GOOGLE_APPLICATION_CREDENTIALS=./config/google-vision-credentials.json
```

### 2. Configurar Google Cloud Vision

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto ou selecione um existente
3. Ative a **Cloud Vision API**
4. Crie um **Service Account** com role "Cloud Vision API User"
5. Baixe o arquivo JSON das credenciais
6. Salve em `./config/google-vision-credentials.json`

### 3. Configurar DeepSeek

1. Acesse [DeepSeek Platform](https://platform.deepseek.com/)
2. Crie uma conta
3. Gere uma API Key
4. Adicione no `.env` como `DEEPSEEK_API_KEY`

## 💰 Custos Estimados

### DeepSeek (Recomendado)
- **Chat Model**: ~R$ 0,30 por 1.000 fichas processadas
- **Reasoner Model**: ~R$ 0,50 por 1.000 fichas processadas
- **95% mais barato que OpenAI**

### Google Cloud Vision
- **OCR**: Primeiras 1.000 unidades/mês GRÁTIS
- Após isso: ~R$ 7,50 por 1.000 unidades

### Exemplo de Custo Total
- Digitalizar 1.000 fichas: ~R$ 7,80 (OCR + IA)
- Cobrar do cliente: R$ 30,00 por 1.000 fichas
- **Lucro: R$ 22,20 por 1.000 fichas (74% de margem)**

## 🔒 Segurança

- Upload limitado a 10MB por arquivo
- Validação de tipos de arquivo permitidos
- Arquivos são deletados após processamento
- Integração com sistema de autenticação
- Dados salvos apenas na empresa do usuário logado

## 📁 Arquivos Criados/Modificados

### Frontend
- `client/src/pages/patient-digitization-page.tsx` - Página principal
- `client/src/core/DynamicRouter.tsx` - Rota adicionada
- `client/src/pages/patients-page.tsx` - Botão de acesso adicionado

### Backend
- `server/routes/patient-digitization.routes.ts` - Rotas de digitalização
- `server/routes/index.ts` - Registro das rotas

### Dependências Instaladas
```json
{
  "multer": "^1.4.5-lts.1",
  "@google-cloud/vision": "^4.3.2",
  "@types/multer": "^1.4.12"
}
```

## 🚀 Como Usar

### 1. Upload de Imagens
- Arraste e solte imagens na área designada
- OU clique para selecionar arquivos
- Visualize as imagens selecionadas

### 2. Configurar Processamento
- Escolha o modelo de IA (DeepSeek Chat ou Reasoner)
- Selecione o formato de saída (Banco, Excel, CSV, JSON)
- (Opcional) Adicione um prompt personalizado

### 3. Processar
- Clique em **"Processar Imagens"**
- Aguarde o processamento (mostra progresso)
- Visualize os resultados extraídos

### 4. Resultados
- Pacientes extraídos são exibidos na tela
- Se "Salvar no Banco" estiver selecionado, dados são salvos automaticamente
- Outros formatos geram arquivo para download

## 📊 Campos Extraídos

| Campo | Descrição | Obrigatório |
|-------|-----------|-------------|
| Nome | Nome completo do paciente | ✅ Sim |
| Telefone | Telefone de contato | ❌ Não |
| Email | Email do paciente | ❌ Não |
| CPF | CPF (formato brasileiro) | ❌ Não |
| Data de Nascimento | Data no formato DD/MM/AAAA | ❌ Não |
| Endereço | Endereço completo | ❌ Não |

## 🐛 Troubleshooting

### Erro: "Google Cloud Vision not configured"
**Solução**: Configure a variável `GOOGLE_APPLICATION_CREDENTIALS` no `.env`

### Erro: "DeepSeek API key not configured"
**Solução**: Configure a variável `DEEPSEEK_API_KEY` no `.env`

### Erro: "Nenhum texto encontrado"
**Solução**:
- Verifique se a imagem está legível
- Tente aumentar a qualidade da foto
- Certifique-se de que o texto está em português

### Processamento muito lento
**Solução**:
- Use o modelo "DeepSeek Chat" ao invés do "Reasoner"
- Reduza o número de imagens por lote
- Verifique sua conexão com a internet

## 🔄 Migração do Sistema Antigo

Esta funcionalidade foi **completamente migrada** do sistema antigo `dentistav1` para o sistema atual. As principais melhorias incluem:

- ✅ Interface moderna em React/TypeScript
- ✅ Integração com banco de dados unificado
- ✅ Uso de DeepSeek ao invés de OpenAI (95% mais barato)
- ✅ Sistema de autenticação integrado
- ✅ Multi-empresa (cada clínica tem seus dados isolados)
- ✅ Upload mais robusto com drag-and-drop
- ✅ Melhor tratamento de erros
- ✅ Processamento assíncrono

## 📝 Próximos Passos (Opcional)

- [ ] Adicionar suporte para processamento em lote de pastas
- [ ] Implementar fila de processamento para grandes volumes
- [ ] Adicionar histórico de digitalizações
- [ ] Criar relatórios de uso e custos
- [ ] Implementar review manual antes de salvar no banco

## 📞 Suporte

Para problemas ou dúvidas, consulte:
- Documentação das APIs: `.env.example`
- Código fonte: `server/routes/patient-digitization.routes.ts`
- Frontend: `client/src/pages/patient-digitization-page.tsx`
