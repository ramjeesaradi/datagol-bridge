import { log } from 'apify';
import got from 'got';

/**
 * Fetches data from a Datagol table.
 * @param {object} datagolApi - The DataGOL API configuration.
 * @param {string} entityType - The type of entity to fetch ('jobTitles', 'excludedCompanies', 'locations').
 * @returns {Promise<Array<any>>} A promise that resolves to an array of data items.
 */
async function fetchFromDatagol(datagolApi, entityType) {
    const { baseUrl, workspaceId, writeToken, tables } = datagolApi;
    const tableId = tables[entityType];

    if (!tableId) {
        log.warning(`No tableId configured for ${entityType}.`);
        return [];
    }

    if (!workspaceId || !writeToken) {
        log.warning(`Missing workspaceId or writeToken for fetching ${entityType}.`);
        return [];
    }

    try {
        log.info(`Fetching ${entityType} from Datagol API...`);
        const url = `${baseUrl}/workspaces/${workspaceId}/tables/${tableId}/data/external`;
        const response = await got.post(url, {
            headers: { 'x-auth-token': writeToken, 'Content-Type': 'application/json' },
            json: { requestPageDetails: { pageNumber: 1, pageSize: 1000 } }, // Fetch up to 1000 items
            responseType: 'json',
            timeout: { request: 20000 },
        }).json();
        log.info(`API response for ${entityType}: ${JSON.stringify(response)}`);
        const items = response?.data || response?.list || response?.items || (Array.isArray(response) ? response : []);

        if (items.length === 0) {
            log.warning(`No items found for ${entityType} in the API response.`);
        }

        log.info(`Fetched ${items.length} items for ${entityType}.`);
        return items;

    } catch (error) {
        log.error(`Failed to fetch ${entityType} from Datagol API: ${error.message}`);
        log.error(`API error details: ${JSON.stringify(error.response?.body)}`);
        return []; // Return empty array on error to allow fallback
    }
}

/**
 * Fetches all required data from DataGOL in parallel.
 * @param {object} config - The main configuration object.
 * @returns {Promise<{jobTitles: Array, locations: Array, excludedCompanies: Array}>}
 */
export async function fetchAllData(config) {
    const [jobTitlesRaw, locationsRaw, excludedCompaniesRaw] = await Promise.all([
        fetchFromDatagol(config.datagolApi, 'jobTitles'),
        fetchFromDatagol(config.datagolApi, 'locations'),
        fetchFromDatagol(config.datagolApi, 'excludedCompanies'),
    ]);

    // Map and filter the results
    const jobTitles = jobTitlesRaw.map(item => ({ title: item['Job Title'] || item.title })).filter(item => item.title);
    const locations = locationsRaw.map(item => ({ location: item.City || item.location })).filter(item => item.location);
    const excludedCompanies = excludedCompaniesRaw.map(item => item.name).filter(Boolean);

    return { jobTitles, locations, excludedCompanies };
}

/**
 * Saves job postings to the Datagol API, one by one.
 * This function first fetches the table schema to dynamically map job properties to the correct columns.
 * @param {Array<object>} jobs - Array of job objects to save.
 * @param {object} config - The main configuration object.
 */
export async function saveToDatagol(jobs, config) {
    const { datagolApi } = config;
    const { baseUrl, workspaceId, writeToken, tables } = datagolApi;
    const { jobPostings: tableId } = tables;

    if (!workspaceId || !writeToken || !tableId) {
        log.error('Datagol configuration (workspaceId, writeToken, tableId) is missing.');
        return;
    }

    // Define the mapping from our job object keys to the expected Datagol column names.
    // This acts as a translation layer.
    const propertyToColumnMap = {
        title: 'title',
        companyName: 'companyname',
        location: 'location',
        description: 'description',
        jobUrl: 'joburl',
        companyUrl: 'companyurl',
        applyUrl: 'applyurl',
        applyType: 'applytype',
        workType: 'worktype',
        contractType: 'contracttype',
        experienceLevel: 'experiencelevel',
        publishedAt: 'publishedat',
        postedTime: 'postedtime',
        applicationsCount: 'applicationscount',
        salary: 'salary',
        benefits: 'benefits',
        sector: 'sector',
        companyId: 'companyid',
        posterProfileUrl: 'posterprofileurl',
        posterFullName: 'posterfullname'
    };

    const url = `${baseUrl}/workspaces/${workspaceId}/tables/${tableId}/rows`; // Correct endpoint for adding rows
    const headers = { 'x-auth-token': writeToken, 'Content-Type': 'application/json', 'Accept': '*/*' };

    log.info(`Saving ${jobs.length} jobs to Datagol one by one...`);

    for (const job of jobs) {
        const rowPayload = {};
        // Build the payload using the defined mapping.
        for (const [property, columnName] of Object.entries(propertyToColumnMap)) {
            if (job[property] !== undefined && job[property] !== null) {
                rowPayload[columnName] = job[property];
            }
        }

        if (Object.keys(rowPayload).length === 0) {
            log.warn('Skipping job with no data to save.', { job });
            continue;
        }

        try {
            //log.info(`Saving job: ${JSON.stringify(rowPayload)}`);
            await got.post(url, {
                headers,
                body: JSON.stringify({ position: 0, cellValues: rowPayload }), // Manually stringify body to match curl
            });
            log.info(`Successfully saved job: ${job.title}`);
        } catch (error) {
            log.exception(`Failed to save job "${job.title}" to Datagol:`, error);
        }
    }
}
