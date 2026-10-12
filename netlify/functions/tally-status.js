import { checkTallyHealth, getTallyConfig } from '../../server/tally/tallyService.js';
import { successResponse, errorResponse, optionsResponse } from '../../server/utils/response.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  if (event.httpMethod !== 'GET') {
    return errorResponse('Method Not Allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  try {
    const config = await getTallyConfig();
    const health = await checkTallyHealth();

    return successResponse({
      status: health.online ? 'connected' : 'disconnected',
      health,
      config: {
        tallyUrl: config.tallyUrl,
        companyName: config.companyName,
        connectionMode: config.connectionMode,
        mockMode: config.mockMode,
      },
    });
  } catch (err) {
    console.error('Tally status check error:', err);
    return errorResponse('Failed to check Tally connection', 'STATUS_CHECK_ERROR', 500);
  }
}
