# Tally Sync Portal

A simple, production-ready full-stack accounting web application for capturing transactions, storing them in **Neon PostgreSQL**, and syncing them into **Tally Prime / Tally.ERP 9**.

Built with **React (Vite)**, **Netlify Functions (Node.js)**, **Neon Serverless PostgreSQL**, and **Modern CSS**.

---

## 🌟 Key Features

1. **Accounting Vouchers**:
   - Multi-voucher support: **Sales**, **Purchase**, **Payment**, **Receipt**, **Journal**, and **Contra**.
   - Dynamic inventory line items (Item, Description, Qty, Rate, Discount, Tax %, Line Total) with real-time tax & total calculations.
   - Dual action: **Save as Draft** or **Save & Sync to Tally**.

2. **Database First Integrity**:
   - Transactions are committed to PostgreSQL first.
   - Network dropouts with Tally never cause transaction loss.
   - PostgreSQL remains the single source of truth for transaction logs.

3. **Tally Synchronization Engine**:
   - Standards-compliant Tally XML envelope generator with proper debit/credit signs and inventory allocations.
   - Idempotency & duplicate voucher protection using Tally `MASTERID` and `ALTERID`.
   - Full diagnostic audit logging (request XML, response XML, HTTP status, error reasons).

4. **Dual Connection Architecture**:
   - **MODE A (Direct Cloud HTTP)**: If Tally is reachable over public IP/VPN.
   - **MODE B (Local Tally Bridge)**: Out-of-the-box lightweight daemon for LAN Tally running on `http://localhost:9000`.
   - **Mock Mode (`TALLY_MOCK_MODE=true`)**: Instant offline testing without a live Tally instance.

5. **Security & Deployment**:
   - Deploys as **ONE Netlify site** (`dist/` frontend + `netlify/functions/` backend).
   - Zero DB passwords or Tally secrets exposed to the browser.
   - Parameterized SQL for SQL injection safety.

---

## 🚀 Quick Start Guide

### 1. Installation

```bash
git clone <repo-url>
cd Tally
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set your configuration:
```env
# Neon PostgreSQL Connection URL
DATABASE_URL=postgresql://your_user:your_password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require

# Tally Server Details
TALLY_URL=http://localhost:9000
TALLY_COMPANY=Your Company Name in Tally

# Connection Mode: direct | bridge
TALLY_CONNECTION_MODE=direct

# Mock Mode (set to "true" for testing without Tally)
TALLY_MOCK_MODE=true

# Security
JWT_SECRET=super_secure_random_key_here
TALLY_BRIDGE_API_KEY=your_bridge_secret_key
```

### 3. Initialize Database

Run the SQL migration script located at:
```
database/migrations/001_initial_schema.sql
```
*(Note: Netlify Functions also include an automated schema bootstrap that will auto-create missing tables upon first run!)*

Default login credentials seeded in migration:
- **Admin**: `admin@tallysync.com` / `admin123`
- **Accountant**: `accountant@tallysync.com` / `user123`

### 4. Run Locally

To run the complete frontend and Netlify backend functions locally:

```bash
# Using Netlify CLI (Recommended for testing functions + frontend together)
npx netlify dev

# Or run frontend only with mock fallback
npm run dev
```

The portal will be live at `http://localhost:5173` (or `http://localhost:8888` if using `netlify dev`).

---

## 🌉 Local Tally Bridge (For Localhost:9000 Tally)

If Tally runs locally on an office desktop, Netlify Functions in the cloud cannot reach `http://localhost:9000` directly. 

1. Ensure Tally has ODBC/XML enabled:
   - In Tally: Press `F1` (Help) → `Settings` → `Connectivity`.
   - Set **Client/Server Configuration**: *Tally is acting as: Server/Both*, *Port: 9000*.
   - Open your target company in Tally.

2. In Portal Settings, change **Connection Mode** to **Local Tally Bridge**.

3. Run the local bridge on the computer where Tally is running:
   ```bash
   cd tally-bridge
   npm start
   ```

The local bridge daemon will safely poll the portal, forward pending vouchers to `localhost:9000`, and report results back to the database.

---

## 🚢 Netlify Deployment

1. Push this repository to GitHub / GitLab.
2. In the Netlify Dashboard, create a new site from your repository.
3. Netlify will automatically detect `netlify.toml`:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
4. In Netlify Site Settings → **Environment Variables**, add:
   - `DATABASE_URL`
   - `TALLY_URL`
   - `TALLY_COMPANY`
   - `TALLY_MOCK_MODE` (set to `false` for live Tally sync)
   - `JWT_SECRET`
   - `TALLY_BRIDGE_API_KEY`
5. Deploy Site!
