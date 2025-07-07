import { Actor } from 'apify';
import got from 'got';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { buildReportRow } from './reportBase.js';
import { fetchAllData } from './fetchers.js';

// Get the directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to log messages
const log = (message) => console.log(`[main] ${message}`);

// Function to create a unique key for a job
const getJobKey = (job) => `${job.title?.trim()}-${job.companyName?.trim()}-${job.location?.trim()}`;

export default Actor.main(async () => {
    const input = await Actor.getInput() ?? {};

    const url = input.datagolUrl ?? process.env.DATAGOL_URL;
    const token = input.datagolToken ?? process.env.DATAGOL_TOKEN;

    // Fetch dynamic data with fallbacks to static defaults
    console.log('🔄 Fetching dynamic configuration data...');
    const { 
        jobTitles: fetchedTitles, 
        excludedCompanies: fetchedCompetitors, 
        locations: fetchedLocations 
    } = await fetchAllData();

    // Use fetched data if available, otherwise fall back to input values
    const titles = Array.isArray(fetchedTitles) && fetchedTitles.length ? fetchedTitles : 
                 (Array.isArray(input.jobTitles) && input.jobTitles.length ? input.jobTitles : []);
    const locations = Array.isArray(fetchedLocations) && fetchedLocations.length ? fetchedLocations : 
                    (Array.isArray(input.locations) && input.locations.length ? input.locations : []);
    const excludedCompanies = Array.isArray(fetchedCompetitors) && fetchedCompetitors.length ? fetchedCompetitors : [];
    
    if (!titles.length) {
        console.warn('⚠️  No job titles found from either API or input. Using empty array.');
    }
    if (!locations.length) {
        console.warn('⚠️  No locations found from either API or input. Using empty array.');
    }
    if (!excludedCompanies.length) {
        console.warn('⚠️  No excluded companies found from API. Using empty array.');
    }

    const totalJobsToFetch = Number.isFinite(input.totalJobsToFetch) ? input.totalJobsToFetch : 1000;

    const scraperTimeoutEnv = parseInt(input.scraperTimeoutSecs ?? process.env.SCRAPER_TIMEOUT_SECS ?? '600', 10);
    const SCRAPER_TIMEOUT = Number.isFinite(scraperTimeoutEnv) ? Math.min(scraperTimeoutEnv, 3600) : 600;

    const MAX_CONCURRENCY = 24;

    const runInputs = [];
    const combinations = titles.length * locations.length;
    if (combinations > 0) {
        const jobsPerCombination = Math.ceil(totalJobsToFetch / combinations);
        for (const title of titles) {
            for (const location of locations) {
                runInputs.push({ 
                    title, 
                    location, 
                    rows: jobsPerCombination, 
                    publishedAt: "r86400" // Filter for jobs from last 24 hours
                });
            }
        }
    }

    const batches = [];
    for (let i = 0; i < runInputs.length; i += MAX_CONCURRENCY) {
        batches.push(runInputs.slice(i, i + MAX_CONCURRENCY));
    }

    const expectedBridgeSecs = batches.length * SCRAPER_TIMEOUT + 120;
    
    // Log the expected execution time and check against current timeout
    console.log(`⏱️  Expected execution time: ${expectedBridgeSecs} seconds`);
    
    if (process.env.APIFY_TIMEOUT_AT) {
        const remainingSecs = Math.floor((new Date(process.env.APIFY_TIMEOUT_AT).getTime() - Date.now()) / 1000);
        if (remainingSecs < expectedBridgeSecs) {
            console.log(`WARNING: Current run timeout is ${remainingSecs}s but at least ${expectedBridgeSecs}s is recommended.`);
            console.log(`⚠️  Please increase the actor timeout in your Apify task settings to at least ${expectedBridgeSecs} seconds`);
        } else {
            console.log(`✅ Sufficient time allocated: ${remainingSecs}s available, ${expectedBridgeSecs}s required`);
        }
    }

    const processedJobs = new Set();

    const runScraper = async (scraperInput) => {
        console.log(`Running LinkedIn jobs scraper with input: ${JSON.stringify(scraperInput)}`);

        const { defaultDatasetId } = await Actor.call('bebity/linkedin-jobs-scraper', scraperInput, {
            memory: 256,
            timeout: SCRAPER_TIMEOUT,
        });

        const { items } = await Actor.openDataset(defaultDatasetId).then(ds => ds.getData());

        if (items.length === 0) {
            console.log('Nothing to forward — dataset empty.');
            return;
        }

        // Filter by excluded companies and elimination words
        const filteredByCompanyAndKeywords = items.filter(job => {
            const companyName = (job.companyName ?? '').trim();
            const jobText = `${job.title} ${job.description}`.toLowerCase();
            
            // Check if company is in excludedCompanies
            const isCompanyExcluded = excludedCompanies.includes(companyName);

            // Check if any word from excludedCompanies (used as elimination words) exists in job text
            const isKeywordExcluded = excludedCompanies.some(word => jobText.includes(word.toLowerCase()));

            return !isCompanyExcluded && !isKeywordExcluded;
        });

        // Then filter by location if locations are specified
        const filteredByLocation = locations.length > 0 
            ? filteredByCompanyAndKeywords.filter(job => {
                const jobLocation = (job.location || '').toLowerCase();
                return locations.some(loc => 
                    jobLocation.includes(loc.toLowerCase())
                );
            })
            : filteredByCompanyAndKeywords;

        // Filter out duplicates
        const uniqueItems = filteredByLocation.filter(job => {
            const key = getJobKey(job);
            if (processedJobs.has(key)) {
                return false;
            }
            processedJobs.add(key);
            return true;
        });

        if (uniqueItems.length === 0) {
            console.log('Nothing to forward — no new jobs match the criteria.');
            return;
        }

        const rowsArr = uniqueItems.map(buildReportRow);

        console.log(`\n--- About to POST ${rowsArr.length} row(s) to DataGOL at:\n   ${url}\n--- Using token prefix: ${token?.slice(0, 6)}\n`);

        for (const [i, row] of rowsArr.entries()) {
            console.log(`→ [${i + 1}/${rowsArr.length}]`, JSON.stringify(row).slice(0, 200) + '…');
            try {
                const resp = await got.post(url, {
                    headers: {
                        'x-auth-token': token,
                        'Accept': '*/*',
                        'Content-Type': 'application/json',
                    },
                    json: row,
                    throwHttpErrors: false,
                });
                console.log(`  ✔ status=${resp.statusCode}`, resp.body);
            } catch (err) {
                console.error(`  ✖ Exception:`, err.message);
            }
        }

        console.log(`\n✅ Finished processing ${rowsArr.length} row(s) for input ${JSON.stringify(scraperInput)}\n`);
    };

    for (const batch of batches) {
        await Promise.all(batch.map(runScraper));
    }
});