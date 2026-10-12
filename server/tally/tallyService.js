import { query } from '../db.js';
import { ensureDatabaseSchema } from '../schemaInit.js';
import { generateTallyVoucherXml } from './xmlBuilder.js';
import { parseTallyResponse } from './responseParser.js';

/**
 * Fetch settings from DB with fallback to process.env
 */
export async function getTallyConfig() {
  const defaults = {
    tallyUrl: process.env.TALLY_URL || 'http://localhost:9000',
    companyName: process.env.TALLY_COMPANY || 'DhanaLakshmi & Co',
    connectionMode: process.env.TALLY_CONNECTION_MODE || 'direct',
    mockMode: (process.env.TALLY_MOCK_MODE === 'true' || process.env.TALLY_MOCK_MODE === '1'),
    timeoutMs: 8000,
  };

  try {
    await ensureDatabaseSchema();
    const res = await query('SELECT setting_key, setting_value FROM settings');
    const dbSettings = {};
    for (const row of res.rows) {
      dbSettings[row.setting_key] = row.setting_value;
    }

    if (dbSettings.tally_company) defaults.companyName = dbSettings.tally_company;
    else if (dbSettings.company_name) defaults.companyName = dbSettings.company_name;
    if (dbSettings.tally_url) defaults.tallyUrl = dbSettings.tally_url;
    if (dbSettings.tally_company) defaults.companyName = dbSettings.tally_company;
    if (dbSettings.tally_connection_mode) defaults.connectionMode = dbSettings.tally_connection_mode;
    if (dbSettings.tally_mock_mode !== undefined) {
      defaults.mockMode = dbSettings.tally_mock_mode === 'true' || dbSettings.tally_mock_mode === '1';
    }
    if (dbSettings.sync_timeout_ms) {
      defaults.timeoutMs = parseInt(dbSettings.sync_timeout_ms, 10) || 8000;
    }
  } catch (err) {
    // If settings table not available yet, fall back gracefully to environment variables
    console.warn('Could not read settings table, using environment defaults:', err.message);
  }

  return defaults;
}

/**
 * Send transaction to Tally (or queue for bridge, or simulate mock)
 */
