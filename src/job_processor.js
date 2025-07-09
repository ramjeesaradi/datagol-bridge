import { log } from 'apify';
import { ApifyClient } from 'apify-client';
import { runScraper, getRecentScraperRuns } from './apify_service.js';

/**
 * Creates a unique key for a job posting to handle duplicates.
 * @param {object} job - The job object.
 * @returns {string} A unique key for the job.
 */
const getJobKey = (job) => {
    if (job.jobUrl) {
        return job.jobUrl.split('?')[0];
    }
    // Fallback for jobs without a URL
    return `${job.title}-${job.companyName}-${job.location}`.toLowerCase();
};

/**
 * Processes all job searches, handling batching, scraping, and deduplication.
 * @param {object} config - The main configuration object.
 * @param {object} filters - An object containing jobTitles, locations, and excludedCompanies.
 * @returns {Promise<Array>} A promise that resolves to an array of unique, filtered job postings.
 */
export async function processAllJobs(config, filters) {
    const { jobTitles, locations, excludedCompanies } = filters;
    const searchCombinations = [];

    for (const titleObj of jobTitles) {
        for (const locationObj of locations) {
            searchCombinations.push({ title: titleObj.title, location: locationObj.location });
        }
    }

    log.info(`Created ${searchCombinations.length} search combinations.`);

    const allJobs = await runBatches(searchCombinations, config);

    log.info(`Filtering ${allJobs.length} jobs against ${excludedCompanies.length} excluded companies.`);
    const excludedCompaniesSet = new Set(excludedCompanies.map(c => c.toLowerCase()));
    const filteredJobs = allJobs.filter(job => !excludedCompaniesSet.has(job.companyName?.toLowerCase()));

    log.info(`Finished processing. Found ${filteredJobs.length} unique and filtered jobs.`);
    return filteredJobs;
}

/**
 * Runs scraper tasks in batches to manage concurrency.
 * @param {Array} searchCombinations - All title/location pairs to search.
 * @param {object} config - The main configuration object.
 * @returns {Promise<Array>} A promise that resolves to an array of all unique jobs found.
 */
async function runBatches(searchCombinations, config) {
    const apifyClient = new ApifyClient({ token: config.scraper.apifyToken });
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Fetch the most recent successful run once for the entire batch processing
    const overallRecentRun = await getRecentScraperRuns(apifyClient, config.scraper.id, twentyFourHoursAgo, null); // Pass null for currentInput as it's not needed for the overall check

    const allJobs = [];
    const seenJobs = new Set();
    const jobsLimit = config.scraper.totalJobsToFetch;
    const batchSize = config.scraper.maxConcurrent;

    for (let i = 0; i < searchCombinations.length; i += batchSize) {
        if (allJobs.length >= jobsLimit) {
            log.info(`Job limit of ${jobsLimit} reached. Halting further scraping.`);
            break;
        }

        const batch = searchCombinations.slice(i, i + batchSize);
        log.info(`Processing a batch of ${batch.length} scraper tasks...`);

        const batchPromises = batch.map(async (search) => {
            if (seenJobs.size >= jobsLimit) return [];
            const jobs = await runScraper(search, config, overallRecentRun);
            const newJobs = [];

            for (const job of jobs) {
                const jobKey = getJobKey(job);
                if (!seenJobs.has(jobKey)) {
                    seenJobs.add(jobKey);
                    newJobs.push(job);
                    if (seenJobs.size >= jobsLimit) break;
                }
            }
            return newJobs;
        });

        const batchResults = await Promise.all(batchPromises);
        allJobs.push(...batchResults.flat());
        log.info(`Batch finished. Total unique jobs so far: ${allJobs.length}`);
    }

    return allJobs;
}

