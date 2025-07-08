import fs from 'fs/promises';
import path from 'path';
import { log } from 'apify';
import { fileURLToPath } from 'url';
import fetchers from '../fetchers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTest() {
    log.info('Starting fetcher test...');

    try {
        // Load input schema to get default values
        const schemaPath = path.join(__dirname, '..', '..', '.actor', 'input_schema.json');
        const schemaContent = await fs.readFile(schemaPath, 'utf-8');
        const schema = JSON.parse(schemaContent);

        // Build config from schema defaults
        const config = {
            datagolApi: {
                baseUrl: schema.properties.datagolApiBaseUrl.default,
                workspaceId: schema.properties.datagolApiWorkspaceId.default,
                readToken: schema.properties.DATAGOL_READ_TOKEN.default,
                tables: {
                    jobTitles: schema.properties.jobTitlesTableId.default,
                    excludedCompanies: schema.properties.excludedCompaniesTableId.default,
                    locations: schema.properties.locationsTableId.default,
                },
            },
        };

        log.info('Testing with config:', config);

        // Test fetching functions
        log.info('--- Testing fetchJobTitles ---');
        const jobTitles = await fetchers.fetchJobTitles(config);
        log.info(`Fetched ${jobTitles.length} job titles.`);

        log.info('--- Testing fetchExcludedCompanies ---');
        const excludedCompanies = await fetchers.fetchExcludedCompanies(config);
        log.info(`Fetched ${excludedCompanies.length} excluded companies.`);

        log.info('--- Testing fetchLocations ---');
        const locations = await fetchers.fetchLocations(config);
        log.info(`Fetched ${locations.length} locations.`);

        log.info('Test finished.');

    } catch (error) {
        log.error('Test failed:', error);
    }
}

runTest();
