/**
 * Script de teste de conexão com MinIO
 */

import { S3Client, ListBucketsCommand, HeadBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Configurações do MinIO (das novas credenciais)
const config = {
  endpoint: 'https://odontobot-minio.pbzgje.easypanel.host',
  accessKeyId: 'l583L9UC5zVZ3hTe0yZv',
  secretAccessKey: '51n7O7jDym6BmmsX3ZD5vex9jR0qGIFwDSUoBA7B',
  bucket: 'clinica',
  region: 'us-east-1',
};

console.log('🔧 Testando conexão com MinIO...\n');
console.log('Configuração:');
console.log(`  Endpoint: ${config.endpoint}`);
console.log(`  Bucket: ${config.bucket}`);
console.log(`  Access Key: ${config.accessKeyId.substring(0, 4)}...`);
console.log('');

// Criar cliente S3
const client = new S3Client({
  endpoint: config.endpoint,
  region: config.region,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
  forcePathStyle: true, // Obrigatório para MinIO
});

async function testConnection() {
  const results = {
    listBuckets: false,
    bucketExists: false,
    upload: false,
    download: false,
    delete: false,
  };

  // Teste 1: Listar buckets
  console.log('📋 Teste 1: Listando buckets...');
  try {
    const response = await client.send(new ListBucketsCommand({}));
    console.log('   ✅ Conexão OK! Buckets encontrados:');
    response.Buckets?.forEach(bucket => {
      console.log(`      - ${bucket.Name}`);
    });
    results.listBuckets = true;
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
    if (error.Code) console.log(`      Código: ${error.Code}`);
  }

  console.log('');

  // Teste 2: Verificar se bucket existe
  console.log(`📦 Teste 2: Verificando bucket "${config.bucket}"...`);
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    console.log('   ✅ Bucket existe e está acessível!');
    results.bucketExists = true;
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.log(`   ⚠️  Bucket "${config.bucket}" não existe!`);
      console.log('   💡 Crie o bucket no painel do MinIO ou use: mc mb myminio/clinica');
    } else {
      console.log(`   ❌ Erro: ${error.message}`);
    }
  }

  console.log('');

  // Teste 3: Upload de arquivo de teste
  if (results.bucketExists) {
    const testKey = `test-connection-${Date.now()}.txt`;
    const testContent = `Teste de conexão - ${new Date().toISOString()}`;

    console.log('📤 Teste 3: Upload de arquivo de teste...');
    try {
      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: testKey,
        Body: testContent,
        ContentType: 'text/plain',
      }));
      console.log(`   ✅ Upload OK! Key: ${testKey}`);
      results.upload = true;

      // Teste 4: Download do arquivo
      console.log('');
      console.log('📥 Teste 4: Download do arquivo de teste...');
      try {
        const getResponse = await client.send(new GetObjectCommand({
          Bucket: config.bucket,
          Key: testKey,
        }));
        const downloadedContent = await getResponse.Body.transformToString();
        if (downloadedContent === testContent) {
          console.log('   ✅ Download OK! Conteúdo verificado.');
          results.download = true;
        } else {
          console.log('   ⚠️  Download OK, mas conteúdo diferente.');
        }
      } catch (error) {
        console.log(`   ❌ Erro no download: ${error.message}`);
      }

      // Teste 5: Deletar arquivo de teste
      console.log('');
      console.log('🗑️  Teste 5: Deletando arquivo de teste...');
      try {
        await client.send(new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: testKey,
        }));
        console.log('   ✅ Delete OK!');
        results.delete = true;
      } catch (error) {
        console.log(`   ❌ Erro ao deletar: ${error.message}`);
      }

    } catch (error) {
      console.log(`   ❌ Erro no upload: ${error.message}`);
      if (error.Code) console.log(`      Código: ${error.Code}`);
    }
  }

  // Resumo
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMO DOS TESTES:');
  console.log('='.repeat(50));

  const tests = [
    ['Conexão/Listar Buckets', results.listBuckets],
    ['Bucket Existe', results.bucketExists],
    ['Upload', results.upload],
    ['Download', results.download],
    ['Delete', results.delete],
  ];

  tests.forEach(([name, passed]) => {
    const status = passed ? '✅ OK' : '❌ FALHOU';
    console.log(`  ${name}: ${status}`);
  });

  const totalPassed = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;

  console.log('');
  if (totalPassed === totalTests) {
    console.log('🎉 Todos os testes passaram! MinIO está funcionando corretamente.');
  } else if (totalPassed > 0) {
    console.log(`⚠️  ${totalPassed}/${totalTests} testes passaram. Verifique os erros acima.`);
  } else {
    console.log('❌ Nenhum teste passou. Verifique suas credenciais e endpoint.');
  }

  return results;
}

testConnection().catch(console.error);
