import { query } from '../../server/db.js';
import { ensureDatabaseSchema } from '../../server/schemaInit.js';
import { syncTransactionToTally } from '../../server/tally/tallyService.js';
import { verifyAuthToken } from '../../server/utils/auth.js';
import { successResponse, errorResponse, optionsResponse } from '../../server/utils/response.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();

  await ensureDatabaseSchema();

  // Extract auth user if token present
  const authUser = verifyAuthToken(event.headers);

  // -------------------------------------------------------------
  // GET: Filtered & Paginated Transaction List
  // -------------------------------------------------------------
  if (event.httpMethod === 'GET') {
    try {
      const q = event.queryStringParameters || {};
      const page = Math.max(1, parseInt(q.page || '1', 10));
      const limit = Math.max(1, Math.min(100, parseInt(q.limit || '15', 10)));
      const offset = (page - 1) * limit;

      const conditions = [];
      const params = [];
      let paramIndex = 1;

      if (q.search && q.search.trim()) {
        conditions.push(`(
          t.voucher_number ILIKE $${paramIndex} OR 
          t.party_ledger ILIKE $${paramIndex} OR 
          t.reference_number ILIKE $${paramIndex} OR
          t.account_ledger ILIKE $${paramIndex}
        )`);
        params.push(`%${q.search.trim()}%`);
        paramIndex++;
      }

      if (q.voucher_type && q.voucher_type !== 'ALL') {
        conditions.push(`t.voucher_type = $${paramIndex}`);
        params.push(q.voucher_type);
        paramIndex++;
      }

      if (q.sync_status && q.sync_status !== 'ALL') {
        conditions.push(`t.tally_sync_status = $${paramIndex}`);
        params.push(q.sync_status);
        paramIndex++;
      }

      if (q.date_from) {
        conditions.push(`t.voucher_date >= $${paramIndex}`);
        params.push(q.date_from);
        paramIndex++;
      }

      if (q.date_to) {
        conditions.push(`t.voucher_date <= $${paramIndex}`);
        params.push(q.date_to);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count total records
      const countSql = `SELECT COUNT(*)::int AS total FROM transactions t ${whereClause}`;
      const countRes = await query(countSql, params);
      const total = countRes.rows[0]?.total || 0;

      // Fetch page
      const listSql = `
        SELECT 
          t.id,
          t.voucher_number,
          t.voucher_type,
          t.voucher_date,
          t.reference_number,
          t.party_ledger,
          t.account_ledger,
          t.subtotal,
          t.tax_amount,
          t.total_amount,
          t.debit_credit,
          t.status,
          t.tally_sync_status,
          t.tally_master_id,
          t.tally_alter_id,
          t.created_at,
          t.updated_at,
          u.name AS created_by_name,
          (SELECT COUNT(*)::int FROM transaction_items WHERE transaction_id = t.id) AS items_count
        FROM transactions t
        LEFT JOIN users u ON t.created_by = u.id
        ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const listParams = [...params, limit, offset];
      const listRes = await query(listSql, listParams);

      return successResponse({
        items: listRes.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (err) {
      console.error('Transactions list error:', err);
      return errorResponse('Failed to fetch transactions', 'FETCH_ERROR', 500);
    }
  }

  // -------------------------------------------------------------
  // POST: Create New Accounting Transaction
  // -------------------------------------------------------------
  if (event.httpMethod === 'POST') {
    try {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return errorResponse('Invalid JSON payload', 'INVALID_JSON', 400);
      }

      const {
        voucher_number,
        voucher_type,
        voucher_date,
        reference_number = '',
        party_ledger,
        account_ledger,
        narration = '',
        subtotal = 0,
        tax_amount = 0,
        total_amount = 0,
        debit_credit = 'Dr',
        is_draft = false,
        auto_sync = true,
        items = [],
      } = body;

      // 1. Mandatory Validations
      if (!voucher_number || !voucher_number.trim()) {
        return errorResponse('Voucher number is required', 'VALIDATION_ERROR', 400);
      }
      if (!voucher_type) {
        return errorResponse('Voucher type is required', 'VALIDATION_ERROR', 400);
      }
      if (!voucher_date) {
        return errorResponse('Voucher date is required', 'VALIDATION_ERROR', 400);
      }
      if (!party_ledger || !party_ledger.trim()) {
        return errorResponse('Party ledger is required', 'VALIDATION_ERROR', 400);
      }
      if (!account_ledger || !account_ledger.trim()) {
        return errorResponse('Account ledger is required', 'VALIDATION_ERROR', 400);
      }

      const totalNum = parseFloat(total_amount);
      if (isNaN(totalNum) || totalNum <= 0) {
        return errorResponse('Total amount must be greater than zero', 'VALIDATION_ERROR', 400);
      }

      // 2. Duplicate Voucher Number Check
      const dupCheck = await query(
        'SELECT id FROM transactions WHERE voucher_type = $1 AND voucher_number = $2',
        [voucher_type.trim(), voucher_number.trim()]
      );
      if (dupCheck.rowCount > 0) {
        return errorResponse(
          `Voucher number '${voucher_number}' already exists for voucher type '${voucher_type}'`,
          'DUPLICATE_VOUCHER',
          409
        );
      }

      // 3. Line items validation for Sales / Purchase
      if ((voucher_type === 'Sales' || voucher_type === 'Purchase') && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (!it.item_name || !it.item_name.trim()) {
            return errorResponse(`Item #${i + 1} must have a valid item name`, 'VALIDATION_ERROR', 400);
          }
          if (parseFloat(it.quantity) <= 0 || isNaN(parseFloat(it.quantity))) {
            return errorResponse(`Item #${i + 1} quantity must be greater than zero`, 'VALIDATION_ERROR', 400);
          }
        }
      }

      const status = is_draft ? 'draft' : 'saved';
      const tally_sync_status = is_draft ? 'draft' : 'pending';
      const created_by = authUser ? authUser.id : null;

      // 4. Insert Transaction into PostgreSQL
      const insertTxSql = `
        INSERT INTO transactions (
          voucher_number, voucher_type, voucher_date, reference_number,
          party_ledger, account_ledger, narration, subtotal, tax_amount,
          total_amount, debit_credit, status, tally_sync_status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *;
      `;

      const insertTxParams = [
        voucher_number.trim(),
        voucher_type.trim(),
        voucher_date,
        reference_number.trim() || null,
        party_ledger.trim(),
        account_ledger.trim(),
        narration.trim() || null,
        parseFloat(subtotal) || 0,
        parseFloat(tax_amount) || 0,
        totalNum,
        debit_credit || 'Dr',
        status,
        tally_sync_status,
        created_by,
      ];

      const txResult = await query(insertTxSql, insertTxParams);
      const newTransaction = txResult.rows[0];

      // 5. Insert Line Items
      if (items && items.length > 0) {
        for (const item of items) {
          await query(
            `INSERT INTO transaction_items (
              transaction_id, item_name, description, quantity, rate,
              discount, tax_percentage, tax_amount, amount
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              newTransaction.id,
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

      // 6. Trigger Tally Synchronization if requested and not draft
      let syncResult = null;
      if (!is_draft && auto_sync) {
        try {
          syncResult = await syncTransactionToTally({
            transactionId: newTransaction.id,
            forceRetry: false,
          });
        } catch (syncErr) {
          console.error('Auto sync exception:', syncErr);
          syncResult = {
            success: false,
            message: syncErr.message,
            errorCode: 'TALLY_SYNC_EXCEPTION',
          };
        }
      }

      return successResponse(
        {
          transaction: newTransaction,
          syncResult,
        },
        201
      );
    } catch (err) {
      console.error('Create transaction error:', err);
      return errorResponse('Failed to create transaction', 'CREATE_ERROR', 500);
    }
  }

  return errorResponse('Method Not Allowed', 'METHOD_NOT_ALLOWED', 405);
}
