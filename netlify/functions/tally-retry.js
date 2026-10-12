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

    const { transactionId } = body;
    if (!transactionId) {
      return errorResponse('Transaction ID is required to retry sync', 'MISSING_ID', 400);
    }

    // Force retry sync
    const result = await syncTransactionToTally({ transactionId, forceRetry: true });
    return successResponse(result);
  } catch (err) {
    console.error('Tally retry error:', err);
    return errorResponse('Failed to retry Tally synchronization', 'RETRY_ERROR', 500);
  }
}
