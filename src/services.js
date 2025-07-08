import { Actor, log } from 'apify';
import { ApifyClient } from 'apify-client';
import { processJobPostings, saveToDatagol } from './fetchers.js';

// Function to create a unique key for a job, moved from main.js
const getJobKey = (job) => {
    const jobUrl = job.jobUrl || '';
    const description = (job.description || '').replace(/\s+/g, ' ').slice(0, 256);
    return `${jobUrl}-${description}`;
};

/**
 * Runs the LinkedIn scraper actor
 * @param {Object} scraperInput - Input for the scraper actor
 * @param {Object} config - The main configuration object
 * @returns {Promise<Array>}
 */
export async function runScraper(scraperInput, config) {
    const { scraper: scraperConfig } = config;
    const apifyClient = new ApifyClient({ token: scraperConfig.apifyToken });

    const actorInput = {
        title: scraperInput.title,
        location: scraperInput.location,
        rows: scraperInput.limit || 50, // 'rows' is the correct parameter for the number of jobs
        publishedAt: 'r86400', // 'r86400' corresponds to the last 24 hours
    };

    // Check for a recent successful run with the same input
    log.info(`🔎 Searching for a recent successful run for: ${JSON.stringify({ title: actorInput.title, location: actorInput.location })}`);
    const runs = await apifyClient.actor('bebity/linkedin-jobs-scraper').runs().list({ desc: true, limit: 100 });
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentRun = runs.items.find(run => 
        run.status === 'SUCCEEDED' &&
        new Date(run.finishedAt) > twentyFourHoursAgo &&
        run.input && // Ensure input exists before accessing properties
        run.input.title === actorInput.title &&
        run.input.location === actorInput.location
    );

    if (recentRun) {
        log.info(`♻️ Found recent successful run from ${recentRun.finishedAt}. Reusing dataset ${recentRun.defaultDatasetId}.`);
        const dataset = await Actor.openDataset(recentRun.defaultDatasetId);
        const { items } = await dataset.getData();
        return items;
    }

    log.info(`🚀 No recent run found. Starting a new scraper run with input: ${JSON.stringify(actorInput)}`);


    const run = await Actor.call('bebity/linkedin-jobs-scraper', actorInput, {
        token: scraperConfig.apifyToken,
        memory: scraperConfig.memory,
    });

    if (run.status !== 'SUCCEEDED') {
        log.error(`❌ Scraper run failed with status: ${run.status}`);
        return [];
    }

    log.info(`✅ New scraper run finished. Status: ${run.status}`);
    const { defaultDatasetId } = run;
    const dataset = await Actor.openDataset(defaultDatasetId);
    const { items } = await dataset.getData();
    return items;
}

export async function processJobs(config) {
    const searchCombinations = [];
    const jobTitles = Array.isArray(config.filters?.jobTitles) ? config.filters.jobTitles : [];
    const locations = Array.isArray(config.filters?.locations) ? config.filters.locations : [];

    for (const titleObj of jobTitles) {
        for (const locationObj of locations) {
            if (titleObj.title && locationObj.location) {
                searchCombinations.push({ title: titleObj.title, location: locationObj.location });
            }
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
    return allJobs;
}

export async function saveResults(config, jobs) {
    if (jobs.length > 0) {
        await Actor.pushData(jobs);
        
        if (config.datagolApi?.tables?.jobPostings) {
            await saveToDatagol(config, jobs);
        }
    } else {
        log.warning('No jobs found matching the criteria, nothing to save.');
    }
}
