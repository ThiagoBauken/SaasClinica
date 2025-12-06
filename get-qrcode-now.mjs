/**
 * Busca QR Code diretamente do WuzAPI
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const WUZAPI_BASE_URL = process.env.WUZAPI_BASE_URL || 'https://private-wuzapi.pbzgje.easypanel.host';

async function getQrCode() {
  console.log('\n========================================');
  console.log('   OBTENDO QR CODE DO WUZAPI');
  console.log('========================================\n');

  try {
    // Buscar token
    const result = await pool.query('SELECT wuzapi_api_key FROM clinic_settings WHERE company_id = 1');
    const token = result.rows[0]?.wuzapi_api_key;

    if (!token) {
      console.log('[ERRO] Token nao encontrado no banco!');
      return;
    }

    console.log(`Token: ${token.substring(0, 10)}...`);
    console.log(`Base URL: ${WUZAPI_BASE_URL}\n`);

    // Passo 1: Iniciar sessao
    console.log('1. Iniciando sessao (POST /session/connect)...');
    const connectResponse = await fetch(`${WUZAPI_BASE_URL}/session/connect`, {
      method: 'POST',
      headers: {
        'Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Subscribe: ['Message', 'ReadReceipt', 'Presence', 'HistorySync', 'Call'],
        Immediate: true,
      }),
    });

    const connectData = await connectResponse.json();
    console.log('   Response:', JSON.stringify(connectData, null, 2));

    // Se ja esta logado
    if (connectData.data?.LoggedIn) {
      console.log('\n[OK] WhatsApp JA ESTA CONECTADO!');
      console.log(`    Numero: ${connectData.data?.JID || 'N/A'}`);
      return;
    }

    // Se veio QR Code no connect
    if (connectData.data?.QRCode) {
      console.log('\n[OK] QR CODE OBTIDO VIA /session/connect!');
      console.log('\nQR Code (base64):');
      console.log(connectData.data.QRCode.substring(0, 100) + '...');
      return;
    }

    // Passo 2: Buscar QR separadamente
    console.log('\n2. Buscando QR Code (GET /session/qr)...');
    const qrResponse = await fetch(`${WUZAPI_BASE_URL}/session/qr`, {
      method: 'GET',
      headers: {
        'Token': token,
      },
    });

    console.log(`   HTTP Status: ${qrResponse.status}`);

    if (qrResponse.status === 404) {
      console.log('   [INFO] 404 - Sessao ja conectada ou QR nao disponivel');
      return;
    }

    const qrData = await qrResponse.json();
    console.log('   Response:', JSON.stringify(qrData, null, 2));

    if (qrData.data?.QRCode || qrData.data?.qrcode) {
      const qr = qrData.data?.QRCode || qrData.data?.qrcode;
      console.log('\n[OK] QR CODE OBTIDO!');
      console.log('\nQR Code (base64 - primeiros 100 chars):');
      console.log(qr.substring(0, 100) + '...');

      // Salvar QR como arquivo para visualizar
      const fs = await import('fs');
      const qrClean = qr.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync('qrcode-wuzapi.png', Buffer.from(qrClean, 'base64'));
      console.log('\n[SALVO] QR Code salvo em qrcode-wuzapi.png');
      console.log('Abra o arquivo e escaneie com o WhatsApp!');
    } else {
      console.log('\n[AVISO] QR Code nao retornado.');
      console.log('Verifique se a sessao ja esta conectada ou se ha erro.');
    }

  } catch (error) {
    console.error('ERRO:', error.message);
  } finally {
    await pool.end();
  }
}

getQrCode();
