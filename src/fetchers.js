import got from 'got';
import dotenv from 'dotenv';

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

    if (!workspaceId || !readToken) {
        log(`❌ Missing workspaceId or readToken for fetching ${entityType}. Check your environment variables or input configuration.`);
        throw new Error('Missing Datagol API credentials.');
    }

    const url = `${baseUrl}/workspaces/${workspaceId}/tables/${tableId}/data/external`;

    const headers = {
        'Authorization': `Bearer ${readToken}`,
        'Content-Type': 'application/json'
    };
    
    log(`Using Authorization: Bearer token for reading ${entityType}`);

    try {
        log(`Fetching ${entityType} from Datagol API...`);
        const response = await got.post(url, {
            headers,
            json: { requestPageDetails: { pageNumber: 1, pageSize: 500 } },
            responseType: 'json',
            timeout: { request: 10000 },
            throwHttpErrors: false
        });

        if (response.statusCode !== 200) {
            throw new Error(`API returned status ${response.statusCode}`);
        }

        const responseData = response.body;
        let items = [];

        // Handle different response formats
        if (Array.isArray(responseData)) {
            items = responseData;
        } else if (responseData?.data && Array.isArray(responseData.data)) {
            items = responseData.data;
        } else if (responseData?.items && Array.isArray(responseData.items)) {
            items = responseData.items;
        }

        log(`✅ Fetched ${items.length} ${entityType} from Datagol API`);
        return items.map(item => {
            // Extract the name field if it exists, otherwise use the entire item
            if (item && typeof item === 'object' && 'name' in item) {
                return item.name;
            }
            return item;
        });
    } catch (error) {
        log(`❌ Failed to fetch ${entityType} from Datagol API: ${error.message}`);
        throw error; // Let the caller handle the fallback
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

// Helper function to log messages
const log = (message) => console.log(`[fetchers] ${message}`);

const fetchData = async (tableId, entityName, defaultData, dataMapper) => {
    const data = await fetchFromDatagol(tableId, entityName);

    if (!data) {
        log(`No ${entityName} found in API response, using defaults`);
        return defaultData;
    }

    const mappedData = data.map(dataMapper).filter(Boolean);

    if (mappedData.length === 0) {
        log(`No ${entityName} found in API response, using defaults`);
        return defaultData;
    }

    log(`✅ Fetched ${mappedData.length} ${entityName} from external API`);
    return mappedData;
};

/**
 * Fetches job titles from the external API
 * @returns {Promise<string[]>} Array of job titles
 */
export const fetchJobTitles = async () => {
    return fetchData(
        '395a586f-2d3e-4489-a5d9-be0039f97aa1',
        'job titles',
        DEFAULT_JOB_TITLES,
        (item) => item.title || item.name || item.jobTitle
    );
};

/**
 * Fetches the excluded companies list from the external API
 * @returns {Promise<string[]>} Array of company names to exclude
 */
export const fetchExcludedCompanies = async () => {
    return fetchData(
        'ac27bdbc-b564-429e-815d-356d58b00d06',
        'excluded companies',
        DEFAULT_EXCLUDED_COMPANIES,
        (item) => (item.company || item.name || item.companyName)?.trim()
    );
};

/**
 * Fetches locations from the external API
 * @returns {Promise<string[]>} Array of location names
 */
export const fetchLocations = async () => {
    const data = await fetchFromDatagol('6122189a-764f-40a9-9721-d756b7dd3626', 'locations');

    if (!data) {
        log('No locations found in API response, using defaults');
        return DEFAULT_LOCATIONS;
    }

    const locations = [];
    const seen = new Set();

    data.forEach(item => {
        const location = item.location || item.city || item.name || item.title;
        if (location && typeof location === 'string' && !seen.has(location.trim())) {
            seen.add(location.trim());
            locations.push(location.trim());
        }
    });

    if (locations.length === 0) {
        log('No locations found in API response, using defaults');
        return DEFAULT_LOCATIONS;
    }

    log(`✅ Fetched ${locations.length} locations from external API`);
    return locations;
};

export const fetchAllData = async () => {
    const [jobTitles, excludedCompanies, locations] = await Promise.all([
        fetchJobTitles(),
        fetchExcludedCompanies(),
        fetchLocations()
    ]);
    
    return { jobTitles, excludedCompanies, locations };
};

export default {
    fetchJobTitles,
    fetchExcludedCompanies,
    fetchLocations,
    fetchAllData,
    // Export defaults for testing
    DEFAULT_JOB_TITLES,
    DEFAULT_EXCLUDED_COMPANIES,
    DEFAULT_LOCATIONS
};