import { query } from '../../server/db.js';
import { ensureDatabaseSchema } from '../../server/schemaInit.js';
import { successResponse, errorResponse, optionsResponse } from '../../server/utils/response.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();

  await ensureDatabaseSchema();

  const id = event.queryStringParameters?.id;
  if (!id) {
    return errorResponse('Transaction ID is required', 'MISSING_ID', 400);
  }

  // -------------------------------------------------------------
  // GET: Single Transaction with Items & Complete Sync Audit Log
  // -------------------------------------------------------------
  if (event.httpMethod === 'GET') {
    try {
      const txRes = await query(
        `SELECT 
           t.*, 
           u.name AS created_by_name,
           u.email AS created_by_email
         FROM transactions t
         LEFT JOIN users u ON t.created_by = u.id
         WHERE t.id = $1`,
        [id]
      );

      if (txRes.rowCount === 0) {
        return errorResponse('Transaction not found', 'NOT_FOUND', 404);
      }

      const transaction = txRes.rows[0];

      // Fetch items
      const itemsRes = await query(
        'SELECT * FROM transaction_items WHERE transaction_id = $1 ORDER BY created_at ASC',
        [id]
      );

      // Fetch sync audit logs
      const logsRes = await query(
        'SELECT * FROM tally_sync_logs WHERE transaction_id = $1 ORDER BY attempt_number DESC, created_at DESC',
        [id]
      );

      return successResponse({
        transaction,
        items: itemsRes.rows,
        syncLogs: logsRes.rows,
      });
    } catch (err) {
      console.error('Fetch transaction error:', err);
      return errorResponse('Failed to load transaction details', 'FETCH_ERROR', 500);
    }
  }

  // -------------------------------------------------------------
  // PUT: Update Unsynced Transaction
  // -------------------------------------------------------------
  if (event.httpMethod === 'PUT') {
    try {
      // Check existing transaction state
      const checkRes = await query('SELECT * FROM transactions WHERE id = $1', [id]);
      if (checkRes.rowCount === 0) {
        return errorResponse('Transaction not found', 'NOT_FOUND', 404);
      }
      const existing = checkRes.rows[0];

      // Security & Integrity Rule: Cannot edit if already posted to Tally
      if (existing.tally_sync_status === 'synced') {
        return errorResponse(
          'Transactions already synchronized with Tally cannot be edited directly to preserve accounting auditability.',
          'CANNOT_EDIT_SYNCED',
          403
        );
      }

      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return errorResponse('Invalid JSON body', 'INVALID_JSON', 400);
      }

      const {
        voucher_number = existing.voucher_number,
        voucher_type = existing.voucher_type,
        voucher_date = existing.voucher_date,
        reference_number = existing.reference_number,
        party_ledger = existing.party_ledger,
        account_ledger = existing.account_ledger,
        narration = existing.narration,
        subtotal = existing.subtotal,
        tax_amount = existing.tax_amount,
        total_amount = existing.total_amount,
        debit_credit = existing.debit_credit,
        items = [],
      } = body;

      // Update transactions table
      const updateSql = `
        UPDATE transactions
        SET 
          voucher_number = $1,
          voucher_type = $2,
          voucher_date = $3,
          reference_number = $4,
          party_ledger = $5,
          account_ledger = $6,
          narration = $7,
          subtotal = $8,
          tax_amount = $9,
          total_amount = $10,
          debit_credit = $11,
          updated_at = NOW()
        WHERE id = $12
        RETURNING *;
      `;

      const updateRes = await query(updateSql, [
        voucher_number.trim(),
        voucher_type.trim(),
        voucher_date,
        reference_number ? reference_number.trim() : null,
        party_ledger.trim(),
        account_ledger.trim(),
        narration ? narration.trim() : null,
        parseFloat(subtotal) || 0,
        parseFloat(tax_amount) || 0,
        parseFloat(total_amount) || 0,
        debit_credit || 'Dr',
        id,
      ]);

      // Refresh items
      if (items && items.length >= 0) {
        await query('DELETE FROM transaction_items WHERE transaction_id = $1', [id]);
        for (const item of items) {
          await query(
            `INSERT INTO transaction_items (
              transaction_id, item_name, description, quantity, rate,
              discount, tax_percentage, tax_amount, amount
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              id,
              item.item_name.trim(),
              item.description ? item.description.trim() : null,
              parseFloat(item.quantity) || 1,
              parseFloat(item.rate) || 0,
              parseFloat(item.discount) || 0,
              parseFloat(item.tax_percentage) || 0,
              parseFloat(item.tax_amount) || 0,
              parseFloat(item.amount) || 0,
            ]
          );
        }
      }

      return successResponse({
        transaction: updateRes.rows[0],
        message: 'Transaction updated successfully',
      });
    } catch (err) {
      console.error('Update transaction error:', err);
      return errorResponse('Failed to update transaction', 'UPDATE_ERROR', 500);
    }
  }

  return errorResponse('Method Not Allowed', 'METHOD_NOT_ALLOWED', 405);
}
