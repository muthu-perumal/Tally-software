import { query } from '../../server/db.js';
import { ensureDatabaseSchema } from '../../server/schemaInit.js';
import { successResponse, errorResponse, optionsResponse } from '../../server/utils/response.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();

  await ensureDatabaseSchema();

  // -------------------------------------------------------------
  // GET: Fetch Masters (Ledgers & Stock Items)
  // -------------------------------------------------------------
  if (event.httpMethod === 'GET') {
    try {
      const [ledgersRes, itemsRes] = await Promise.all([
        query('SELECT * FROM masters_ledger ORDER BY is_party DESC, name ASC'),
        query('SELECT * FROM masters_item ORDER BY name ASC'),
      ]);

      return successResponse({
        ledgers: ledgersRes.rows,
        items: itemsRes.rows,
      });
    } catch (err) {
      console.error('Fetch masters error:', err);
      return errorResponse('Failed to fetch masters', 'MASTERS_FETCH_ERROR', 500);
    }
  }

  // -------------------------------------------------------------
  // POST: Create New Master (Ledger or Item)
  // -------------------------------------------------------------
  if (event.httpMethod === 'POST') {
    try {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return errorResponse('Invalid JSON body', 'INVALID_JSON', 400);
      }

      const { type, name, group_name, is_party = false, unit = 'Nos', default_rate = 0, default_tax_rate = 0 } = body;

      if (!name || !name.trim()) {
        return errorResponse('Master name is required', 'VALIDATION_ERROR', 400);
      }

      if (type === 'ledger') {
        if (!group_name || !group_name.trim()) {
          return errorResponse('Group name is required for ledgers', 'VALIDATION_ERROR', 400);
        }

        const res = await query(
          `INSERT INTO masters_ledger (name, group_name, is_party)
           VALUES ($1, $2, $3)
           ON CONFLICT (name) DO UPDATE SET group_name = EXCLUDED.group_name, is_party = EXCLUDED.is_party
           RETURNING *`,
          [name.trim(), group_name.trim(), Boolean(is_party)]
        );

        return successResponse({ ledger: res.rows[0], message: 'Ledger saved successfully' }, 201);
      } else if (type === 'item') {
        const res = await query(
          `INSERT INTO masters_item (name, unit, default_rate, default_tax_rate)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (name) DO UPDATE SET unit = EXCLUDED.unit, default_rate = EXCLUDED.default_rate, default_tax_rate = EXCLUDED.default_tax_rate
           RETURNING *`,
          [name.trim(), unit.trim() || 'Nos', parseFloat(default_rate) || 0, parseFloat(default_tax_rate) || 0]
        );

        return successResponse({ item: res.rows[0], message: 'Stock item saved successfully' }, 201);
      } else {
        return errorResponse("Invalid master type. Must be 'ledger' or 'item'", 'INVALID_TYPE', 400);
      }
    } catch (err) {
      console.error('Create master error:', err);
      return errorResponse('Failed to save master', 'MASTER_SAVE_ERROR', 500);
    }
  }

  return errorResponse('Method Not Allowed', 'METHOD_NOT_ALLOWED', 405);
}
