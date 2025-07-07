import got from 'got';

const DATAGOL_API_TOKEN = process.env.DATAGOL_API_TOKEN || process.env.DATAGOL_TOKEN;

const COMMON_HEADERS = {
    'x-auth-token': DATAGOL_API_TOKEN,
    'Content-Type': 'application/json',
};

const log = (message) => console.log(`[services] ${message}`);

/**
 * Fetches data from a Datagol table.
 * @param {string} tableId The ID of the table to fetch data from.
 * @param {string} entityName The name of the entity being fetched (for logging).
 * @returns {Promise<Array<any>|null>} A promise that resolves to an array of data items, or null on failure.
 */
export const fetchFromDatagol = async (tableId, entityName) => {
    try {
        log(`Fetching ${entityName} from Datagol API...`);
        const response = await got.post(
            `https://be-eu.datagol.ai/noCo/api/v2/workspaces/8e894b95-cc40-44f0-88d7-4aae346b0325/tables/${tableId}/data/external`,
            {
                headers: COMMON_HEADERS,
                throwHttpErrors: false,
                json: {
                    requestPageDetails: {
                        pageNumber: 1,
                        pageSize: 500
                    }
                },
                responseType: 'json',
                timeout: { request: 10000 }
            }
        );

        const data = Array.isArray(response.body?.data) ? response.body.data : null;
        if (response.statusCode !== 200 || !data) {
            log(`Unexpected API response for ${entityName} (status ${response.statusCode})`);
            return null;
        }

        log(`✅ Fetched ${data.length} ${entityName} from Datagol API`);
        return data;
    } catch (error) {
        log(`❌ Failed to fetch ${entityName} from Datagol API: ${error.message}`);
        return null;
    }
};