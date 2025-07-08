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
const log = (message) => console.log(`[main] ${message}`);

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

export default Actor.main(async () => {
    // Get and merge input with defaults
    const input = await Actor.getInput() ?? {};
    const config = getMergedConfig(input);
    
    // Log configuration (without sensitive data)
    const safeConfig = JSON.parse(JSON.stringify(config));
    if (safeConfig.datagolApi?.readToken) {
        safeConfig.datagolApi.readToken = '***';
    }
    if (safeConfig.datagolApi?.writeToken) {
        safeConfig.datagolApi.writeToken = '***';
    }
    log(`Using configuration: ${JSON.stringify(safeConfig, null, 2)}`);
    
    try {
        // Fetch filter values in parallel
        log('🔄 Fetching filter values...');
        const [jobTitles, locations, excludedCompanies] = await Promise.all([
            getFilterValues(config, 'jobTitles'),
            getFilterValues(config, 'locations'),
            getFilterValues(config, 'excludedCompanies')
        ]);
        
        // Update config with fetched values
        config.filters.jobTitles = jobTitles;
        config.filters.locations = locations;
        config.filters.excludedCompanies = excludedCompanies;
        
        // Log fetched values
        log(`✅ Fetched ${jobTitles.length} job titles, ${locations.length} locations, and ${excludedCompanies.length} excluded companies`);
        
        if (!jobTitles.length) {
            log(`⚠️  No job titles found. Check your configuration or API connection.`);
        }
        if (!locations.length) {
            log(`⚠️  No locations found. Check your configuration or API connection.`);
        }
    } catch (error) {
        log(`❌ Error fetching filter values: ${error.message}`);
        throw error;
    }

    // Generate search combinations
    const searchCombinations = [];
    for (const title of config.filters.jobTitles) {
        for (const location of config.filters.locations) {
            searchCombinations.push({ title, location });
        }
    }

    if (searchCombinations.length === 0) {
        throw new Error('No valid search combinations. Please provide at least one job title and one location.');
    }

    log(`🔍 Found ${searchCombinations.length} search combinations`);

    // Process jobs in batches to respect rate limits
    const batchSize = Math.min(config.scraper.maxConcurrent || 3, searchCombinations.length);
    const batches = [];
    for (let i = 0; i < searchCombinations.length; i += batchSize) {
        batches.push(searchCombinations.slice(i, i + batchSize));
    }

    log(`⚡ Processing in ${batches.length} batches of ${batchSize} concurrent searches`);

    const allJobs = [];
    const seenJobs = new Set();
    let jobsFetched = 0;
    const jobsLimit = config.scraper.totalJobsToFetch;

    // Process each batch
    for (const batch of batches) {
        if (jobsFetched >= jobsLimit) {
            log(`Reached job limit of ${jobsLimit}. Stopping further processing.`);
            break;
        }

        log(`🚀 Processing batch of ${batch.length} searches...`);
        
        const batchPromises = batch.map(async ({ title, location }) => {
            if (jobsFetched >= jobsLimit) return [];
            
            try {
                const jobs = await runScraper({
                    title,
                    location,
                    postedInLastHours: config.filters.postedInLastHours,
                    limit: Math.ceil((jobsLimit - jobsFetched) / batch.length)
                });
                
                // Process and deduplicate jobs
                const processedJobs = processJobPostings(config, jobs);
                const newJobs = [];
                
                for (const job of processedJobs) {
                    const jobKey = getJobKey(job);
                    if (!seenJobs.has(jobKey)) {
                        seenJobs.add(jobKey);
                        newJobs.push(job);
                        jobsFetched++;
                        
                        if (jobsFetched >= jobsLimit) {
                            break;
                        }
                    }
                }
                
                log(`✅ Found ${newJobs.length} new jobs for "${title}" in "${location}"`);
                return newJobs;
            } catch (error) {
                log.error(`❌ Error processing "${title}" in "${location}": ${error.message}`);
                return [];
            }
        });

        // Wait for all searches in the batch to complete
        const batchResults = await Promise.all(batchPromises);
        const batchJobs = batchResults.flat();
        allJobs.push(...batchJobs);
        
        log(`📊 Progress: ${allJobs.length} unique jobs found so far`);
        
        // Add a small delay between batches to avoid rate limiting
        if (batches.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    log(`🎉 Finished! Found ${allJobs.length} unique jobs in total`);
    
    // Save results to dataset
    if (allJobs.length > 0) {
        await Actor.pushData(allJobs);
        
        // Save to Datagol if configured
        if (config.datagolApi?.tables?.jobPostings) {
            try {
                await saveToDatagol(config, allJobs);
                log('✅ Successfully saved jobs to Datagol');
            } catch (error) {
                log.error(`❌ Failed to save jobs to Datagol: ${error.message}`);
            }
        }
    } else {
        log.warning('No jobs found matching the criteria');
    }
} catch (error) {
    log.error(`❌ Fatal error: ${error.message}`);
    throw error;
}

/**
 * Saves jobs to Datagol API
 * @param {Object} config - Configuration object
 * @param {Array} jobs - Array of job objects to save
 * @returns {Promise<void>}
 */
async function saveToDatagol(config, jobs) {
    const { datagolApi } = config;
    const tableId = datagolApi.tables.jobPostings;
    
    // Use workspace ID from environment variable if available, otherwise from config
    const workspaceId = process.env.DATAGOL_WORKSPACE_ID || datagolApi.workspaceId;
    
    const url = `${datagolApi.baseUrl}/workspaces/${workspaceId}/tables/${tableId}/rows`;
    
    // Use write token from environment variable
    const writeToken = process.env.DATAGOL_WRITE_TOKEN;
    
    const headers = {
        'x-auth-token': writeToken,
        'Content-Type': 'application/json'
    };
    
    log(`Using x-auth-token for writing job postings to DataGOL`);
    
    // Transform jobs to match Datagol's expected format
    const payload = jobs.map(job => ({
        // Map job fields to Datagol table columns
        // Adjust these mappings based on your Datagol table schema
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        url: job.jobUrl,
        postedDate: job.postedDate ? new Date(job.postedDate).toISOString() : new Date().toISOString(),
        // Add any additional fields from the job object
        ...job
    }));
    
    try {
        log(`📤 Saving ${jobs.length} jobs to Datagol...`);
        
        // Send data in chunks to avoid hitting request size limits
        const CHUNK_SIZE = 100;
        for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
            const chunk = payload.slice(i, i + CHUNK_SIZE);
            
            const response = await got.post(url, {
                headers,
                json: chunk,
                responseType: 'json',
                timeout: { request: 30000 },
                throwHttpErrors: false
            });
            
            if (response.statusCode >= 400) {
                throw new Error(`API returned status ${response.statusCode}: ${response.body}`);
            }
            
            log(`  ✅ Saved chunk ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(payload.length / CHUNK_SIZE)}`);
            
            // Add a small delay between chunks to avoid rate limiting
            if (i + CHUNK_SIZE < payload.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        log(`✅ Successfully saved ${payload.length} jobs to Datagol`);
    } catch (error) {
        log.error(`❌ Failed to save jobs to Datagol: ${error.message}`);
        throw error;
    }

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

    const expectedBridgeSecs = runInputs.length * SCRAPER_TIMEOUT + 120;
    
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
            const isCompanyExcluded = config.filters.excludedCompanies.some(company => 
                companyName.toLowerCase().includes(company.toLowerCase()));

            // Check if any word from excludedCompanies (used as elimination words) exists in job text
            const isKeywordExcluded = config.filters.excludedCompanies.some(word => 
                jobText.includes(word.toLowerCase()));

            return !isCompanyExcluded && !isKeywordExcluded;
        });

        // Then filter by location if locations are specified
        const filteredByLocation = config.filters.locations.length > 0 
            ? filteredByCompanyAndKeywords.filter(job => {
                const jobLocation = (job.location || '').toLowerCase();
                return config.filters.locations.some(loc => 
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
        
        // Get the DataGOL API configuration from the config
        const { datagolApi } = config;
        const { baseUrl, workspaceId, writeToken, tables } = datagolApi;
        const { jobPostings: jobPostingsTableId } = tables;
        const url = `${baseUrl}/workspaces/${workspaceId}/tables/${jobPostingsTableId}/data/external`;
        const token = writeToken;
        
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