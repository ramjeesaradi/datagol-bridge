import { Actor, log } from 'apify';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { getFilterValues } from './fetchers.js';
import { processJobs, saveResults } from './services.js';

// Load environment variables
dotenv.config();

// Get the directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);





// Default configuration that can be overridden by input
function getMergedConfig(input) {
    const config = {
        datagolApi: {
            baseUrl: process.env.DATAGOL_API_BASE_URL || 'https://be-eu.datagol.ai/noCo/api/v2',
            workspaceId: process.env.DATAGOL_WORKSPACE_ID,
            readToken: process.env.DATAGOL_READ_TOKEN,
            writeToken: process.env.DATAGOL_WRITE_TOKEN,
            tables: {
                jobTitles: process.env.DATAGOL_JOB_TITLES_TABLE_ID || '395a586f-2d3e-4489-a5d9-be0039f97aa1',
                excludedCompanies: process.env.DATAGOL_EXCLUDED_COMPANIES_TABLE_ID || 'ac27bdbc-b564-429e-815d-356d58b00d06',
                locations: process.env.DATAGOL_LOCATIONS_TABLE_ID || '6122189a-764f-40a9-9721-d756b7dd3626',
                jobPostings: process.env.DATAGOL_JOB_POSTINGS_TABLE_ID || 'f16a8e15-fa74-4705-8ef5-7345347f6347',
            },
        },
        scraper: {
            totalJobsToFetch: input.totalJobsToFetch || 50,
            timeoutSecs: input.scraperTimeoutSecs || 600,
            maxConcurrent: input.maxConcurrentScrapers || 30,
            apifyToken: input.apifyToken || process.env.APIFY_TOKEN,
            },
        };

    // Log the DataGOL API configuration being used
    log.info('DataGOL API Configuration:');
    log.info(`  Base URL: ${config.datagolApi.baseUrl}`);
    log.info(`  Workspace ID: ${config.datagolApi.workspaceId}`);
    log.info(`  Read Token: ${config.datagolApi.readToken ? '***' : 'Not set'}`);
    log.info(`  Write Token: ${config.datagolApi.writeToken ? '***' : 'Not set'}`);
    log.info('  Table IDs:');
    log.info(`    Job Titles: ${config.datagolApi.tables.jobTitles}`);
    log.info(`    Excluded Companies: ${config.datagolApi.tables.excludedCompanies}`);
    log.info(`    Locations: ${config.datagolApi.tables.locations}`);
    log.info(`    Job Postings: ${config.datagolApi.tables.jobPostings}`);

    return config;
}



Actor.main(async () => {
    try {
        const input = await Actor.getInput() ?? {};
        const config = getMergedConfig(input);
        
        const safeConfig = JSON.parse(JSON.stringify(config));
        if (safeConfig.datagolApi?.readToken) safeConfig.datagolApi.readToken = '***';
        if (safeConfig.datagolApi?.writeToken) safeConfig.datagolApi.writeToken = '***';
        log.info('Using configuration:', safeConfig);

        log.info('🔄 Fetching filter values...');
        config.filters = {}; // Initialize filters object
        const [jobTitles, locations, excludedCompanies] = await Promise.all([
            getFilterValues(config, 'jobTitles'),
            getFilterValues(config, 'locations'),
            getFilterValues(config, 'excludedCompanies')
        ]);
        
        config.filters.jobTitles = jobTitles;
        config.filters.locations = locations;
        config.filters.excludedCompanies = excludedCompanies;
        
        log.info(`✅ Fetched ${jobTitles.length} job titles, ${locations.length} locations, and ${excludedCompanies.length} excluded companies`);
        
        if (!jobTitles.length || !locations.length) {
            log.warning(`⚠️ No job titles or locations found. Actor will exit.`);
            return;
        }

        const jobs = await processJobs(config);
        await saveResults(config, jobs);

    } catch (error) {
        log.exception('❌ Fatal error in main execution block', error);
        await Actor.fail('Actor failed with a fatal error.');
    }
});