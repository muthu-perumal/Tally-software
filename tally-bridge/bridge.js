/**
 * Local Tally Bridge Daemon
 * Runs on the local PC where Tally Prime or Tally.ERP 9 is installed (localhost:9000).
 * Bridges between Cloud Netlify/PostgreSQL and local LAN Tally.
 */

const CLOUD_URL = process.env.CLOUD_PORTAL_URL || 'http://localhost:8888';
const LOCAL_TALLY_URL = process.env.LOCAL_TALLY_URL || 'http://localhost:9000';
const BRIDGE_API_KEY = process.env.TALLY_BRIDGE_API_KEY || 'default_bridge_key';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);

console.log('====================================================');
console.log('   Tally Sync Portal - Local Bridge Client          ');
console.log('====================================================');
console.log(`Cloud Portal Endpoint : ${CLOUD_URL}`);
console.log(`Local Tally Endpoint  : ${LOCAL_TALLY_URL}`);
console.log(`Poll Interval         : ${POLL_INTERVAL_MS}ms`);
console.log('====================================================\n');

async function testLocalTally() {
  try {
    const pingXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>List of Companies</REPORTNAME></REQUESTDESC></EXPORTDATA></BODY>
</ENVELOPE>`;
    const res = await fetch(LOCAL_TALLY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml;charset=utf-8' },
      body: pingXml,
    });
    if (res.ok) {
      console.log('✅ Local Tally is accessible and responding at ' + LOCAL_TALLY_URL);
    } else {
      console.warn(`⚠️ Local Tally responded with HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`⚠️ Could not reach Local Tally at ${LOCAL_TALLY_URL}: ${err.message}`);
    console.warn('   Ensure Tally is open and ODBC/XML port 9000 is enabled in F12 -> Advanced Configuration.');
  }
}

async function processPendingQueue() {
  try {
    const queueUrl = `${CLOUD_URL}/.netlify/functions/tally-bridge`;
    const resp = await fetch(queueUrl, {
      headers: {
        'x-bridge-key': BRIDGE_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!resp.ok) {
      return;
    }

    const data = await resp.json();
    if (!data.success || !data.data || !data.data.pending || data.data.pending.length === 0) {
      return; // Queue is empty
    }

    const queue = data.data.pending;
    console.log(`[${new Date().toLocaleTimeString()}] Found ${queue.length} pending transaction(s) to sync.`);

    for (const item of queue) {
      console.log(` -> Processing Voucher #${item.voucher_number} (${item.voucher_type})...`);

      let responseText = '';
      let httpStatus = 0;
      let syncSuccess = false;
      let errorMsg = null;

      try {
        const tallyResp = await fetch(LOCAL_TALLY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml;charset=utf-8' },
          body: item.xml_payload,
        });

        httpStatus = tallyResp.status;
        responseText = await tallyResp.text();

        // Check for error in response
        if (responseText.includes('<ERRORS>0</ERRORS>') || responseText.includes('<CREATED>1</CREATED>')) {
          syncSuccess = true;
          console.log(`    ✅ Successfully posted to Tally: #${item.voucher_number}`);
        } else {
          syncSuccess = false;
          const match = responseText.match(/<LINEERROR>([\s\S]*?)<\/LINEERROR>/i);
          errorMsg = match ? match[1].trim() : 'Tally rejected import';
          console.error(`    ❌ Tally rejected: ${errorMsg}`);
        }
      } catch (postErr) {
        httpStatus = 0;
        syncSuccess = false;
        errorMsg = `Failed to connect to local Tally: ${postErr.message}`;
        console.error(`    ❌ Local Tally error: ${errorMsg}`);
      }

      // Send ACK back to Cloud Portal
      try {
        const ackResp = await fetch(`${CLOUD_URL}/.netlify/functions/tally-bridge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-bridge-key': BRIDGE_API_KEY,
          },
          body: JSON.stringify({
            transactionId: item.id,
            syncStatus: syncSuccess ? 'synced' : 'failed',
            httpStatus,
            responsePayload: responseText,
            errorMessage: errorMsg,
          }),
        });

        const ackResult = await ackResp.json();
        if (ackResult.success) {
          console.log(`    📝 Status acknowledged by Cloud Portal for #${item.voucher_number}`);
        }
      } catch (ackErr) {
        console.error(`    ❌ Failed to send ACK to Cloud Portal: ${ackErr.message}`);
      }
    }
  } catch (err) {
    // Silent catch during periodic polling
  }
}

async function start() {
  await testLocalTally();
  console.log(`📡 Bridge polling started. Listening for transactions...\n`);
  setInterval(processPendingQueue, POLL_INTERVAL_MS);
}

start();
