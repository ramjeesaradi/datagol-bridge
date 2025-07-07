import { fetchFromDatagol } from './services.js';

// Default values for fallback
const DEFAULT_JOB_TITLES = [
    'Financial controller',
    'Business controller',
    'Financial analyst',
    'FP&A',
    'Finance Business Partner',
    'Contrôleur de gestion',
    'Analyste Financier',
    'Financieel analist',
    'Financieel controller',
    'Accountant',
    'comptable',
    'boekhouder',
    'gestionnaire de dossiers',
    'dossierbeheerder',
];

const DEFAULT_EXCLUDED_COMPANIES = [
    'Deloitte',
    'PwC',
    'EY',
    'KPMG',
    'Accenture',
    'Deloitte Belgium',
    'PwC Belgium',
    'EY Belgium',
    'KPMG Belgium',
    'Accenture Belgium'
];

const DEFAULT_LOCATIONS = [
    'Brussels',
    'Namur',
    'Charleroi',
    'Liège',
    'Mons',
    'Arlon',
];

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
 * Fetches the competitor list from the external API
 * @returns {Promise<string[]>} Array of company names to exclude
 */
export const fetchCompetitorList = async () => {
    return fetchData(
        'ac27bdbc-b564-429e-815d-356d58b00d06',
        'competitors',
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
        fetchCompetitorList(),
        fetchLocations()
    ]);
    
    return { jobTitles, excludedCompanies, locations };
};

export default {
    fetchJobTitles,
    fetchCompetitorList,
    fetchLocations,
    fetchAllData,
    // Export defaults for testing
    DEFAULT_JOB_TITLES,
    DEFAULT_EXCLUDED_COMPANIES,
    DEFAULT_LOCATIONS
};