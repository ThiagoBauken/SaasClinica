/**
 * Script para verificar se o Wuzapi está configurando corretamente o S3
 */

// Carregar variáveis do .env
import { config } from 'dotenv';
config();

const WUZAPI_BASE_URL = process.env.WUZAPI_BASE_URL || 'https://private-wuzapi.pbzgje.easypanel.host';
const WUZAPI_ADMIN_TOKEN = process.env.WUZAPI_ADMIN_TOKEN;

// Variáveis S3 do Wuzapi (prioridade WUZAPI_S3_* sobre S3_*)
const S3_ENDPOINT = process.env.WUZAPI_S3_ENDPOINT || process.env.S3_ENDPOINT || '';
const S3_ACCESS_KEY = process.env.WUZAPI_S3_ACCESS_KEY || process.env.S3_ACCESS_KEY_ID || '';
const S3_SECRET_KEY = process.env.WUZAPI_S3_SECRET_KEY || process.env.S3_SECRET_ACCESS_KEY || '';
const S3_BUCKET = process.env.WUZAPI_S3_BUCKET || process.env.S3_BUCKET || '';
const S3_REGION = process.env.WUZAPI_S3_REGION || process.env.S3_REGION || 'us-east-1';

console.log('🔍 VERIFICAÇÃO DAS CONFIGURAÇÕES WUZAPI + S3\n');
console.log('='.repeat(60));

// 1. Verificar variáveis de ambiente
console.log('\n📋 1. VARIÁVEIS DE AMBIENTE:\n');
console.log(`  WUZAPI_BASE_URL: ${WUZAPI_BASE_URL}`);
console.log(`  WUZAPI_ADMIN_TOKEN: ${WUZAPI_ADMIN_TOKEN ? '✅ Configurado' : '❌ FALTANDO'}`);
console.log('');
console.log('  S3 para Wuzapi (bucket clinica):');
console.log(`    WUZAPI_S3_ENDPOINT: ${process.env.WUZAPI_S3_ENDPOINT || '(usando S3_ENDPOINT)'}`);
console.log(`    WUZAPI_S3_ACCESS_KEY: ${process.env.WUZAPI_S3_ACCESS_KEY ? '✅ Configurado' : '(usando S3_ACCESS_KEY_ID)'}`);
console.log(`    WUZAPI_S3_SECRET_KEY: ${process.env.WUZAPI_S3_SECRET_KEY ? '✅ Configurado' : '(usando S3_SECRET_ACCESS_KEY)'}`);
console.log(`    WUZAPI_S3_BUCKET: ${process.env.WUZAPI_S3_BUCKET || '(usando S3_BUCKET)'}`);
console.log('');
console.log('  Valores finais que o Wuzapi vai usar:');
console.log(`    Endpoint: ${S3_ENDPOINT}`);
console.log(`    Access Key: ${S3_ACCESS_KEY.substring(0, 6)}...`);
console.log(`    Secret Key: ${S3_SECRET_KEY ? '✅ Configurado' : '❌ FALTANDO'}`);
console.log(`    Bucket: ${S3_BUCKET}`);
console.log(`    Region: ${S3_REGION}`);

// 2. Listar instâncias existentes
console.log('\n' + '='.repeat(60));
console.log('\n📦 2. INSTÂNCIAS WUZAPI EXISTENTES:\n');

if (!WUZAPI_ADMIN_TOKEN) {
  console.log('  ❌ WUZAPI_ADMIN_TOKEN não configurado!');
  process.exit(1);
}

try {
  const listResponse = await fetch(`${WUZAPI_BASE_URL}/admin/users`, {
    method: 'GET',
    headers: {
      'Authorization': WUZAPI_ADMIN_TOKEN,
    },
  });

  if (!listResponse.ok) {
    console.log(`  ❌ Erro ao listar: HTTP ${listResponse.status}`);
    const errText = await listResponse.text();
    console.log(`     ${errText}`);
  } else {
    const listData = await listResponse.json();
    const users = listData.users || listData.data || [];

    if (users.length === 0) {
      console.log('  Nenhuma instância encontrada.');
    } else {
      console.log(`  Encontradas ${users.length} instância(s):\n`);

      for (const user of users) {
        console.log(`  📱 ${user.name || user.Name}`);
        console.log(`     ID: ${user.id || user.Id}`);
        console.log(`     Token: ${(user.token || user.Token || '').substring(0, 10)}...`);
        console.log(`     Webhook: ${user.webhook || user.Webhook || 'Não configurado'}`);

        // Verificar configuração S3 da instância
        const s3Config = user.s3 || user.S3 || user.s3Config;
        if (s3Config) {
          console.log(`     S3: ✅ Configurado`);
          console.log(`       - Bucket: ${s3Config.bucket || s3Config.Bucket}`);
          console.log(`       - Endpoint: ${s3Config.endpoint || s3Config.Endpoint}`);
        } else {
          console.log(`     S3: ⚠️ Não configurado na instância`);
        }
        console.log('');
      }
    }
  }
} catch (error) {
  console.log(`  ❌ Erro de conexão: ${error.message}`);
}

// 3. Testar conexão com o MinIO (bucket clinica)
console.log('='.repeat(60));
console.log('\n🔗 3. TESTE DE CONEXÃO MINIO (bucket clinica):\n');

import { S3Client, HeadBucketCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

try {
  // Verificar se bucket existe
  await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
  console.log(`  ✅ Bucket "${S3_BUCKET}" existe e está acessível!`);

  // Testar upload
  const testKey = `wuzapi-test-${Date.now()}.txt`;
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: testKey,
    Body: 'Test from wuzapi config check',
    ContentType: 'text/plain',
  }));
  console.log(`  ✅ Upload de teste OK!`);

  // Deletar arquivo de teste
  await s3Client.send(new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: testKey,
  }));
  console.log(`  ✅ Delete de teste OK!`);

} catch (error) {
  console.log(`  ❌ Erro: ${error.message}`);
}

// 4. Resumo
console.log('\n' + '='.repeat(60));
console.log('\n📊 RESUMO:\n');

const checks = [
  ['WUZAPI_ADMIN_TOKEN', !!WUZAPI_ADMIN_TOKEN],
  ['WUZAPI_S3_ENDPOINT', !!process.env.WUZAPI_S3_ENDPOINT],
  ['WUZAPI_S3_ACCESS_KEY', !!process.env.WUZAPI_S3_ACCESS_KEY],
  ['WUZAPI_S3_SECRET_KEY', !!process.env.WUZAPI_S3_SECRET_KEY],
  ['WUZAPI_S3_BUCKET = clinica', process.env.WUZAPI_S3_BUCKET === 'clinica'],
];

let allOk = true;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? '✅' : '❌'} ${name}`);
  if (!ok) allOk = false;
}

console.log('');
if (allOk) {
  console.log('🎉 Todas as configurações estão corretas!');
  console.log('   O Wuzapi vai usar o bucket "clinica" para mídia do WhatsApp.');
} else {
  console.log('⚠️  Algumas configurações precisam de atenção.');
}

console.log('\n' + '='.repeat(60));
