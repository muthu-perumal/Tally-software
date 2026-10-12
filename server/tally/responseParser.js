/**
 * Tally Response Parser
 * Safely parses XML response returned by Tally HTTP interface.
 */

export function parseTallyResponse(responseText = '') {
  if (!responseText || typeof responseText !== 'string') {
    return {
      isSuccess: false,
      errorMessage: 'Empty response received from Tally server.',
      masterId: null,
      alterId: null,
      created: 0,
      altered: 0,
      errors: 1,
    };
  }

  const cleanText = responseText.trim();

  // 1. Check for basic HTTP or network error dumps
  if (cleanText.startsWith('<!DOCTYPE') || cleanText.startsWith('<html')) {
    return {
      isSuccess: false,
      errorMessage: 'Tally server returned an HTML error page instead of XML. Check Tally URL and port.',
      masterId: null,
      alterId: null,
      created: 0,
      altered: 0,
      errors: 1,
    };
  }

  // 2. Extract key tags with regex (fast, reliable across varied Tally XML formats)
  const extractTag = (tag) => {
    const match = cleanText.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
    return match ? match[1].trim() : null;
  };

  const created = parseInt(extractTag('CREATED') || '0', 10);
  const altered = parseInt(extractTag('ALTERED') || '0', 10);
  const errors = parseInt(extractTag('ERRORS') || '0', 10);
  const lastVchId = extractTag('LASTVCHID') || extractTag('LASTMID');
  const masterId = extractTag('MASTERID') || lastVchId;
  const alterId = extractTag('ALTERID') || String(Date.now());

  // Error extraction
  let lineError = extractTag('LINEERROR');
  if (!lineError) {
    const errorMatch = cleanText.match(/<DESC>([\s\S]*?)<\/DESC>/i) ||
                       cleanText.match(/<ERROR>([\s\S]*?)<\/ERROR>/i) ||
                       cleanText.match(/<EXCEPTION>([\s\S]*?)<\/EXCEPTION>/i);
    if (errorMatch) {
      lineError = errorMatch[1].trim();
    }
  }

  // Check success condition:
  // If ERRORS > 0 or CREATED + ALTERED === 0 (and no valid lastVchId)
  if (errors > 0 || (created === 0 && altered === 0 && !lastVchId)) {
    let failureMsg = lineError || 'Tally rejected the voucher import without specific details.';
    if (cleanText.includes('does not exist')) {
      failureMsg = lineError || 'Ledger or Item specified does not exist in Tally.';
    } else if (cleanText.includes('Date is outside')) {
      failureMsg = 'Voucher date is outside the active books period in Tally.';
    }
    return {
      isSuccess: false,
      errorMessage: failureMsg,
      masterId: null,
      alterId: null,
      created,
      altered,
      errors: errors || 1,
    };
  }

  return {
    isSuccess: true,
    errorMessage: null,
    masterId: masterId || `M-${Date.now()}`,
    alterId: alterId || `A-${Date.now()}`,
    created,
    altered,
    errors: 0,
  };
}
