/**
 * Stock Auto-Deduction Service
 * Deduz materiais do estoque automaticamente ao concluir um procedimento
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

import { logger } from '../logger';
/**
 * Deduz materiais do estoque quando um agendamento/procedimento e concluido
 * Chamado quando appointment.status muda para 'completed'
 */
export async function autoDeductStock(
  companyId: number,
  appointmentId: number,
  userId: number,
): Promise<{ deducted: number; alerts: string[] }> {
  const alerts: string[] = [];
  let deducted = 0;

  try {
    // 1. Buscar procedimentos do agendamento
    const procedures = await db.execute(sql`
      SELECT ap.procedure_id, ap.quantity as proc_quantity, pr.name as procedure_name
      FROM appointment_procedures ap
      JOIN procedures pr ON ap.procedure_id = pr.id
      JOIN appointments a ON ap.appointment_id = a.id
      WHERE ap.appointment_id = ${appointmentId}
        AND a.company_id = ${companyId}
    `);

    if (procedures.rows.length === 0) return { deducted, alerts };

    // 2. Para cada procedimento, buscar materiais vinculados
    for (const proc of procedures.rows as any[]) {
      const materials = await db.execute(sql`
        SELECT pm.item_id, pm.quantity as material_quantity,
               ii.name as item_name, ii.quantity as stock_quantity, ii.min_stock, ii.unit
        FROM procedure_materials pm
        JOIN inventory_items ii ON pm.item_id = ii.id
        WHERE pm.procedure_id = ${proc.procedure_id} AND pm.company_id = ${companyId}
      `);

      for (const mat of materials.rows as any[]) {
        const totalDeduct = parseFloat(mat.material_quantity) * (proc.proc_quantity || 1);

        // Deduzir do estoque
        await db.execute(sql`
          UPDATE inventory_items SET quantity = GREATEST(quantity - ${totalDeduct}, 0), updated_at = NOW()
          WHERE id = ${mat.item_id} AND company_id = ${companyId}
        `);

        // Registrar transacao
        await db.execute(sql`
          INSERT INTO inventory_transactions (company_id, item_id, type, quantity, notes, reference_id, created_by)
          VALUES (${companyId}, ${mat.item_id}, 'out', ${totalDeduct},
            ${'Baixa automatica - ' + proc.procedure_name + ' (Agendamento #' + appointmentId + ')'},
            ${String(appointmentId)}, ${userId})
        `);

        deducted++;

        // Verificar estoque minimo
        const newStock = parseFloat(mat.stock_quantity) - totalDeduct;
        if (newStock <= parseFloat(mat.min_stock || '0')) {
          alerts.push(`${mat.item_name}: estoque baixo (${newStock} ${mat.unit || 'un'})`);
        }
      }
    }
  } catch (error) {
    logger.error({ err: error }, '[StockAutoDeduct] Error:');
  }

  return { deducted, alerts };
}

/**
 * Verifica produtos proximos ao vencimento
 */
export async function getExpiringProducts(
  companyId: number,
  daysAhead: number = 30,
): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT id, name, quantity, unit, expiration_date,
           EXTRACT(DAY FROM expiration_date - NOW()) as days_until_expiry
    FROM inventory_items
    WHERE company_id = ${companyId} AND active = true
      AND expiration_date IS NOT NULL
      AND expiration_date <= NOW() + ${daysAhead + ' days'}::interval
    ORDER BY expiration_date
  `);
  return result.rows;
}
