import { Actor } from 'apify';
import got from 'got';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { buildReportRow } from './reportBase.js';
import { 
    fetchJobTitles, 
    fetchCompetitorList, 
    fetchLocations 
} from './fetchers.js';

// Get the directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to log messages
const log = (message) => console.log(`[main] ${message}`);

export default Actor.main(async () => {
    const input = await Actor.getInput() ?? {};

    const url = input.datagolUrl ?? process.env.DATAGOL_URL;
    const token = input.datagolToken ?? process.env.DATAGOL_TOKEN;

    // Fetch dynamic data with fallbacks to static defaults
    console.log('🔄 Fetching dynamic configuration data...');
    const [fetchedTitles, fetchedCompetitors, fetchedLocations] = await Promise.all([
        fetchJobTitles(),
        fetchCompetitorList(),
        fetchLocations()
    ]);

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

    const rows = Number.isFinite(input.rows) ? input.rows : DEFAULT_ROWS;

    const scraperTimeoutEnv = parseInt(input.scraperTimeoutSecs ?? process.env.SCRAPER_TIMEOUT_SECS ?? '600', 10);
    const SCRAPER_TIMEOUT = Number.isFinite(scraperTimeoutEnv) ? Math.min(scraperTimeoutEnv, 3600) : 600;

    const MAX_CONCURRENCY = 24;

    const runInputs = [];
    for (const title of titles) {
        for (const location of locations) {
            runInputs.push({ 
                title, 
                location, 
                rows, 
                publishedAt: "r86400" // Filter for jobs from last 24 hours
            });
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

        // First filter by excluded companies
        const filteredByCompany = items.filter(job => !excludedCompanies.includes((job.companyName ?? '').trim()));
        if (filteredByCompany.length === 0) {
            console.log('Nothing to forward — all jobs excluded by company name.');
            return;
        }

        // Then filter by location if locations are specified
        const filteredItems = locations.length > 0 
            ? filteredByCompany.filter(job => {
                const jobLocation = (job.location || '').toLowerCase();
                return locations.some(loc => 
                    jobLocation.includes(loc.toLowerCase())
                );
            })
            : filteredByCompany;

        if (filteredItems.length === 0) {
            console.log('Nothing to forward — no jobs match the specified locations.');
            return;
        }

        const rowsArr = filteredItems.map(buildReportRow);

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
