/**
 * Tally XML Builder
 * Generates standards-compliant Tally XML for accounting vouchers and inventory entries.
 */

function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatTallyDate(dateStr) {
  // Converts YYYY-MM-DD or ISO string to YYYYMMDD
  if (!dateStr) {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  }
  const clean = dateStr.replace(/[^0-9]/g, '').slice(0, 8);
  if (clean.length === 8) return clean;
  const d = new Date(dateStr);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function generateTallyVoucherXml(transaction, items = [], companyName = 'Default Company') {
  const {
    voucher_number,
    voucher_type,
    voucher_date,
    reference_number,
    party_ledger,
    account_ledger,
    narration,
    subtotal = 0,
    tax_amount = 0,
    total_amount = 0,
    tally_master_id,
  } = transaction;

  const tallyDate = formatTallyDate(voucher_date);
  const action = tally_master_id ? 'Alter' : 'Create';
  const total = Number(total_amount) || 0;
  const sub = Number(subtotal) || total;
  const tax = Number(tax_amount) || 0;

  let inventoryXml = '';
  let ledgerXml = '';

  const hasItems = items && items.length > 0;

  // Build items and ledgers based on voucher type
  switch (voucher_type) {
    case 'Sales':
      if (hasItems) {
        inventoryXml = items.map((item) => {
          const qty = Number(item.quantity) || 1;
          const rate = Number(item.rate) || 0;
          const amt = Number(item.amount) || (qty * rate);
          return `
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${escapeXml(item.item_name)}</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <RATE>${rate.toFixed(2)}/Nos</RATE>
              <AMOUNT>${amt.toFixed(2)}</AMOUNT>
              <ACTUALQTY>${qty} Nos</ACTUALQTY>
              <BILLEDQTY>${qty} Nos</BILLEDQTY>
              <ACCOUNTINGALLOCATIONS.LIST>
                <LEDGERNAME>${escapeXml(account_ledger)}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${amt.toFixed(2)}</AMOUNT>
              </ACCOUNTINGALLOCATIONS.LIST>
            </ALLINVENTORYENTRIES.LIST>
          `;
        }).join('');
      } else {
        // Pure Accounting Sales
        ledgerXml += `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(account_ledger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${sub.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        `;
      }

      // Party Debit (Negative in Tally XML for Sales Party)
      ledgerXml = `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(party_ledger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${total.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      ` + ledgerXml;

      // Tax Ledger Credit
      if (tax > 0) {
        ledgerXml += `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Output IGST 18%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${tax.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        `;
      }
      break;

    case 'Purchase':
      if (hasItems) {
        inventoryXml = items.map((item) => {
          const qty = Number(item.quantity) || 1;
          const rate = Number(item.rate) || 0;
          const amt = Number(item.amount) || (qty * rate);
          return `
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${escapeXml(item.item_name)}</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <RATE>${rate.toFixed(2)}/Nos</RATE>
              <AMOUNT>-${amt.toFixed(2)}</AMOUNT>
              <ACTUALQTY>${qty} Nos</ACTUALQTY>
              <BILLEDQTY>${qty} Nos</BILLEDQTY>
              <ACCOUNTINGALLOCATIONS.LIST>
                <LEDGERNAME>${escapeXml(account_ledger)}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>-${amt.toFixed(2)}</AMOUNT>
              </ACCOUNTINGALLOCATIONS.LIST>
            </ALLINVENTORYENTRIES.LIST>
          `;
        }).join('');
      } else {
        ledgerXml += `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(account_ledger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-${sub.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        `;
      }

      // Party Credit (Positive in Tally XML for Purchase Creditor)
      ledgerXml += `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(party_ledger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${total.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      `;

      if (tax > 0) {
        ledgerXml += `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Input CGST 9%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-${tax.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        `;
      }
      break;

    case 'Payment':
      // Party/Expense Dr (-), Bank/Cash Cr (+)
      ledgerXml = `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(party_ledger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${total.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(account_ledger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${total.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      `;
      break;

    case 'Receipt':
      // Bank/Cash Dr (-), Party Cr (+)
      ledgerXml = `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(account_ledger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${total.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(party_ledger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${total.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      `;
      break;

    case 'Contra':
    case 'Journal':
    default:
      // Dr party_ledger (-), Cr account_ledger (+)
      ledgerXml = `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(party_ledger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${total.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(account_ledger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${total.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      `;
      break;
  }

  const masterIdTag = tally_master_id ? `<MASTERID>${escapeXml(tally_master_id)}</MASTERID>` : '';

  const fullEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${escapeXml(voucher_type)}" ACTION="${action}">
            ${masterIdTag}
            <DATE>${tallyDate}</DATE>
            <VOUCHERTYPENAME>${escapeXml(voucher_type)}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(voucher_number)}</VOUCHERNUMBER>
            <REFERENCE>${escapeXml(reference_number || '')}</REFERENCE>
            <PARTYLEDGERNAME>${escapeXml(party_ledger)}</PARTYLEDGERNAME>
            <NARRATION>${escapeXml(narration || '')}</NARRATION>
            <FBTPAYMENTTYPE>Default</FBTPAYMENTTYPE>
            <PERSISTEDVIEW>Invoice View</PERSISTEDVIEW>
            ${inventoryXml}
            ${ledgerXml}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  return fullEnvelope;
}
