import { Actor, log } from 'apify';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getFilterValues } from './fetchers.js';
import { processJobs, saveResults } from './services.js';


// Get the directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);





// Default configuration that can be overridden by input
function getMergedConfig(input) {
    const config = {
        datagolApi: {
            baseUrl: input.datagolApiBaseUrl ,
            workspaceId: input.datagolApiWorkspaceId,
            readToken: input.DATAGOL_READ_TOKEN,
            writeToken: input.DATAGOL_WRITE_TOKEN,
            tables: {
                jobTitles: input.jobTitlesTableId,
                excludedCompanies: input.excludedCompaniesTableId,
                locations: input.locationsTableId,
                jobPostings: input.jobPostingsTableId,
            },
        },
        scraper: {
            totalJobsToFetch: input.totalJobsToFetch || 50,
            timeoutSecs: input.scraperTimeoutSecs || 600,
            maxConcurrent: input.maxConcurrentScrapers || 24,
            apifyToken: input.apifyToken || process.env.APIFY_TOKEN,
            memory: input.scraperMemory || 256,
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

        log.info(`💾 Saving ${jobs.length} jobs to Datagol and Actor dataset...`);
        await saveResults(config, jobs);

    } catch (error) {
        log.exception('❌ Fatal error in main execution block', error);
        await Actor.fail('Actor failed with a fatal error.');
    }
});