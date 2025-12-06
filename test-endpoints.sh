#!/bin/bash

# Script de teste dos endpoints implementados
# Usage: ./test-endpoints.sh

BASE_URL="http://localhost:5000"
COOKIE_FILE="cookies.txt"

echo "🧪 Testando Endpoints da API"
echo "================================"
echo ""

# 1. Login (obter sessão)
echo "1️⃣  Testando Login..."
curl -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  --cookie-jar $COOKIE_FILE \
  -s -o /dev/null -w "Status: %{http_code}\n"
echo ""

# 2. Dashboard Stats
echo "2️⃣  Testando Dashboard Stats..."
curl "$BASE_URL/api/dashboard/stats" \
  --cookie $COOKIE_FILE \
  -s -o /dev/null -w "Status: %{http_code}\n"
echo ""

# 3. Transactions
echo "3️⃣  Testando Transações..."
curl "$BASE_URL/api/transactions?filter=this-month" \
  --cookie $COOKIE_FILE \
  -s -o /dev/null -w "Status: %{http_code}\n"
echo ""

# 4. Revenue by Month
echo "4️⃣  Testando Receita por Mês..."
curl "$BASE_URL/api/financial/revenue-by-month" \
  --cookie $COOKIE_FILE \
  -s -o /dev/null -w "Status: %{http_code}\n"
echo ""

# 5. Revenue by Type
echo "5️⃣  Testando Receita por Tipo..."
curl "$BASE_URL/api/financial/revenue-by-type" \
  --cookie $COOKIE_FILE \
  -s -o /dev/null -w "Status: %{http_code}\n"
echo ""

# 6. Procedure Stats
echo "6️⃣  Testando Estatísticas de Procedimentos..."
curl "$BASE_URL/api/appointments/stats/procedures" \
  --cookie $COOKIE_FILE \
  -s -o /dev/null -w "Status: %{http_code}\n"
echo ""

# 7. Calendar Occupation
echo "7️⃣  Testando Ocupação do Calendário..."
curl "$BASE_URL/api/calendar/occupation-status?month=2025-11" \
  --cookie $COOKIE_FILE \
  -s -o /dev/null -w "Status: %{http_code}\n"
echo ""

# 8. Patient Records (substituir :patientId com ID real)
echo "8️⃣  Testando Prontuário do Paciente..."
curl "$BASE_URL/api/patients/1/records" \
  --cookie $COOKIE_FILE \
  -s -o /dev/null -w "Status: %{http_code}\n"
echo ""

# 9. Odontogram (substituir :patientId com ID real)
echo "9️⃣  Testando Odontograma..."
curl "$BASE_URL/api/patients/1/odontogram" \
  --cookie $COOKIE_FILE \
  -s -o /dev/null -w "Status: %{http_code}\n"
echo ""

# 10. Patients
echo "🔟 Testando Lista de Pacientes..."
curl "$BASE_URL/api/patients" \
  --cookie $COOKIE_FILE \
  -s -o /dev/null -w "Status: %{http_code}\n"
echo ""

# Cleanup
rm -f $COOKIE_FILE

echo "================================"
echo "✅ Testes concluídos!"
echo ""
echo "Códigos esperados:"
echo "  200 = Sucesso"
echo "  401 = Não autenticado"
echo "  403 = Sem permissão"
echo "  404 = Não encontrado"
echo "  500 = Erro no servidor"
