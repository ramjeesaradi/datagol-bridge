import { log } from 'apify';

/**
 * Merges default configuration with user input and environment variables.
 * @param {object} input - The actor input object.
 * @returns {object} The merged configuration object.
 */
export function getMergedConfig(input) {
    const config = {
        datagolApi: {
            baseUrl: input.datagolApiBaseUrl || 'https://be-eu.datagol.ai/noCo/api/v2',
            workspaceId: process.env.DATAGOL_WORKSPACE_ID,
            writeToken: process.env.DATAGOL_WRITE_TOKEN,
            tables: {
                jobTitles: input.jobTitlesTableId || '395a586f-2d3e-4489-a5d9-be0039f97aa1',
                excludedCompanies: input.excludedCompaniesTableId || 'ac27bdbc-b564-429e-815d-356d58b00d06',
                locations: input.locationsTableId || '6122189a-764f-40a9-9721-d756b7dd3626',
                jobPostings: input.jobPostingsTableId || '8e71ed6d-ae6a-495c-b93b-1a9429370b56',
            },
        },
        scraper: {
            id: 'bebity/linkedin-jobs-scraper',
            totalJobsToFetch: input.totalJobsToFetch || 50,
            timeoutSecs: input.scraperTimeoutSecs || 600,
            maxConcurrent: input.maxConcurrentScrapers || 24,
            apifyToken: process.env.APIFY_TOKEN,
            memory: input.scraperMemory || 256,
        },
    };

    // Log the configuration for debugging purposes, hiding sensitive tokens.
    log.info('Configuration loaded:');
    log.info(`  DataGOL Base URL: ${config.datagolApi.baseUrl}`);
    log.info(`  DataGOL Workspace ID: ${config.datagolApi.workspaceId ? 'Provided' : 'Missing'}`);
    log.info(`  Scraper: ${config.scraper.id}`);
    log.info(`  Default jobs to fetch: ${config.scraper.totalJobsToFetch}`);

    return config;
}

