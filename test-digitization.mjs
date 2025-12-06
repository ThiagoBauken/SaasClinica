import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testDigitization() {
  try {
    console.log('🔐 1. Fazendo login...');

    // Login first
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'superadmin',
        password: 'superadmin123'
      })
    });

    if (!loginResponse.ok) {
      console.error('❌ Erro no login:', await loginResponse.text());
      return;
    }

    // Get session cookie
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('✅ Login realizado com sucesso!');
    console.log('🍪 Cookies:', cookies);

    // Test image path
    const imagePath = path.join(__dirname, 'dentistav1', 'uploads', 'WhatsApp Image 2025-01-31 at 23.31.43.jpeg');

    if (!fs.existsSync(imagePath)) {
      console.error('❌ Imagem não encontrada:', imagePath);
      return;
    }

    console.log('\n📸 2. Processando imagem...');
    console.log('   Caminho:', imagePath);

    // Create form data
    const formData = new FormData();
    formData.append('files', fs.createReadStream(imagePath));
    formData.append('outputFormat', 'database');

    // Send to digitization endpoint
    const digitizeResponse = await fetch('http://localhost:5000/api/v1/patients/digitize', {
      method: 'POST',
      headers: {
        'Cookie': cookies
      },
      body: formData
    });

    const result = await digitizeResponse.json();

    if (!digitizeResponse.ok) {
      console.error('❌ Erro na digitalização:', JSON.stringify(result, null, 2));
      return;
    }

    console.log('\n✅ 3. Digitalização concluída com sucesso!');
    console.log('\n📊 Resultados:');
    console.log(JSON.stringify(result, null, 2));

    // Get history
    console.log('\n📜 4. Buscando histórico...');
    const historyResponse = await fetch('http://localhost:5000/api/v1/patients/digitization-history', {
      headers: {
        'Cookie': cookies
      }
    });

    if (historyResponse.ok) {
      const history = await historyResponse.json();
      console.log('   Total de registros no histórico:', history.length || 0);
    } else {
      console.log('   ⚠️  Não foi possível buscar histórico');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error(error.stack);
  }
}

console.log('🚀 Iniciando teste de digitalização de imagem...\n');
testDigitization();
