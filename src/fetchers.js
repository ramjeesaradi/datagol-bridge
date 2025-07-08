import { log } from 'apify';
import got from 'got';
import dotenv from 'dotenv';
import { buildReportRow } from './reportBase.js';

// Load environment variables
dotenv.config();

/**
 * Fetches data from a Datagol table.
 * @param {Object} config - Configuration object from input schema
 * @param {string} entityType - Type of entity to fetch ('jobTitles', 'excludedCompanies', 'locations')
 * @returns {Promise<Array<any>>} A promise that resolves to an array of data items
 */
async function fetchFromDatagol(config, entityType) {
    const { datagolApi } = config;
    const { baseUrl, workspaceId, readToken, tables } = datagolApi;
    const tableId = tables[entityType];

    if (!tableId) {
        log.warning(`No tableId configured for ${entityType}.`);
        return [];
    }

    if (!workspaceId || !readToken) {
        log.warning(`❌ Missing workspaceId or readToken for fetching ${entityType}. Check environment variables.`);
        return [];
    }

    const url = `${baseUrl}/workspaces/${workspaceId}/tables/${tableId}/data/external`;
    const headers = { 'Authorization': `Bearer ${readToken}`, 'Content-Type': 'application/json' };

    try {
        log.info(`Fetching ${entityType} from Datagol API...`);
        const response = await got.post(url, {
            headers,
            json: { requestPageDetails: { pageNumber: 1, pageSize: 500 } },
            responseType: 'json',
            timeout: { request: 10000 },
        });

        const responseData = response.body;
        let items = [];

        if (Array.isArray(responseData)) {
            items = responseData;
        } else if (responseData?.data && Array.isArray(responseData.data)) {
            items = responseData.data;
        } else if (responseData?.items && Array.isArray(responseData.items)) {
            items = responseData.items;
        }

        log.info(`✅ Fetched ${items.length} ${entityType} from Datagol API`);
        return items;
    } catch (error) {
        log.error(`❌ Failed to fetch ${entityType} from Datagol API: ${error.message}`);
        return []; // Return empty array on error to allow fallback
    }
}

/**
 * Deduplicates an array of items based on specified fields
 * @param {Array} items - Array of items to deduplicate
 * @param {Array} fields - Array of field names to use for deduplication
 * @returns {Array} Deduplicated array
 */
