import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

const config = {
  endpoint: 'https://odontobot-minio.pbzgje.easypanel.host',
  accessKeyId: 'l583L9UC5zVZ3hTe0yZv',
  secretAccessKey: '51n7O7jDym6BmmsX3ZD5vex9jR0qGIFwDSUoBA7B',
  bucket: 'digital',
  region: 'us-east-1',
};

const client = new S3Client({
  endpoint: config.endpoint,
  region: config.region,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
  forcePathStyle: true,
});

const filePath = './dentistav1/eat.png';
const fileName = 'eat.png';

console.log(`📤 Uploading ${fileName} to bucket "${config.bucket}"...`);

const fileBuffer = fs.readFileSync(filePath);
const fileSize = fileBuffer.length;

try {
  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: fileName,
    Body: fileBuffer,
    ContentType: 'image/png',
  }));

  console.log(`✅ Upload concluído!`);
  console.log(`   Arquivo: ${fileName}`);
  console.log(`   Tamanho: ${(fileSize / 1024).toFixed(2)} KB`);
  console.log(`   Bucket: ${config.bucket}`);
  console.log(`   URL: ${config.endpoint}/${config.bucket}/${fileName}`);
} catch (error) {
  console.log(`❌ Erro: ${error.message}`);
}
