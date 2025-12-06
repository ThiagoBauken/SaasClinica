import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgres://odonto:9297c681978872468528@185.215.165.19:190/odontobase',
  ssl: false
});

async function checkPatients() {
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados\n');

    // 1. Verificar quantos pacientes existem
    const patientsResult = await client.query(`
      SELECT COUNT(*) as total, company_id
      FROM patients
      WHERE company_id = 1
      GROUP BY company_id
    `);

    console.log('📊 PACIENTES NO BANCO:');
    console.log(`   Total: ${patientsResult.rows[0]?.total || 0} paciente(s)\n`);

    // 2. Ver últimos 5 pacientes
    const lastPatients = await client.query(`
      SELECT id, full_name, cpf, phone, created_at, notes
      FROM patients
      WHERE company_id = 1
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('🔍 ÚLTIMOS 5 PACIENTES:');
    lastPatients.rows.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.full_name} (ID: ${p.id})`);
      console.log(`      CPF: ${p.cpf || 'N/A'}`);
      console.log(`      Tel: ${p.phone || 'N/A'}`);
      console.log(`      Criado: ${p.created_at}`);
      console.log(`      Notas: ${p.notes || 'N/A'}\n`);
    });

    // 3. Verificar histórico de digitalizações
    const historyResult = await client.query(`
      SELECT id, total_files, success_count, error_count, duplicate_count,
             output_format, processed_at
      FROM digitization_history
      WHERE company_id = 1
      ORDER BY processed_at DESC
      LIMIT 5
    `);

    console.log('📜 HISTÓRICO DE DIGITALIZAÇÕES:');
    if (historyResult.rows.length === 0) {
      console.log('   Nenhum registro encontrado\n');
    } else {
      historyResult.rows.forEach((h, i) => {
        console.log(`   ${i + 1}. Processamento ID ${h.id}`);
        console.log(`      Total de arquivos: ${h.total_files}`);
        console.log(`      Sucesso: ${h.success_count} | Erros: ${h.error_count} | Duplicatas: ${h.duplicate_count}`);
        console.log(`      Formato: ${h.output_format}`);
        console.log(`      Data: ${h.processed_at}\n`);
      });
    }

    // 4. Verificar se há pacientes importados via digitalização
    const importedPatients = await client.query(`
      SELECT COUNT(*) as total
      FROM patients
      WHERE company_id = 1
        AND notes LIKE '%digitalização%'
    `);

    console.log('🤖 PACIENTES IMPORTADOS VIA DIGITALIZAÇÃO:');
    console.log(`   Total: ${importedPatients.rows[0]?.total || 0} paciente(s)\n`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

console.log('🔍 Verificando banco de dados...\n');
checkPatients();