export async function syncTransactionToTally({ transactionId, forceRetry = false }) {
  // 1. Fetch transaction
  const txRes = await query('SELECT * FROM transactions WHERE id = $1', [transactionId]);
  if (txRes.rowCount === 0) {
    throw new Error(`Transaction with ID ${transactionId} not found.`);
  }
  const transaction = txRes.rows[0];

  // 2. Fetch line items
  const itemsRes = await query(
    'SELECT * FROM transaction_items WHERE transaction_id = $1 ORDER BY created_at ASC',
    [transactionId]
  );
  const items = itemsRes.rows;

  // 3. Idempotency check: prevent duplicate posting
  if (transaction.tally_sync_status === 'synced' && transaction.tally_master_id && !forceRetry) {
    return {
      success: true,
      alreadySynced: true,
      message: `Transaction ${transaction.voucher_number} is already synced to Tally (Master ID: ${transaction.tally_master_id}).`,
      tally_master_id: transaction.tally_master_id,
    };
  }

  // 4. Determine attempt count
  const logCountRes = await query(
    'SELECT COUNT(*)::int AS count FROM tally_sync_logs WHERE transaction_id = $1',
    [transactionId]
  );
  const attemptNumber = (logCountRes.rows[0]?.count || 0) + 1;

  // 5. Load configuration
  const config = await getTallyConfig();

  // If Mode is Local Bridge, mark pending so local bridge agent picks it up
  if (config.connectionMode === 'bridge' && !config.mockMode) {
    await query(
      `UPDATE transactions 
       SET tally_sync_status = 'pending', updated_at = NOW() 
       WHERE id = $1`,
      [transactionId]
    );

    await query(
      `INSERT INTO tally_sync_logs 
       (transaction_id, request_payload, response_payload, http_status, sync_status, error_message, attempt_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        transactionId,
        'QUEUED_FOR_LOCAL_BRIDGE',
        null,
        202,
        'pending',
        'Queued for Local Tally Bridge polling',
        attemptNumber,
      ]
    );

    return {
      success: true,
      status: 'pending',
      mode: 'bridge',
      message: 'Transaction queued for Local Tally Bridge pickup.',
    };
  }

  // Generate XML
  const requestXml = generateTallyVoucherXml(transaction, items, config.companyName);

  // Handle Mock Mode
  if (config.mockMode) {
    const mockMasterId = `MOCK-${Date.now().toString().slice(-6)}`;
    const mockAlterId = `ALT-${Math.floor(1000 + Math.random() * 9000)}`;
    const mockResponseXml = `<RESPONSE>
  <CREATED>1</CREATED>
  <ALTERED>0</ALTERED>
  <LASTVCHID>${mockMasterId}</LASTVCHID>
  <LASTMID>${mockMasterId}</LASTMID>
  <MASTERID>${mockMasterId}</MASTERID>
  <ALTERID>${mockAlterId}</ALTERID>
  <ERRORS>0</ERRORS>
  <MESSAGE>Simulated success response from Tally Mock Engine</MESSAGE>
</RESPONSE>`;

    // Log success
    await query(
      `INSERT INTO tally_sync_logs 
       (transaction_id, request_payload, response_payload, http_status, sync_status, error_message, attempt_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [transactionId, requestXml, mockResponseXml, 200, 'synced', null, attemptNumber]
    );

    // Update transaction
    await query(
      `UPDATE transactions 
       SET tally_sync_status = 'synced', 
           tally_master_id = $1, 
           tally_alter_id = $2, 
           updated_at = NOW() 
       WHERE id = $3`,
      [mockMasterId, mockAlterId, transactionId]
    );

    return {
      success: true,
      status: 'synced',
      isMock: true,
      message: 'Transaction successfully posted to Tally (Mock Mode).',
      masterId: mockMasterId,
      alterId: mockAlterId,
      requestPayload: requestXml,
      responsePayload: mockResponseXml,
    };
  }

  // Direct Mode HTTP call
  let responseText = '';
  let httpStatus = 0;
  let parsed = { isSuccess: false, errorMessage: 'Unknown network error' };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    const tallyResp = await fetch(config.tallyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=utf-8',
      },
      body: requestXml,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    httpStatus = tallyResp.status;
    responseText = await tallyResp.text();
    parsed = parseTallyResponse(responseText);
  } catch (netErr) {
    httpStatus = 0;
    parsed = {
      isSuccess: false,
      errorMessage: netErr.name === 'AbortError'
        ? `Connection to Tally timed out after ${config.timeoutMs}ms. Ensure Tally server is reachable.`
        : `Network error connecting to Tally at ${config.tallyUrl}: ${netErr.message}`,
    };
  }

  // Update Database & Logs
  const syncStatus = parsed.isSuccess ? 'synced' : 'failed';

  await query(
    `INSERT INTO tally_sync_logs 
     (transaction_id, request_payload, response_payload, http_status, sync_status, error_message, attempt_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      transactionId,
      requestXml,
      responseText || null,
      httpStatus,
      syncStatus,
      parsed.errorMessage,
      attemptNumber,
    ]
  );

  await query(
    `UPDATE transactions 
     SET tally_sync_status = $1, 
         tally_master_id = COALESCE($2, tally_master_id), 
         tally_alter_id = COALESCE($3, tally_alter_id), 
         updated_at = NOW() 
     WHERE id = $4`,
    [syncStatus, parsed.masterId, parsed.alterId, transactionId]
  );

  if (parsed.isSuccess) {
    return {
      success: true,
      status: 'synced',
      message: 'Transaction successfully posted to Tally.',
      masterId: parsed.masterId,
      alterId: parsed.alterId,
      requestPayload: requestXml,
      responsePayload: responseText,
    };
  } else {
    return {
      success: false,
      status: 'failed',
      message: parsed.errorMessage || 'Transaction was saved, but Tally synchronization failed.',
      errorCode: 'TALLY_SYNC_FAILED',
      requestPayload: requestXml,
      responsePayload: responseText,
    };
  }
}

/**
 * Health check & ping for Tally
 */
export async function checkTallyHealth() {
  const config = await getTallyConfig();

  if (config.mockMode) {
    return {
      online: true,
      mode: 'mock',
      url: config.tallyUrl,
      company: config.companyName,
      message: 'Tally Mock Engine is active and simulating responses.',
    };
  }

  if (config.connectionMode === 'bridge') {
    return {
      online: true,
      mode: 'bridge',
      url: config.tallyUrl,
      company: config.companyName,
      message: 'Local Tally Bridge mode enabled. Awaiting local bridge client requests.',
    };
  }

  try {
    const pingXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Companies</REPORTNAME>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(config.tallyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml;charset=utf-8' },
      body: pingXml,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return {
      online: res.ok,
      mode: 'direct',
      statusCode: res.status,
      url: config.tallyUrl,
      company: config.companyName,
      message: res.ok ? 'Connected to Tally directly.' : `Tally responded with HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      online: false,
      mode: 'direct',
      url: config.tallyUrl,
      company: config.companyName,
      message: `Cannot reach Tally at ${config.tallyUrl}: ${err.message}`,
    };
  }
}
