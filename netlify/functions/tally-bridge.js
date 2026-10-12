import { query } from '../../server/db.js';
import { ensureDatabaseSchema } from '../../server/schemaInit.js';
import { generateTallyVoucherXml } from '../../server/tally/xmlBuilder.js';
import { parseTallyResponse } from '../../server/tally/responseParser.js';
import { getTallyConfig } from '../../server/tally/tallyService.js';
import { successResponse, errorResponse, optionsResponse } from '../../server/utils/response.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();

  await ensureDatabaseSchema();

  // Validate Bridge Security Token
  const configuredKey = process.env.TALLY_BRIDGE_API_KEY || 'default_bridge_key';
  const providedKey = event.headers['x-bridge-key'] || event.headers['X-Bridge-Key'];

  if (providedKey !== configuredKey) {
    return errorResponse('Unauthorized: Invalid or missing bridge API key', 'UNAUTHORIZED_BRIDGE', 401);
  }

  // -------------------------------------------------------------
  // GET: Local Bridge polls for pending transactions
  // -------------------------------------------------------------
  if (event.httpMethod === 'GET') {
    try {
      const config = await getTallyConfig();

      const pendingRes = await query(
        `SELECT * FROM transactions 
         WHERE tally_sync_status = 'pending' 
         ORDER BY voucher_date ASC, created_at ASC 
         LIMIT 10`
      );

      const queue = [];

      for (const tx of pendingRes.rows) {
        const itemsRes = await query(
          'SELECT * FROM transaction_items WHERE transaction_id = $1 ORDER BY created_at ASC',
          [tx.id]
        );
        const xml = generateTallyVoucherXml(tx, itemsRes.rows, config.companyName);

        queue.push({
          id: tx.id,
          voucher_number: tx.voucher_number,
          voucher_type: tx.voucher_type,
          voucher_date: tx.voucher_date,
          total_amount: tx.total_amount,
          xml_payload: xml,
        });
      }

      return successResponse({ pending: queue });
    } catch (err) {
      console.error('Bridge poll error:', err);
      return errorResponse('Failed to fetch pending bridge queue', 'BRIDGE_POLL_ERROR', 500);
    }
  }

  // -------------------------------------------------------------
  // POST: Local Bridge reports result back to Cloud
  // -------------------------------------------------------------
  if (event.httpMethod === 'POST') {
    try {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return errorResponse('Invalid JSON body', 'INVALID_JSON', 400);
      }

      const { transactionId, syncStatus, httpStatus = 200, responsePayload = '', errorMessage = null } = body;

      if (!transactionId) {
        return errorResponse('Missing transactionId in bridge report', 'MISSING_ID', 400);
      }

      // Parse response if XML provided
      const parsed = parseTallyResponse(responsePayload);
      const isActuallySynced = syncStatus === 'synced' && parsed.isSuccess;
      const finalStatus = isActuallySynced ? 'synced' : 'failed';
      const finalError = isActuallySynced ? null : (errorMessage || parsed.errorMessage || 'Tally sync failed');

      // Attempt counter
      const logCountRes = await query(
        'SELECT COUNT(*)::int AS count FROM tally_sync_logs WHERE transaction_id = $1',
        [transactionId]
      );
      const attemptNumber = (logCountRes.rows[0]?.count || 0) + 1;

      // Log to sync logs
      await query(
        `INSERT INTO tally_sync_logs 
         (transaction_id, request_payload, response_payload, http_status, sync_status, error_message, attempt_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          transactionId,
          'PROCESSED_VIA_LOCAL_BRIDGE',
          responsePayload,
          httpStatus,
          finalStatus,
          finalError,
          attemptNumber,
        ]
      );

      // Update transactions
      await query(
        `UPDATE transactions 
         SET tally_sync_status = $1, 
             tally_master_id = COALESCE($2, tally_master_id), 
             tally_alter_id = COALESCE($3, tally_alter_id), 
             updated_at = NOW() 
         WHERE id = $4`,
        [finalStatus, parsed.masterId, parsed.alterId, transactionId]
      );

      return successResponse({
        acknowledged: true,
        transactionId,
        status: finalStatus,
      });
    } catch (err) {
      console.error('Bridge ack error:', err);
      return errorResponse('Failed to record bridge sync acknowledgement', 'BRIDGE_ACK_ERROR', 500);
    }
  }

  return errorResponse('Method Not Allowed', 'METHOD_NOT_ALLOWED', 405);
}
