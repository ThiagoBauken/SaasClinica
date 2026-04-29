# Integração N8N com OpenAI - Documentação

## Visão Geral

Este sistema permite que cada clínica configure sua própria chave OpenAI para usar em automações N8N. A chave é armazenada de forma segura no banco de dados e pode ser acessada pelo N8N através de endpoints específicos.

## Arquitetura

### Frontend
- **Página de Configuração**: [configuracoes-clinica.tsx](client/src/pages/configuracoes-clinica.tsx)
  - Nova aba "Automações" com formulário para inserir chave OpenAI e URL do webhook N8N
  - Validação de formato da chave (deve começar com "sk-")
  - Máscara de segurança mostrando apenas os últimos 4 caracteres
  - Indicador visual se a chave está configurada

### Backend
- **Endpoints API**: [company-settings.routes.ts](server/routes/company-settings.routes.ts)
  - `GET /api/v1/company/settings` - Busca configurações (com chave mascarada)
  - `PATCH /api/v1/company/settings` - Atualiza configurações (apenas admin)
  - `POST /api/v1/company/openai-key` - Endpoint interno para N8N buscar chave completa

### Banco de Dados
- **Schema**: [schema.ts](shared/schema.ts)
  - Campo `openaiApiKey` na tabela `companies`
  - Campo `n8nWebhookUrl` na tabela `companies`
- **Migration**: [005_add_openai_to_companies.sql](server/migrations/005_add_openai_to_companies.sql)

## Como Usar no N8N

### 1. Configurar a Chave OpenAI no Sistema

1. Acesse o sistema como administrador
2. Vá em "Configurações da Clínica" → aba "Automações"
3. Insira sua chave OpenAI (obtida em https://platform.openai.com/api-keys)
4. (Opcional) Insira a URL do webhook N8N
5. Clique em "Salvar Automações"

### 2. Criar Workflow N8N

#### Passo 1: Obter a Chave OpenAI

No seu workflow N8N, adicione um nó HTTP Request para buscar a chave OpenAI:

```json
{
  "method": "POST",
  "url": "https://seu-sistema.com/api/v1/company/openai-key",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "companyId": "{{ $json.companyId }}"
  }
}
```

**Resposta esperada:**
```json
{
  "companyId": 1,
  "openaiApiKey": "sk-proj-abc123..."
}
```

#### Passo 2: Usar a Chave em Nodes OpenAI

Use a chave obtida em qualquer nó da OpenAI no N8N:

```javascript
// No campo "API Key" do nó OpenAI
{{ $node["HTTP Request"].json.openaiApiKey }}
```

### Exemplo de Workflow Completo

```
1. Webhook (recebe evento do sistema)
   ↓
2. HTTP Request (busca chave OpenAI da empresa)
   ↓
3. OpenAI Chat (usa a chave obtida)
   ↓
4. Envio de Mensagem (WhatsApp/Email)
```

## Segurança

### Armazenamento
- As chaves são armazenadas no banco de dados PostgreSQL
- **Recomendação**: Implemente criptografia em nível de coluna para maior segurança
- A API nunca retorna a chave completa em endpoints públicos (apenas mascarada)

### Validação
- Apenas usuários com role `admin` ou `superadmin` podem atualizar as chaves
- Validação de formato: chave deve começar com "sk-"
- Validação de URL para o webhook N8N

### Endpoint Interno
O endpoint `/api/v1/company/openai-key` é interno e deve ser protegido:

**Implementar autenticação do N8N (TODO):**
```typescript
// Descomentar no código server/routes/company-settings.routes.ts
if (webhookSecret && webhookSecret !== process.env.N8N_WEBHOOK_SECRET) {
  return res.status(403).json({ error: 'Invalid webhook secret' });
}
```

**Configurar no .env:**
```env
N8N_WEBHOOK_SECRET=seu-secret-super-seguro-aqui
```

**Enviar no N8N:**
```json
{
  "companyId": 1,
  "webhookSecret": "{{ $env.N8N_WEBHOOK_SECRET }}"
}
```

## Automações Disponíveis

Com a integração OpenAI + N8N, você pode criar:

1. **Confirmação Automática de Consultas**
   - Trigger: Nova consulta agendada
   - Ação: Enviar mensagem WhatsApp personalizada com IA

2. **Lembretes Inteligentes**
   - Trigger: 24h antes da consulta
   - Ação: Gerar lembrete personalizado baseado no histórico do paciente

3. **Resumos de Atendimento**
   - Trigger: Consulta finalizada
   - Ação: Gerar resumo automático do atendimento

4. **Análise de Sentimento**
   - Trigger: Feedback recebido
   - Ação: Analisar sentimento e categorizar

5. **Sugestões de Tratamento**
   - Trigger: Novo prontuário criado
   - Ação: Sugerir tratamentos baseados em diagnóstico

## Monitoramento

### Dashboard OpenAI
Monitore o uso da chave em: https://platform.openai.com/usage

**Recomendações:**
- Configure limites de uso mensal
- Ative alertas de gastos
- Revise logs de uso regularmente

### Logs do Sistema
Os endpoints registram logs de acesso. Monitore:
- Tentativas de acesso não autorizadas
- Mudanças nas configurações
- Uso anormal da API

## Troubleshooting

### Chave não está funcionando
1. Verifique se a chave começa com "sk-"
2. Confirme que a chave está ativa no painel da OpenAI
3. Verifique se há créditos disponíveis na conta OpenAI

### Erro 403 ao buscar a chave
1. Verifique se o `companyId` está correto
2. Confirme que a empresa tem uma chave configurada
3. Verifique a autenticação do webhook secret (quando implementada)

### Chave não aparece no frontend
1. Verifique se você é administrador
2. Confirme que a empresa está associada ao usuário
3. Verifique os logs do backend para erros

## Próximos Passos

1. **Implementar Criptografia**: Adicionar criptografia em nível de aplicação para as chaves
2. **Webhook Secret**: Implementar autenticação obrigatória para o endpoint interno
3. **Rotação de Chaves**: Sistema para rotacionar chaves periodicamente
4. **Auditoria**: Logs detalhados de quando e como as chaves são usadas
5. **Rate Limiting**: Limitar requisições ao endpoint de busca de chaves
6. **Templates N8N**: Criar templates prontos de workflows para as automações comuns

## Contato e Suporte

Para dúvidas sobre a integração:
- Documentação OpenAI: https://platform.openai.com/docs
- Documentação N8N: https://docs.n8n.io
- Issues do projeto: [GitHub Issues]

## Changelog

### v1.0.0 (2025-01-15)
- ✅ Adicionados campos `openaiApiKey` e `n8nWebhookUrl` ao schema
- ✅ Criados endpoints API para configuração
- ✅ Implementado formulário no frontend
- ✅ Validação e máscara de segurança
- ✅ Documentação inicial
- ⏳ TODO: Implementar criptografia de chaves
- ⏳ TODO: Implementar autenticação webhook secret
