# Local Tally Bridge

This utility runs on the local computer where **Tally Prime** or **Tally.ERP 9** is running.

Since Netlify Functions run in the cloud, they cannot directly connect to `http://localhost:9000` on your office computer without a public IP or port forwarding. The Local Tally Bridge solves this by acting as a secure outbound connector.

---

### How It Works

```
1. You save a transaction in Tally Sync Portal (Netlify + Neon).
2. The transaction is saved in PostgreSQL with status 'pending'.
3. This local bridge regularly polls the Cloud Portal for pending transactions.
4. When a pending transaction is found, the bridge sends the Tally XML to http://localhost:9000.
5. Tally imports the voucher and returns a response.
6. The bridge sends the response back to the cloud portal, marking it as 'synced' or 'failed'.
```

---

### Prerequisites

1. **Node.js** (v18 or higher installed on your computer).
2. **Tally Prime / Tally.ERP 9** running with ODBC/XML Server enabled:
   - In Tally: Press `F1` (Help) → `Settings` → `Connectivity` (or `F12` in older versions).
   - Set **Client/Server Configuration**:
     - *Tally is acting as*: Both or Server
     - *Enable ODBC Server*: Yes
     - *Port*: `9000`
   - Keep your target company opened in Tally.

---

### Running the Bridge

1. Open a terminal inside this `tally-bridge/` folder:
   ```bash
   cd tally-bridge
   ```

2. Set environment variables (or create a `.env` file):
   - Windows PowerShell:
     ```powershell
     $env:CLOUD_PORTAL_URL="https://your-site.netlify.app"
     $env:LOCAL_TALLY_URL="http://localhost:9000"
     $env:TALLY_BRIDGE_API_KEY="your_configured_bridge_key"
     npm start
     ```
   - Linux / macOS:
     ```bash
     CLOUD_PORTAL_URL="https://your-site.netlify.app" \
     LOCAL_TALLY_URL="http://localhost:9000" \
     TALLY_BRIDGE_API_KEY="your_configured_bridge_key" \
     npm start
     ```

3. The bridge will output:
   ```
   ====================================================
      Tally Sync Portal - Local Bridge Client          
   ====================================================
   Cloud Portal Endpoint : https://your-site.netlify.app
   Local Tally Endpoint  : http://localhost:9000
   ✅ Local Tally is accessible and responding at http://localhost:9000
   📡 Bridge polling started. Listening for transactions...
   ```
