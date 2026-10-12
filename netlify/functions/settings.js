import { query } from '../../server/db.js';
import { ensureDatabaseSchema } from '../../server/schemaInit.js';
import { checkTallyHealth } from '../../server/tally/tallyService.js';
import { successResponse, errorResponse, optionsResponse } from '../../server/utils/response.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();

  await ensureDatabaseSchema();

  // -------------------------------------------------------------
  // GET: Fetch System & Tally Settings
  // -------------------------------------------------------------
  if (event.httpMethod === 'GET') {
    try {
      const res = await query('SELECT setting_key, setting_value FROM settings');
      const settingsMap = {};
      for (const row of res.rows) {
        settingsMap[row.setting_key] = row.setting_value;
      }

      // Merge with process.env fallbacks
      const resolved = {
        app_name: settingsMap.app_name || process.env.APP_NAME || 'Tally Sync Portal',
        company_name: settingsMap.company_name || process.env.COMPANY_NAME || 'Acme Trading & Services Ltd.',
        tally_url: settingsMap.tally_url || process.env.TALLY_URL || 'http://localhost:9000',
        tally_company: settingsMap.tally_company || process.env.TALLY_COMPANY || 'Acme Trading Co (2025-2026)',
        tally_connection_mode: settingsMap.tally_connection_mode || process.env.TALLY_CONNECTION_MODE || 'direct',
        tally_mock_mode: settingsMap.tally_mock_mode !== undefined ? settingsMap.tally_mock_mode : (process.env.TALLY_MOCK_MODE || 'true'),
        sync_timeout_ms: settingsMap.sync_timeout_ms || '8000',
      };

      return successResponse(resolved);
    } catch (err) {
      console.error('Fetch settings error:', err);
      return errorResponse('Failed to fetch settings', 'SETTINGS_FETCH_ERROR', 500);
    }
  }

  // -------------------------------------------------------------
  // POST / PUT: Update Settings & Optionally Test Connection
  // -------------------------------------------------------------
  if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
    try {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return errorResponse('Invalid JSON body', 'INVALID_JSON', 400);
      }

      const { test_connection, settings = {} } = body;

      // Update settings in database
      const keys = Object.keys(settings);
      for (const key of keys) {
        const val = String(settings[key]);
        await query(
          `INSERT INTO settings (setting_key, setting_value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (setting_key) 
           DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
          [key, val]
        );
      }

      let testResult = null;
      if (test_connection) {
        testResult = await checkTallyHealth();
      }

      return successResponse({
        message: 'Settings updated successfully',
        testResult,
      });
    } catch (err) {
      console.error('Save settings error:', err);
      return errorResponse('Failed to update settings', 'SETTINGS_SAVE_ERROR', 500);
    }
  }

  return errorResponse('Method Not Allowed', 'METHOD_NOT_ALLOWED', 405);
}
