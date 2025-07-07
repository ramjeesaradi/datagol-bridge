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

/**
 * Fetches job titles from the external API
 * @returns {Promise<string[]>} Array of job titles
 */
export const fetchJobTitles = async () => {
    const data = await fetchFromDatagol('395a586f-2d3e-4489-a5d9-be0039f97aa1', 'job titles');

    if (!data) {
        log('No job titles found in API response, using defaults');
        return DEFAULT_JOB_TITLES;
    }

    const jobTitles = data
        .map(item => item.title || item.name || item.jobTitle)
        .filter(Boolean);

    if (jobTitles.length === 0) {
        log('No job titles found in API response, using defaults');
        return DEFAULT_JOB_TITLES;
    }

    log(`✅ Fetched ${jobTitles.length} job titles from external API`);
    return jobTitles;
};

/**
 * Fetches the competitor list from the external API
 * @returns {Promise<string[]>} Array of company names to exclude
 */
export const fetchCompetitorList = async () => {
    const data = await fetchFromDatagol('ac27bdbc-b564-429e-815d-356d58b00d06', 'competitors');

    if (!data) {
        log('No companies found in API response, using defaults');
        return DEFAULT_EXCLUDED_COMPANIES;
    }

    const companies = data
        .map(item => item.company || item.name || item.companyName)
        .filter(Boolean)
        .map(company => company.trim());

    if (companies.length === 0) {
        log('No companies found in API response, using defaults');
        return DEFAULT_EXCLUDED_COMPANIES;
    }

    log(`✅ Fetched ${companies.length} companies from external API`);
    return companies;
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