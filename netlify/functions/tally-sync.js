import { query } from '../../server/db.js';
import { ensureDatabaseSchema } from '../../server/schemaInit.js';
import { syncTransactionToTally } from '../../server/tally/tallyService.js';
import { successResponse, errorResponse, optionsResponse } from '../../server/utils/response.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  if (event.httpMethod !== 'POST') {
    return errorResponse('Method Not Allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  await ensureDatabaseSchema();

  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return errorResponse('Invalid JSON payload', 'INVALID_JSON', 400);
    }

    const { transactionId, transactionIds, syncAllPending } = body;

    // 1. Single Transaction Sync
    if (transactionId) {
      const result = await syncTransactionToTally({ transactionId, forceRetry: false });
      return successResponse(result);
    }

    // 2. Batch Sync: Sync All Pending
    if (syncAllPending) {
      const pendingRes = await query(
        `SELECT id, voucher_number FROM transactions 
         WHERE tally_sync_status IN ('pending', 'failed') 
         ORDER BY voucher_date ASC, created_at ASC 
         LIMIT 50`
      );

      const queue = pendingRes.rows;
      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (const item of queue) {
        try {
          const res = await syncTransactionToTally({ transactionId: item.id, forceRetry: true });
          if (res.success && res.status === 'synced') {
            successCount++;
          } else {
            failCount++;
          }
          results.push({ id: item.id, voucherNumber: item.voucher_number, ...res });
        } catch (e) {
          failCount++;
          results.push({ id: item.id, voucherNumber: item.voucher_number, success: false, error: e.message });
        }
      }

      return successResponse({
        processedCount: queue.length,
        successCount,
        failCount,
        details: results,
      });
    }

    // 3. Batch Sync: Specified List of IDs
    if (Array.isArray(transactionIds) && transactionIds.length > 0) {
      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (const id of transactionIds) {
        try {
          const res = await syncTransactionToTally({ transactionId: id, forceRetry: true });
          if (res.success && res.status === 'synced') {
            successCount++;
          } else {
            failCount++;
          }
          results.push({ id, ...res });
        } catch (e) {
          failCount++;
          results.push({ id, success: false, error: e.message });
        }
      }

      return successResponse({
        processedCount: transactionIds.length,
        successCount,
        failCount,
        details: results,
      });
    }

    return errorResponse(
      'Please provide either transactionId, transactionIds array, or syncAllPending flag',
      'MISSING_PARAMETERS',
      400
    );
  } catch (err) {
    console.error('Tally sync error:', err);
    return errorResponse('Failed to execute Tally sync', 'SYNC_ERROR', 500);
  }
}
