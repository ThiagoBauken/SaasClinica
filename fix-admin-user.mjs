// Script para verificar e criar usuário admin
import pg from 'pg';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config();

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Conectado ao banco de dados');

    // Verificar se usuário admin existe
    const checkResult = await client.query(
      "SELECT id, username, role, company_id, active FROM users WHERE username = 'admin'"
    );

    if (checkResult.rows.length > 0) {
      const admin = checkResult.rows[0];
      console.log('Usuário admin encontrado:', admin);

      // Verificar se está ativo
      if (!admin.active) {
        console.log('Admin está inativo. Ativando...');
        await client.query("UPDATE users SET active = true WHERE username = 'admin'");
        console.log('Admin ativado!');
      }

      // Resetar senha do admin
      console.log('Resetando senha do admin para: admin123');
      const hashedPassword = await hashPassword('admin123');
      await client.query(
        "UPDATE users SET password = $1 WHERE username = 'admin'",
        [hashedPassword]
      );
      console.log('Senha resetada com sucesso!');

    } else {
      console.log('Usuário admin NÃO existe. Criando...');

      // Buscar a primeira empresa ativa
      const companyResult = await client.query(
        "SELECT id FROM companies WHERE active = true ORDER BY id LIMIT 1"
      );

      if (companyResult.rows.length === 0) {
        console.log('Nenhuma empresa encontrada!');
        return;
      }

      const companyId = companyResult.rows[0].id;
      console.log('Usando company_id:', companyId);

      const hashedPassword = await hashPassword('admin123');

      await client.query(`
        INSERT INTO users (username, password, full_name, email, role, phone, speciality, active, company_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        'admin',
        hashedPassword,
        'Dr. Carlos Administrador',
        'admin@sorrisoperfeito.com.br',
        'admin',
        '(11) 98765-4321',
        'Gestão Clínica',
        true,
        companyId
      ]);

      console.log('Usuário admin criado com sucesso!');
    }

    // Listar todos os usuários
    console.log('\n--- Usuários no sistema ---');
    const usersResult = await client.query(
      "SELECT id, username, role, company_id, active FROM users ORDER BY id"
    );
    console.table(usersResult.rows);

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await client.end();
  }
}

main();
