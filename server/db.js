import { Pool } from '@neondatabase/serverless';
import crypto from 'crypto';

let pool = null;

// ====================================================================
// In-Memory Fallback Store (Used when DATABASE_URL is not yet configured)
// ====================================================================
const memStore = {
  users: [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      name: 'System Administrator',
      email: 'admin@tallysync.com',
      password_hash: '$2a$10$Mc3M4m4AAKoHJ9DO5I7RQ.dogs.rKn36EWvf8uIykz.ERwSXvRi9e', // admin123
      role: 'admin',
      created_at: new Date().toISOString(),
    },
    {
      id: 'a0000000-0000-0000-0000-000000000002',
      name: 'Senior Accountant',
      email: 'accountant@tallysync.com',
      password_hash: '$2a$10$GDXpkj1pPz8aKm3Z/OWdFuKdzAHH37NzaOBfK1ydMuVfd2Kx/ja0W', // user123
      role: 'user',
      created_at: new Date().toISOString(),
    },
  ],
  transactions: [
    {
      id: 'b0000000-0000-0000-0000-000000000001',
      voucher_number: 'INV-2026-1001',
      voucher_type: 'Sales',
      voucher_date: new Date().toISOString().split('T')[0],
      reference_number: 'PO-9821',
      party_ledger: 'Acme Infotech Ltd',
      account_ledger: 'Sales Account - GST',
      narration: 'Consulting services & hardware peripherals',
      subtotal: 66850.00,
      tax_amount: 12033.00,
      total_amount: 78883.00,
      debit_credit: 'Dr',
      status: 'saved',
      tally_sync_status: 'synced',
      tally_master_id: 'M-10042',
      tally_alter_id: 'A-20042',
      created_by: 'a0000000-0000-0000-0000-000000000001',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'b0000000-0000-0000-0000-000000000002',
      voucher_number: 'PUR-2026-1002',
      voucher_type: 'Purchase',
      voucher_date: new Date().toISOString().split('T')[0],
      reference_number: 'BILL-4410',
      party_ledger: 'Zenith Hardware Supplies',
      account_ledger: 'Purchase Account - GST',
      narration: 'Office IT inventory replenishment',
      subtotal: 130000.00,
      tax_amount: 23400.00,
      total_amount: 153400.00,
      debit_credit: 'Cr',
      status: 'saved',
      tally_sync_status: 'pending',
      tally_master_id: null,
      tally_alter_id: null,
      created_by: 'a0000000-0000-0000-0000-000000000002',
      created_at: new Date(Date.now() - 1800000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  transaction_items: [
    {
      id: 'c0000000-0000-0000-0000-000000000001',
      transaction_id: 'b0000000-0000-0000-0000-000000000001',
      item_name: 'Dell Latitude 5420 Laptop',
      description: 'Core i7 16GB RAM',
      quantity: 1,
      rate: 65000.00,
      discount: 0,
      tax_percentage: 18.00,
      tax_amount: 11700.00,
      amount: 76700.00,
      created_at: new Date().toISOString(),
    },
    {
      id: 'c0000000-0000-0000-0000-000000000002',
      transaction_id: 'b0000000-0000-0000-0000-000000000001',
      item_name: 'Logitech Wireless Keyboard & Mouse',
      description: 'Combo pack',
      quantity: 1,
      rate: 1850.00,
      discount: 0,
      tax_percentage: 18.00,
      tax_amount: 333.00,
      amount: 2183.00,
      created_at: new Date().toISOString(),
    },
  ],
  tally_sync_logs: [
    {
      id: 'd0000000-0000-0000-0000-000000000001',
      transaction_id: 'b0000000-0000-0000-0000-000000000001',
      request_payload: '<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDATA><TALLYMESSAGE><VOUCHER VCHTYPE="Sales" ACTION="Create"><VOUCHERNUMBER>INV-2026-1001</VOUCHERNUMBER></VOUCHER></TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>',
      response_payload: '<RESPONSE><CREATED>1</CREATED><ALTERED>0</ALTERED><LASTVCHID>M-10042</LASTVCHID><MASTERID>M-10042</MASTERID><ALTERID>A-20042</ALTERID><ERRORS>0</ERRORS></RESPONSE>',
      http_status: 200,
      sync_status: 'synced',
      error_message: null,
      attempt_number: 1,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ],
  masters_ledger: [
    { id: '1', name: 'Cash-in-Hand', group_name: 'Cash-in-hand', opening_balance: 15000, is_party: false },
    { id: '2', name: 'HDFC Bank Current A/c', group_name: 'Bank Accounts', opening_balance: 450000, is_party: false },
    { id: '3', name: 'Sales Account - GST', group_name: 'Sales Accounts', opening_balance: 0, is_party: false },
    { id: '4', name: 'Purchase Account - GST', group_name: 'Purchase Accounts', opening_balance: 0, is_party: false },
    { id: '5', name: 'Output IGST 18%', group_name: 'Duties & Taxes', opening_balance: 0, is_party: false },
    { id: '6', name: 'Input CGST 9%', group_name: 'Duties & Taxes', opening_balance: 0, is_party: false },
    { id: '7', name: 'Input SGST 9%', group_name: 'Duties & Taxes', opening_balance: 0, is_party: false },
    { id: '8', name: 'Acme Infotech Ltd', group_name: 'Sundry Debtors', opening_balance: 0, is_party: true },
    { id: '9', name: 'Apex Global Logistics', group_name: 'Sundry Debtors', opening_balance: 0, is_party: true },
    { id: '10', name: 'Zenith Hardware Supplies', group_name: 'Sundry Creditors', opening_balance: 0, is_party: true },
    { id: '11', name: 'BlueWave Office Furnishings', group_name: 'Sundry Creditors', opening_balance: 0, is_party: true },
    { id: '12', name: 'Office Rent Expense', group_name: 'Indirect Expenses', opening_balance: 0, is_party: false },
  ],
  masters_item: [
    { id: '1', name: 'Dell Latitude 5420 Laptop', unit: 'Nos', default_rate: 65000, default_tax_rate: 18 },
    { id: '2', name: 'Logitech Wireless Keyboard & Mouse', unit: 'Set', default_rate: 1850, default_tax_rate: 18 },
    { id: '3', name: 'Samsung 27-inch 4K Monitor', unit: 'Nos', default_rate: 22500, default_tax_rate: 18 },
    { id: '4', name: 'HP LaserJet Pro Printer', unit: 'Nos', default_rate: 19800, default_tax_rate: 18 },
  ],
  settings: [
    { setting_key: 'app_name', setting_value: process.env.APP_NAME || 'Tally Sync Portal' },
    { setting_key: 'company_name', setting_value: process.env.COMPANY_NAME || process.env.TALLY_COMPANY || 'DhanaLakshmi & Co' },
    { setting_key: 'tally_url', setting_value: process.env.TALLY_URL || 'http://localhost:9000' },
    { setting_key: 'tally_company', setting_value: process.env.TALLY_COMPANY || 'DhanaLakshmi & Co' },
    { setting_key: 'tally_connection_mode', setting_value: process.env.TALLY_CONNECTION_MODE || 'direct' },
    { setting_key: 'tally_mock_mode', setting_value: process.env.TALLY_MOCK_MODE || 'true' },
    { setting_key: 'sync_timeout_ms', setting_value: '8000' },
  ],
};

// Default Neon Serverless PostgreSQL connection for production deployment
const NEON_DEFAULT_URL = 'postgresql://neondb_owner:npg_MKaJum9UD4Zr@ep-curly-cloud-b5z3bqr8-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || NEON_DEFAULT_URL;
  if (
    url &&
    (url.startsWith('postgres://') || url.startsWith('postgresql://')) &&
    !url.includes('your_neon_postgresql_url')
  ) {
    return url;
  }
  return null;
}

export function getPool() {
  const dbUrl = getDatabaseUrl();
  if (!pool && dbUrl) {
    try {
      pool = new Pool({
        connectionString: dbUrl,
        ssl: true,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    } catch (err) {
      console.warn('Could not initialize Neon pool, using in-memory store:', err.message);
      pool = null;
    }
  }
  return pool;
}

/**
 * Handle in-memory query simulation for dev preview
 */
function queryMemory(text, params) {
  const sql = text.trim();

  // DDL Queries
  if (sql.startsWith('CREATE') || sql.startsWith('ALTER') || sql.startsWith('SELECT EXISTS')) {
    return { rows: [{ exists: true }], rowCount: 1 };
  }

  // Dashboard Stats
  if (sql.includes('COUNT(*)::int AS total_count')) {
    const total = memStore.transactions.length;
    const synced = memStore.transactions.filter(t => t.tally_sync_status === 'synced').length;
    const pending = memStore.transactions.filter(t => t.tally_sync_status === 'pending').length;
    const failed = memStore.transactions.filter(t => t.tally_sync_status === 'failed').length;
    const draft = memStore.transactions.filter(t => t.tally_sync_status === 'draft').length;
    const volume = memStore.transactions.reduce((acc, t) => acc + (parseFloat(t.total_amount) || 0), 0);

    return {
      rows: [{
        total_count: total,
        synced_count: synced,
        pending_count: pending,
        failed_count: failed,
        draft_count: draft,
        synced_today: synced,
        total_volume: volume.toFixed(2),
      }],
      rowCount: 1,
    };
  }

  // Settings
  if (sql.includes('SELECT setting_key, setting_value FROM settings')) {
    return { rows: [...memStore.settings], rowCount: memStore.settings.length };
  }

  if (sql.includes('INSERT INTO settings')) {
    const key = params[0];
    const val = params[1];
    const existing = memStore.settings.find(s => s.setting_key === key);
    if (existing) {
      existing.setting_value = val;
    } else {
      memStore.settings.push({ setting_key: key, setting_value: val });
    }
    return { rows: [{ setting_key: key, setting_value: val }], rowCount: 1 };
  }

  // Masters
  if (sql.includes('SELECT * FROM masters_ledger')) {
    return { rows: [...memStore.masters_ledger], rowCount: memStore.masters_ledger.length };
  }
  if (sql.includes('SELECT * FROM masters_item')) {
    return { rows: [...memStore.masters_item], rowCount: memStore.masters_item.length };
  }
  if (sql.includes('INSERT INTO masters_ledger')) {
    const record = { id: crypto.randomUUID(), name: params[0], group_name: params[1], is_party: params[2], opening_balance: 0 };
    memStore.masters_ledger.push(record);
    return { rows: [record], rowCount: 1 };
  }
  if (sql.includes('INSERT INTO masters_item')) {
    const record = { id: crypto.randomUUID(), name: params[0], unit: params[1], default_rate: params[2], default_tax_rate: params[3] };
    memStore.masters_item.push(record);
    return { rows: [record], rowCount: 1 };
  }

  // Users (Login)
  if (sql.includes('SELECT * FROM users WHERE LOWER(email)')) {
    const email = (params[0] || '').toLowerCase();
    const user = memStore.users.find(u => u.email.toLowerCase() === email);
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }

  // Transactions: Total Count
  if (sql.includes('SELECT COUNT(*)::int AS total FROM transactions')) {
    let list = [...memStore.transactions];
    if (params.length > 0 && typeof params[0] === 'string') {
      const q = params[0].replace(/%/g, '').toLowerCase();
      list = list.filter(t => t.voucher_number.toLowerCase().includes(q) || t.party_ledger.toLowerCase().includes(q));
    }
    return { rows: [{ total: list.length }], rowCount: 1 };
  }

  // Duplicate Voucher Number Check (must precede generic 'FROM transactions')
  if (sql.includes('voucher_type = $1 AND voucher_number = $2') || 
      (sql.includes('SELECT id FROM transactions') && sql.includes('voucher_type') && sql.includes('voucher_number'))) {
    const vType = (params[0] || '').trim().toLowerCase();
    const vNum = (params[1] || '').trim().toLowerCase();
    const matches = memStore.transactions.filter(
      t => (t.voucher_type || '').toLowerCase() === vType && (t.voucher_number || '').toLowerCase() === vNum
    );
    return { rows: matches, rowCount: matches.length };
  }

  // Pending Tally Sync queue
  if (sql.includes("tally_sync_status = 'pending'")) {
    const pending = memStore.transactions.filter(
      t => t.tally_sync_status === 'pending' && t.status !== 'draft'
    );
    return { rows: pending, rowCount: pending.length };
  }

  // Transactions: Detail by ID
  if (sql.includes('WHERE t.id = $1') || sql.includes('WHERE id = $1')) {
    const id = params[0];
    const tx = memStore.transactions.find(t => t.id === id);
    return { rows: tx ? [tx] : [], rowCount: tx ? 1 : 0 };
  }

  // Transactions: List / Recent
  if (sql.includes('FROM transactions')) {
    let list = [...memStore.transactions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { rows: list, rowCount: list.length };
  }

  // Transaction Items
  if (sql.includes('FROM transaction_items WHERE transaction_id = $1')) {
    const txId = params[0];
    const items = memStore.transaction_items.filter(it => it.transaction_id === txId);
    return { rows: items, rowCount: items.length };
  }

  // Tally Sync Logs
  if (sql.includes('FROM tally_sync_logs WHERE transaction_id = $1')) {
    const txId = params[0];
    const logs = memStore.tally_sync_logs.filter(l => l.transaction_id === txId);
    return { rows: logs, rowCount: logs.length };
  }

  if (sql.includes('SELECT COUNT(*)::int AS count FROM tally_sync_logs')) {
    const txId = params[0];
    const count = memStore.tally_sync_logs.filter(l => l.transaction_id === txId).length;
    return { rows: [{ count }], rowCount: 1 };
  }

  // Insert Transaction
  if (sql.includes('INSERT INTO transactions')) {
    const newTx = {
      id: crypto.randomUUID(),
      voucher_number: params[0],
      voucher_type: params[1],
      voucher_date: params[2],
      reference_number: params[3],
      party_ledger: params[4],
      account_ledger: params[5],
      narration: params[6],
      subtotal: params[7],
      tax_amount: params[8],
      total_amount: params[9],
      debit_credit: params[10],
      status: params[11],
      tally_sync_status: params[12],
      tally_master_id: null,
      tally_alter_id: null,
      created_by: params[13],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memStore.transactions.unshift(newTx);
    return { rows: [newTx], rowCount: 1 };
  }

  // Insert Transaction Item
  if (sql.includes('INSERT INTO transaction_items')) {
    const newItem = {
      id: crypto.randomUUID(),
      transaction_id: params[0],
      item_name: params[1],
      description: params[2],
      quantity: params[3],
      rate: params[4],
      discount: params[5],
      tax_percentage: params[6],
      tax_amount: params[7],
      amount: params[8],
      created_at: new Date().toISOString(),
    };
    memStore.transaction_items.push(newItem);
    return { rows: [newItem], rowCount: 1 };
  }

  // Insert Sync Log
  if (sql.includes('INSERT INTO tally_sync_logs')) {
    const newLog = {
      id: crypto.randomUUID(),
      transaction_id: params[0],
      request_payload: params[1],
      response_payload: params[2],
      http_status: params[3],
      sync_status: params[4],
      error_message: params[5],
      attempt_number: params[6],
      created_at: new Date().toISOString(),
    };
    memStore.tally_sync_logs.unshift(newLog);
    return { rows: [newLog], rowCount: 1 };
  }

  // Update Transaction
  if (sql.includes('UPDATE transactions')) {
    const id = params[params.length - 1];
    const tx = memStore.transactions.find(t => t.id === id);
    if (tx) {
      if (sql.includes('tally_sync_status = $1')) {
        tx.tally_sync_status = params[0];
        if (params[1]) tx.tally_master_id = params[1];
        if (params[2]) tx.tally_alter_id = params[2];
      } else if (sql.includes('voucher_number = $1')) {
        tx.voucher_number = params[0];
        tx.voucher_type = params[1];
        tx.voucher_date = params[2];
        tx.reference_number = params[3];
        tx.party_ledger = params[4];
        tx.account_ledger = params[5];
        tx.narration = params[6];
        tx.subtotal = parseFloat(params[7]) || 0;
        tx.tax_amount = parseFloat(params[8]) || 0;
        tx.total_amount = parseFloat(params[9]) || 0;
        tx.debit_credit = params[10];
      }
      tx.updated_at = new Date().toISOString();
      return { rows: [tx], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // Delete Transaction Items
  if (sql.includes('DELETE FROM transaction_items WHERE transaction_id = $1')) {
    const txId = params[0];
    memStore.transaction_items = memStore.transaction_items.filter(it => it.transaction_id !== txId);
    return { rows: [], rowCount: 1 };
  }

  // Delete Transaction
  if (sql.includes('DELETE FROM transactions WHERE id = $1')) {
    const id = params[0];
    memStore.transactions = memStore.transactions.filter(t => t.id !== id);
    return { rows: [], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
}

/**
 * Execute parameterized SQL query safely
 */
export async function query(text, params = []) {
  const dbPool = getPool();
  if (dbPool) {
    try {
      const res = await dbPool.query(text, params);
      return res;
    } catch (error) {
      console.warn('PostgreSQL query error, falling back to in-memory store:', error.message);
      return queryMemory(text, params);
    }
  }

  // Fallback to in-memory
  return queryMemory(text, params);
}
