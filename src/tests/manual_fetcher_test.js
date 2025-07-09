import 'dotenv/config';
import { log } from 'apify';
import { getFilterValues } from '../fetchers.js';

async function runTest() {
    log.info('Starting fetcher test...');

    try {
        // Build config from environment variables
        const config = {
            datagolApi: {
                baseUrl: 'https://be-eu.datagol.ai/noCo/api/v2',
                workspaceId: process.env.DATAGOL_WORKSPACE_ID,
                writeToken: process.env.DATAGOL_WRITE_TOKEN,
                tables: {
                    jobTitles: '395a586f-2d3e-4489-a5d9-be0039f97aa1',
                    excludedCompanies: 'ac27bdbc-b564-429e-815d-356d58b00d06',
                    locations: '6122189a-764f-40a9-9721-d756b7dd3626',
                },
            },
        };

        if (!config.datagolApi.workspaceId || !config.datagolApi.writeToken) {
            throw new Error('Missing DATAGOL_WORKSPACE_ID or DATAGOL_WRITE_TOKEN in .env file');
        }

        log.info('Testing with loaded config...');

        // Test fetching functions
        log.info('--- Testing fetchJobTitles ---');
        const jobTitles = await getFilterValues(config, 'jobTitles');
        log.info(`Fetched ${jobTitles.length} job titles.`);

        log.info('--- Testing fetchExcludedCompanies ---');
        const excludedCompanies = await getFilterValues(config, 'excludedCompanies');
        log.info(`Fetched ${excludedCompanies.length} excluded companies.`);

        log.info('--- Testing fetchLocations ---');
        const locations = await getFilterValues(config, 'locations');
        log.info(`Fetched ${locations.length} locations.`);

        log.info('Test finished successfully.');

    } catch (error) {
        log.error('Test failed:', { message: error.message, stack: error.stack });
    }
}

runTest();
