# Sistema de Integração Financeira Automática

## Visão Geral

O sistema de integração financeira conecta automaticamente os agendamentos realizados com o sistema financeiro da clínica, criando transações financeiras automáticas baseadas nos procedimentos executados durante as consultas.

## Funcionalidades Principais

### 1. Criação Automática de Transações Financeiras

**Quando uma consulta é finalizada:**
- O sistema automaticamente identifica todos os procedimentos realizados
- Calcula o valor total baseado nos preços dos procedimentos
- Cria transações financeiras pendentes no nome do paciente
- Registra o profissional responsável e a data da consulta

### 2. Gestão de Planos de Tratamento

**Criação de Planos de Tratamento:**
- Define procedimentos necessários com quantidades e preços
- Calcula valor total do tratamento
- Permite aplicação de descontos
- Cria cronograma de pagamentos parcelados

### 3. Controle de Pagamentos com Taxas

**Processamento de Pagamentos:**
- Calcula automaticamente taxas das máquinas de cartão
- Registra valor líquido após dedução das taxas
- Suporta diferentes métodos de pagamento:
  - Dinheiro (sem taxa)
  - Cartão de Débito (1,99%)
  - Cartão de Crédito (3,99%)
  - PIX (0,99%)
  - Transferência Bancária (sem taxa)

### 4. Resumo Financeiro do Paciente

**Para cada paciente, o sistema fornece:**
- Valor total dos tratamentos
- Valor pago
- Saldo em aberto
- Valores em atraso
- Próximo pagamento devido
- Histórico de pagamentos
- Pagamentos futuros

## API Endpoints

### Transações Automáticas
```
POST /api/financial/create-from-appointment/:appointmentId
```
Cria transações financeiras baseadas nos procedimentos de uma consulta.

### Resumo do Paciente
```
GET /api/financial/patient/:patientId/summary
```
Retorna resumo financeiro completo do paciente.

### Planos de Tratamento
```
POST /api/financial/treatment-plans
```
Cria plano de tratamento com detalhamento financeiro.

### Processamento de Pagamentos
```
POST /api/financial/process-payment
```
Processa pagamento com cálculo automático de taxas.

### Cálculo de Taxas
```
POST /api/financial/calculate-fees
```
Calcula taxas baseadas no método de pagamento.

### Cronograma de Parcelas
```
POST /api/financial/generate-installments
```
Gera cronograma de pagamentos parcelados.

### Finalização Automática
```
PATCH /api/appointments/:id/complete
```
Finaliza consulta e cria transações financeiras automaticamente.

## Fluxo de Trabalho

### 1. Durante a Consulta
1. Profissional agenda consulta com procedimentos
2. Define preços dos procedimentos no momento do agendamento
3. Executa os procedimentos durante a consulta

### 2. Finalização da Consulta
1. Profissional marca consulta como "finalizada"
2. Sistema automaticamente:
   - Cria transações financeiras para cada procedimento
   - Registra valores pendentes na conta do paciente
   - Calcula total devido

### 3. Gestão de Pagamentos
1. Recepção/Financeiro acessa conta do paciente
2. Visualiza valores pendentes
3. Processa pagamentos com cálculo automático de taxas
4. Sistema atualiza saldo do paciente

## Estrutura do Banco de Dados

### Tabela: financial_transactions
Armazena todas as transações financeiras (receitas e despesas).

### Tabela: treatment_plans
Registra planos de tratamento com detalhamento financeiro.

### Tabela: treatment_plan_procedures
Liga procedimentos aos planos de tratamento.

## Benefícios

1. **Automação Completa**: Elimina trabalho manual de criação de cobranças
2. **Precisão Financeira**: Calcula automaticamente taxas e valores líquidos
3. **Controle de Inadimplência**: Identifica automaticamente pagamentos em atraso
4. **Relatórios Detalhados**: Fornece visão completa da situação financeira de cada paciente
5. **Integração Total**: Conecta agenda, procedimentos e financeiro em um fluxo único

## Configuração

O sistema está configurado para funcionar automaticamente. As taxas das máquinas de pagamento podem ser ajustadas no arquivo `server/financialIntegration.ts` conforme necessário.

## Suporte a Multi-tenant

O sistema respeita o isolamento por empresa (multi-tenant), garantindo que cada clínica veja apenas seus próprios dados financeiros.