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
            baseUrl: input.datagolApiBaseUrl || 'https://be-eu.datagol.ai/noCo/api/v2',
            workspaceId: input.datagolApiWorkspaceId || process.env.DATAGOL_WORKSPACE_ID,
            readToken: input.datagolReadToken || process.env.DATAGOL_READ_TOKEN,
            writeToken: input.datagolWriteToken || process.env.DATAGOL_WRITE_TOKEN,
            tables: {
                jobTitles: input.jobTitlesTableId || '395a586f-2d3e-4489-a5d9-be0039f97aa1',
                competitors: input.competitorsTableId || 'ac27bdbc-b564-429e-815d-356d58b00d06',
                locations: input.locationsTableId || '6122189a-764f-40a9-9721-d756b7dd3626',
                jobPostings: input.jobPostingsTableId || 'f16a8e15-fa74-4705-8ef5-7345347f6347',
            },
        },
        scraper: {
            totalJobsToFetch: input.totalJobsToFetch || 50,
            timeoutSecs: input.scraperTimeoutSecs || 600,
            maxConcurrent: input.maxConcurrentScrapers || 3,
        },
        filters: {
            jobTitles: input.jobTitles && input.jobTitles.length > 0 ? input.jobTitles : [],
            locations: input.locations && input.locations.length > 0 ? input.locations : [],
            excludedCompanies: input.excludedCompanies && input.excludedCompanies.length > 0 ? input.excludedCompanies : [],
            postedInLastHours: input.postedInLastHours || 24,
        },
        deduplication: {
            enabled: input.enableDeduplication !== undefined ? input.enableDeduplication : true,
            fields: input.deduplicationFields || ['title', 'company', 'location'],
        },
        actorTimeout: input.timeout || 3600,
    };

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