function deduplicateItems(items, fields) {
    if (!Array.isArray(items) || items.length === 0) return [];
    if (!fields || fields.length === 0) return items;

    const seen = new Set();
    return items.filter(item => {
        // Create a composite key from the specified fields
        const key = fields
            .map(field => (item[field] || '').toString().toLowerCase().trim())
            .join('|');
        
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Gets filtered and deduplicated job postings
 * @param {Object} config - Configuration object from input schema
 * @param {Array} jobPostings - Array of job postings to process
 * @returns {Array} Processed job postings
 */
function processJobPostings(config, jobPostings) {
    if (!Array.isArray(jobPostings) || jobPostings.length === 0) {
        return [];
    }

    const { filters, deduplication } = config;
    const { excludedCompanies, postedInLastHours } = filters;
    const now = new Date();
    const postedAfter = new Date(now - (postedInLastHours * 60 * 60 * 1000));

    // Filter out excluded companies and old postings
    const filtered = jobPostings.filter(posting => {
        if (!posting || !posting.company) return false;
        
        // Check if company is in excluded list (case insensitive)
        const companyLower = posting.company.toLowerCase();
        if (excludedCompanies.some(company => 
            companyLower.includes(company.toLowerCase())
        )) {
            return false;
        }

        // Check posting date if available
        if (posting.postedDate) {
            const postedDate = new Date(posting.postedDate);
            if (isNaN(postedDate.getTime()) || postedDate < postedAfter) {
                return false;
            }
        }

        return true;
    });

    // Apply deduplication if enabled
    if (deduplication?.enabled !== false) {
        const fields = Array.isArray(deduplication?.fields) && deduplication.fields.length > 0
            ? deduplication.fields
            : ['title', 'company', 'location'];
            
        return deduplicateItems(filtered, fields);
    }

    return filtered;
}

/**
 * Gets the appropriate values for a filter type, fetching from API if needed
 * @param {Object} config - Configuration object from input schema
 * @param {string} filterType - Type of filter ('jobTitles', 'locations', 'excludedCompanies')
 * @returns {Promise<Array>} Array of filter values
 */
async function getFilterValues(config, filterType) {
    const { filters } = config;
    
    // If values are provided in config, use them
    if (filters[filterType] && Array.isArray(filters[filterType]) && filters[filterType].length > 0) {
        return filters[filterType];
    }

    // Otherwise try to fetch from API
    try {
        // Map competitors to excludedCompanies for backward compatibility
        const apiEntityType = filterType === 'excludedCompanies' ? 'competitors' : filterType;
        return await fetchFromDatagol(config, apiEntityType);
    } catch (error) {
        log(`⚠️ Using default values for ${filterType} due to API error`);
        // Return empty array to use schema defaults
        return [];
    }
}

// Export the main functions
export {
    fetchFromDatagol,
    deduplicateItems,
    processJobPostings,
    getFilterValues
};



const fetchData = async (config, tableId, entityName, defaultData, dataMapper) => {
    let data;
    try {
        data = await fetchFromDatagol(config, entityName);
    } catch (error) {
        log.warning(`API call for ${entityName} failed, using defaults. Error: ${error.message}`);
        return defaultData;
    }

    if (!data) {
        log.warning(`No ${entityName} found in API response, using defaults`);
        return defaultData;
    }

    const mappedData = data.map(dataMapper).filter(Boolean);

    if (mappedData.length === 0) {
        log.warning(`No ${entityName} found in API response, using defaults`);
        return defaultData;
    }

    log.info(`✅ Fetched ${mappedData.length} ${entityName} from external API`);
    return mappedData;
};

/**
 * Fetches job titles from the external API
 * @returns {Promise<string[]>} Array of job titles
 */
export const fetchJobTitles = async (config) => {
    const items = await fetchFromDatagol(config, 'jobTitles');
    return items.map(item => item.title || item.name || item.jobTitle).filter(Boolean);
};

/**
 * Fetches the excluded companies list from the external API
 * @returns {Promise<string[]>} Array of company names to exclude
 */
export const fetchExcludedCompanies = async (config) => {
    const items = await fetchFromDatagol(config, 'excludedCompanies');
    return items.map(item => (item.company || item.name || item.companyName)?.trim()).filter(Boolean);
};

/**
 * Fetches locations from the external API
 * @returns {Promise<string[]>} Array of location names
 */
export const fetchLocations = async (config) => {
    const items = await fetchFromDatagol(config, 'locations');
    const locations = items.map(item => item.location || item.city || item.name || item.title).filter(Boolean);
    return [...new Set(locations)]; // Return unique locations
};

export const fetchAllData = async (config) => {
    const [jobTitles, excludedCompanies, locations] = await Promise.all([
        fetchJobTitles(config),
        fetchExcludedCompanies(config),
        fetchLocations(config)
    ]);
    
    return { jobTitles, excludedCompanies, locations };
};

/**
 * Saves jobs to Datagol API
 * @param {Object} config - Configuration object
 * @param {Array} jobs - Array of job objects to save
 * @returns {Promise<void>}
 */
export async function saveToDatagol(config, jobs) {
    const { datagolApi } = config;
    const { baseUrl, workspaceId, writeToken, tables } = datagolApi;
    const tableId = tables.jobPostings;

    if (!workspaceId || !writeToken) {
        log.warning('❌ Missing workspaceId or writeToken for saving to Datagol. Skipping.');
        return;
    }

    const url = `${baseUrl}/workspaces/${workspaceId}/tables/${tableId}/rows`;
    
    const headers = {
        'x-auth-token': writeToken,
        'Content-Type': 'application/json'
    };

    log.info(`Saving ${jobs.length} jobs to Datagol...`);

    for (const job of jobs) {
        const row = buildReportRow(job);
        try {
            const response = await got.post(url, {
                headers,
                json: row,
                responseType: 'json',
                throwHttpErrors: false
            });

            if (response.statusCode >= 400) {
                log.error(`❌ Failed to save job to Datagol. Status: ${response.statusCode}, Body: ${JSON.stringify(response.body)}`);
            } else {
                log.info(`✅ Successfully saved job: ${job.title}`);
            }
        } catch (error) {
            log.exception(`❌ Exception while saving job to Datagol:`, error);
        }
    }
}

export default {
    fetchJobTitles,
    fetchExcludedCompanies,
    fetchLocations,
    fetchAllData,
    saveToDatagol
};