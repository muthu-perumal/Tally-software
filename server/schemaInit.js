import { query } from './db.js';

let isInitialized = false;
let initPromise = null;

export function ensureDatabaseSchema() {
  if (isInitialized) return Promise.resolve(true);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Check if settings table already exists
      const checkRes = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'settings'
        );
      `);

      if (checkRes.rows[0]?.exists) {
        // Double check transactions table
        const txCheck = await query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'transactions'
          );
        `);
        if (txCheck.rows[0]?.exists) {
          isInitialized = true;
          return true;
        }
      }

      console.log('Initializing PostgreSQL database schema...');

      // Safe extension creation (Postgres 13+ in Neon has gen_random_uuid natively)
      try {
        await query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
      } catch (extErr) {
        // Ignore duplicate extension or permission warnings
      }

      // 1. SETTINGS TABLE FIRST
      await query(`
        CREATE TABLE IF NOT EXISTS settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          setting_key VARCHAR(100) UNIQUE NOT NULL,
          setting_value TEXT,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 2. USERS TABLE
      await query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'user',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 3. TRANSACTIONS TABLE
      await query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          voucher_number VARCHAR(100) NOT NULL,
          voucher_type VARCHAR(50) NOT NULL,
          voucher_date DATE NOT NULL,
          reference_number VARCHAR(100),
          party_ledger VARCHAR(255) NOT NULL,
          account_ledger VARCHAR(255) NOT NULL,
          narration TEXT,
          subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          debit_credit VARCHAR(10) NOT NULL DEFAULT 'Dr',
          status VARCHAR(50) NOT NULL DEFAULT 'saved',
          tally_sync_status VARCHAR(50) NOT NULL DEFAULT 'pending',
          tally_master_id VARCHAR(100),
          tally_alter_id VARCHAR(100),
          created_by UUID REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT unique_voucher_number_type UNIQUE (voucher_type, voucher_number)
        );
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_transactions_sync_status ON transactions(tally_sync_status);
        CREATE INDEX IF NOT EXISTS idx_transactions_voucher_date ON transactions(voucher_date DESC);
        CREATE INDEX IF NOT EXISTS idx_transactions_voucher_type ON transactions(voucher_type);
      `);

      // 4. TRANSACTION ITEMS
      await query(`
        CREATE TABLE IF NOT EXISTS transaction_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
          item_name VARCHAR(255) NOT NULL,
          description TEXT,
          quantity NUMERIC(12, 3) NOT NULL DEFAULT 1.000,
          rate NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          discount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          tax_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
          tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 5. TALLY SYNC LOGS
      await query(`
        CREATE TABLE IF NOT EXISTS tally_sync_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
          request_payload TEXT,
          response_payload TEXT,
          http_status INTEGER,
          sync_status VARCHAR(50) NOT NULL,
          error_message TEXT,
          attempt_number INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 6. MASTERS
      await query(`
        CREATE TABLE IF NOT EXISTS masters_ledger (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) UNIQUE NOT NULL,
          group_name VARCHAR(255) NOT NULL,
          opening_balance NUMERIC(14, 2) DEFAULT 0.00,
          is_party BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS masters_item (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) UNIQUE NOT NULL,
          unit VARCHAR(50) DEFAULT 'Nos',
          default_rate NUMERIC(14, 2) DEFAULT 0.00,
          default_tax_rate NUMERIC(5, 2) DEFAULT 0.00,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Insert seeds
      await query(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES 
          ('a0000000-0000-0000-0000-000000000001', 'System Administrator', 'admin@tallysync.com', '$2a$10$Mc3M4m4AAKoHJ9DO5I7RQ.dogs.rKn36EWvf8uIykz.ERwSXvRi9e', 'admin'),
          ('a0000000-0000-0000-0000-000000000002', 'Senior Accountant', 'accountant@tallysync.com', '$2a$10$GDXpkj1pPz8aKm3Z/OWdFuKdzAHH37NzaOBfK1ydMuVfd2Kx/ja0W', 'user')
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
      `);

      const companyName = process.env.TALLY_COMPANY || 'DhanaLakshmi & Co';
      const appName = process.env.APP_NAME || 'Tally Sync Portal';
      const tallyUrl = process.env.TALLY_URL || 'http://localhost:9000';
      const connMode = process.env.TALLY_CONNECTION_MODE || 'direct';
      const mockMode = process.env.TALLY_MOCK_MODE || 'true';

      await query(`
        INSERT INTO settings (setting_key, setting_value)
        VALUES 
          ('app_name', $1),
          ('company_name', $2),
          ('tally_url', $3),
          ('tally_company', $2),
          ('tally_connection_mode', $4),
          ('tally_mock_mode', $5),
          ('sync_timeout_ms', '8000')
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;
      `, [appName, companyName, tallyUrl, connMode, mockMode]);

      await query(`
        INSERT INTO masters_ledger (name, group_name, is_party)
        VALUES 
          ('Cash-in-Hand', 'Cash-in-hand', FALSE),
          ('HDFC Bank Current A/c', 'Bank Accounts', FALSE),
          ('Sales Account - GST', 'Sales Accounts', FALSE),
          ('Purchase Account - GST', 'Purchase Accounts', FALSE),
          ('Output IGST 18%', 'Duties & Taxes', FALSE),
          ('Output CGST 9%', 'Duties & Taxes', FALSE),
          ('Output SGST 9%', 'Duties & Taxes', FALSE),
          ('Input CGST 9%', 'Duties & Taxes', FALSE),
          ('Input SGST 9%', 'Duties & Taxes', FALSE),
          ('Acme Infotech Ltd', 'Sundry Debtors', TRUE),
          ('Apex Global Logistics', 'Sundry Debtors', TRUE),
          ('Zenith Hardware Supplies', 'Sundry Creditors', TRUE),
          ('BlueWave Office Furnishings', 'Sundry Creditors', TRUE)
        ON CONFLICT (name) DO NOTHING;
      `);

      await query(`
        INSERT INTO masters_item (name, unit, default_rate, default_tax_rate)
        VALUES 
          ('Dell Latitude 5420 Laptop', 'Nos', 65000.00, 18.00),
          ('Logitech Wireless Keyboard & Mouse', 'Set', 1850.00, 18.00),
          ('Samsung 27-inch 4K Monitor', 'Nos', 22500.00, 18.00),
          ('HP LaserJet Pro Printer', 'Nos', 19800.00, 18.00)
        ON CONFLICT (name) DO NOTHING;
      `);

      isInitialized = true;
      console.log('PostgreSQL schema initialized successfully with company:', companyName);
      return true;
    } catch (err) {
      console.warn('Database schema ensure check warning:', err.message);
      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}
