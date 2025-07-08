import { Actor } from 'apify';
import got from 'got';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { buildReportRow } from './reportBase.js';
import { getFilterValues, processJobPostings } from './fetchers.js';

// Load environment variables
dotenv.config();

// Get the directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to log messages
const log = Actor.log;

// Function to create a unique key for a job
const getJobKey = (job) => {
    const jobUrl = job.jobUrl || '';
    const description = (job.description || '').replace(/\s+/g, ' ').slice(0, 256);
    return `${jobUrl}-${description}`;
};

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

/**
 * Saves jobs to Datagol API
 * @param {Object} config - Configuration object
 * @param {Array} jobs - Array of job objects to save
 * @returns {Promise<void>}
 */
async function saveToDatagol(config, jobs) {
    const { datagolApi } = config;
    const { baseUrl, workspaceId, writeToken, tables } = datagolApi;
    const tableId = tables.jobPostings;

    if (!workspaceId || !writeToken) {
        log.warning('❌ Missing workspaceId or writeToken for saving to Datagol. Skipping.');
        return;
    }

    const url = `${baseUrl}/workspaces/${workspaceId}/tables/${tableId}/rows`;
    
    const headers = {
        'x-auth-token': writeToken,
        'Content-Type': 'application/json'
    };

    log.info(`Saving ${jobs.length} jobs to Datagol...`);

    for (const job of jobs) {
        const row = buildReportRow(job);
        try {
            const response = await got.post(url, {
                headers,
                json: row,
                responseType: 'json',
                throwHttpErrors: false
            });

            if (response.statusCode >= 400) {
                log.error(`❌ Failed to save job to Datagol. Status: ${response.statusCode}, Body: ${JSON.stringify(response.body)}`);
            } else {
                log.info(`✅ Successfully saved job: ${job.title}`);
            }
        } catch (error) {
            log.exception(`❌ Exception while saving job to Datagol:`, error);
        }
    }
}

/**
 * Runs the LinkedIn scraper actor
 * @param {Object} scraperInput - Input for the scraper actor
 * @param {Object} config - The main configuration object
 * @returns {Promise<Array>}
 */
async function runScraper(scraperInput, config) {
    const { title, location, limit } = scraperInput;
    log.info(`🏃‍♂️ Running scraper for: "${title}" in "${location}" (limit: ${limit})`);

    const actorInput = {
        jobTitles: [title],
        locations: [location],
        maxJobs: limit,
        runInParallel: false, // To avoid nested parallelism issues
        maxConcurrency: 1,
        saveOnlyUniqueJobs: true,
    };

    const remainingTime = await Actor.getRemainingTimeInMillis();
    const requiredTime = (config.scraper.timeoutSecs || 600) * 1000;

    if (remainingTime < requiredTime) {
        log.warning(`⚠️ Insufficient time to run scraper (${remainingTime}ms remaining). Skipping.`);
        return [];
    }

    try {
        const { defaultDatasetId } = await Actor.call('bebity/linkedin-jobs-scraper', actorInput, {
            memory: 256,
            timeout: config.scraper.timeoutSecs || 600,
        });

        const { items } = await Actor.openDataset(defaultDatasetId).then(ds => ds.getData());
        log.info(`Scraper found ${items.length} jobs.`);
        return items;
    } catch (error) {
        log.exception(`❌ Scraper actor failed for "${title}" in "${location}"`, error);
        return [];
    }
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

        const searchCombinations = [];
        for (const title of config.filters.jobTitles) {
            for (const location of config.filters.locations) {
                searchCombinations.push({ title, location });
            }
        }

        log.info(`🔍 Found ${searchCombinations.length} search combinations`);

        const batchSize = Math.min(config.scraper.maxConcurrent || 3, searchCombinations.length);
        const batches = [];
        for (let i = 0; i < searchCombinations.length; i += batchSize) {
            batches.push(searchCombinations.slice(i, i + batchSize));
        }

        log.info(`⚡ Processing in ${batches.length} batches of ${batchSize} concurrent searches`);

        const allJobs = [];
        const seenJobs = new Set();
        let jobsFetched = 0;
        const jobsLimit = config.scraper.totalJobsToFetch;

        for (const batch of batches) {
            if (jobsFetched >= jobsLimit) {
                log.info(`Reached job limit of ${jobsLimit}. Stopping further processing.`);
                break;
            }

            log.info(`🚀 Processing batch of ${batch.length} searches...`);
            
            const batchPromises = batch.map(async ({ title, location }) => {
                if (jobsFetched >= jobsLimit) return [];
                
                const jobs = await runScraper({ title, location, limit: Math.ceil((jobsLimit - jobsFetched) / batch.length) }, config);
                const processedJobs = processJobPostings(config, jobs);
                const newJobs = [];
                
                for (const job of processedJobs) {
                    const jobKey = getJobKey(job);
                    if (!seenJobs.has(jobKey)) {
                        seenJobs.add(jobKey);
                        newJobs.push(job);
                        jobsFetched++;
                        if (jobsFetched >= jobsLimit) break;
                    }
                }
                
                log.info(`✅ Found ${newJobs.length} new jobs for "${title}" in "${location}"`);
                return newJobs;
            });

            const batchResults = await Promise.all(batchPromises);
            const batchJobs = batchResults.flat();
            allJobs.push(...batchJobs);
            
            log.info(`📊 Progress: ${allJobs.length} unique jobs found so far`);
            
            if (batches.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        log.info(`🎉 Finished! Found ${allJobs.length} unique jobs in total`);
        
        if (allJobs.length > 0) {
            await Actor.pushData(allJobs);
            
            if (config.datagolApi?.tables?.jobPostings) {
                await saveToDatagol(config, allJobs);
            }
        } else {
            log.warning('No jobs found matching the criteria');
        }

    } catch (error) {
        log.exception('❌ Fatal error in main execution block', error);
        await Actor.fail('Actor failed with a fatal error.');
    }
});