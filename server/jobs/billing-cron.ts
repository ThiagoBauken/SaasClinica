import cron from 'node-cron';
import { runDunningTasks } from '../services/dunning-service';

/**
 * Configuração de Cron Jobs para Billing
 */

export function startBillingCronJobs() {
  console.log('🕐 Iniciando cron jobs de billing...');

  // Executar tarefas de dunning todos os dias às 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('⏰ Executando cron job de dunning (9:00 AM)');
    await runDunningTasks();
  });

  // Executar também às 18:00 PM como backup
  cron.schedule('0 18 * * *', async () => {
    console.log('⏰ Executando cron job de dunning (6:00 PM)');
    await runDunningTasks();
  });

  console.log('✅ Cron jobs de billing configurados:');
  console.log('   - Dunning: Diariamente às 9:00 AM e 18:00 PM');

  // Executar uma vez ao iniciar (opcional, útil para desenvolvimento)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Modo desenvolvimento: Executando dunning tasks uma vez ao iniciar');
    setTimeout(() => {
      runDunningTasks().catch(console.error);
    }, 5000); // Aguardar 5 segundos para o servidor iniciar
  }
}
