import { query } from '../../server/db.js';
import { ensureDatabaseSchema } from '../../server/schemaInit.js';
import { checkTallyHealth } from '../../server/tally/tallyService.js';
import { successResponse, errorResponse, optionsResponse } from '../../server/utils/response.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  if (event.httpMethod !== 'GET') {
    return errorResponse('Method Not Allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  try {
    await ensureDatabaseSchema();

    // Aggregated stats
    const statsQuery = `
      SELECT
        COUNT(*)::int AS total_count,
        COUNT(*) FILTER (WHERE tally_sync_status = 'synced')::int AS synced_count,
        COUNT(*) FILTER (WHERE tally_sync_status = 'pending')::int AS pending_count,
        COUNT(*) FILTER (WHERE tally_sync_status = 'failed')::int AS failed_count,
        COUNT(*) FILTER (WHERE tally_sync_status = 'draft')::int AS draft_count,
        COUNT(*) FILTER (WHERE tally_sync_status = 'synced' AND updated_at::date = CURRENT_DATE)::int AS synced_today,
        COALESCE(SUM(total_amount), 0)::numeric(14,2) AS total_volume
      FROM transactions;
    `;

    // Recent 10 transactions
    const recentQuery = `
      SELECT 
        t.id,
        t.voucher_number,
        t.voucher_type,
        t.voucher_date,
        t.party_ledger,
        t.account_ledger,
        t.total_amount,
        t.debit_credit,
        t.status,
        t.tally_sync_status,
        t.tally_master_id,
        t.created_at,
        u.name AS created_by_name
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      ORDER BY t.created_at DESC
      LIMIT 10;
    `;

    const [statsRes, recentRes, health] = await Promise.all([
      query(statsQuery),
      query(recentQuery),
      checkTallyHealth(),
    ]);

    const stats = statsRes.rows[0] || {
      total_count: 0,
      synced_count: 0,
      pending_count: 0,
      failed_count: 0,
      draft_count: 0,
      synced_today: 0,
      total_volume: 0,
    };

    return successResponse({
      stats,
      recentTransactions: recentRes.rows,
      tallyHealth: health,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return errorResponse('Unable to load dashboard data', 'DASHBOARD_ERROR', 500);
  }
}
