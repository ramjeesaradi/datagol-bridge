import { Actor } from 'apify';
import got from 'got';
import { EXCLUDED_COMPANIES as DEFAULT_EXCLUDED_COMPANIES } from './excludedCompanies.js';
import { JOB_TITLES as DEFAULT_JOB_TITLES, LOCATIONS as DEFAULT_LOCATIONS, ROWS as DEFAULT_ROWS } from './scraperInput.js';
import { buildReportRow } from './reportBase.js';

// Dynamic data fetching functions
const fetchJobTitles = async () => {
    try {
        console.log('Fetching job titles from external API...');
        const response = await got.post('https://be-eu.datagol.ai/noCo/api/v2/workspaces/8e894b95-cc40-44f0-88d7-4aae346b0325/tables/395a586f-2d3e-4489-a5d9-be0039f97aa1/data/external', {
            headers: {
                'Authorization': 'Bearer eyJhbGciOiJIUzUxMiJ9.eyJtZmFfc3RhdHVzIjoiTk9UX1JFUVVJUkVEIiwic3ViIjoiZGV2QGpoLnBhcnRuZXJzIiwicGVybWlzc2lvbnMiOlsiVklFV19EQVRBU09VUkNFIiwiVklFV19VU0VSUyIsIkNSRUFURV9DT1BJTE9UIiwiRURJVF9DT1BJTE9UIiwiREVMRVRFX0NPUElMT1QiLCJWSUVXX0NPUElMT1QiLCJFRElUX0xBS0VIT1VTRSIsIlZJRVdfQ09OTkVDVE9SUyIsIkNSRUFURV9QSVBFTElORSIsIkNSRUFURV9EQVRBU09VUkNFIiwiRURJVF9VU0VSUyIsIlZJRVdfQUxFUlRTIiwiRURJVF9QSVBFTElORSIsIkVESVRfQ09OTkVDVE9SUyIsIkRFTEVURV9DT05ORUNUT1JTIiwiVklFV19QSVBFTElORSIsIkVESVRfQ09NUEFOWSIsIkRFTEVURV9VU0VSUyIsIlZJRVdfSk9CUyIsIkNSRUFURV9DT05ORUNUT1JTIiwiQ1JFQVRFX1VTRVJTIiwiRURJVF9EQVRBU09VUkNFIiwiREVMRVRFX0RBVEFTT1VSQ0UiLCJWSUVXX0xBS0VIT1VTRSIsIkNSRUFURV9MQUtFSE9VU0UiLCJERUxFVEVfTEFLRUhPVVNFIiwiREVMRVRFX1BJUEVMSU5FIiwiQVNTSUdOX1JPTEVTIl0sInJvbGVzIjpbIlVTRVIiLCJMQUtFSE9VU0VfQURNSU4iLCJDT05ORUNUT1JfQURNSU4iLCJDT1BJTE9USFVCX0FETUlOIiwiQUNDT1VOVF9BRE1JTiJdLCJleHAiOjE3NTE2MjkzODUsImlhdCI6MTc1MTI2OTM4NX0.zu4gurcKytvz9FeMLZP4mhm3l-PUXIq2QQE0AF9kb8X5fLr0H_D8qFy1mzxHv4rBzL13J4VjQaUWeN8bj3jVYA',
                'Content-Type': 'application/json'
            },
            json: {"requestPageDetails":{"pageNumber":1,"pageSize":500}}
        });
        
        const data = JSON.parse(response.body);
        if (data && data.data && Array.isArray(data.data)) {
            const titles = data.data.map(item => item.title || item.name || item.jobTitle).filter(Boolean);
            if (titles.length > 0) {
                console.log(`✅ Fetched ${titles.length} job titles from external API`);
                return titles;
            }
        }
        throw new Error('No valid job titles found in response');
    } catch (error) {
        console.log(`❌ Failed to fetch job titles from external API: ${error.message}`);
        console.log('📋 Using default job titles');
        return DEFAULT_JOB_TITLES;
    }
};

const fetchCompetitorList = async () => {
    try {
        console.log('Fetching competitor list from external API...');
        const response = await got.post('https://be-eu.datagol.ai/noCo/api/v2/workspaces/8e894b95-cc40-44f0-88d7-4aae346b0325/tables/ac27bdbc-b564-429e-815d-356d58b00d06/data/external', {
            headers: {
                'Authorization': 'Bearer eyJhbGciOiJIUzUxMiJ9.eyJtZmFfc3RhdHVzIjoiTk9UX1JFUVVJUkVEIiwic3ViIjoiZGV2QGpoLnBhcnRuZXJzIiwicGVybWlzc2lvbnMiOlsiVklFV19EQVRBU09VUkNFIiwiVklFV19VU0VSUyIsIkNSRUFURV9DT1BJTE9UIiwiRURJVF9DT1BJTE9UIiwiREVMRVRFX0NPUElMT1QiLCJWSUVXX0NPUElMT1QiLCJFRElUX0xBS0VIT1VTRSIsIlZJRVdfQ09OTkVDVE9SUyIsIkNSRUFURV9QSVBFTElORSIsIkNSRUFURV9EQVRBU09VUkNFIiwiRURJVF9VU0VSUyIsIlZJRVdfQUxFUlRTIiwiRURJVF9QSVBFTElORSIsIkVESVRfQ09OTkVDVE9SUyIsIkRFTEVURV9DT05ORUNUT1JTIiwiVklFV19QSVBFTElORSIsIkVESVRfQ09NUEFOWSIsIkRFTEVURV9VU0VSUyIsIlZJRVdfSk9CUyIsIkNSRUFURV9DT05ORUNUT1JTIiwiQ1JFQVRFX1VTRVJTIiwiRURJVF9EQVRBU09VUkNFIiwiREVMRVRFX0RBVEFTT1VSQ0UiLCJWSUVXX0xBS0VIT1VTRSIsIkNSRUFURV9MQUtFSE9VU0UiLCJERUxFVEVfTEFLRUhPVVNFIiwiREVMRVRFX1BJUEVMSU5FIiwiQVNTSUdOX1JPTEVTIl0sInJvbGVzIjpbIlVTRVIiLCJMQUtFSE9VU0VfQURNSU4iLCJDT05ORUNUT1JfQURNSU4iLCJDT1BJTE9USFVCX0FETUlOIiwiQUNDT1VOVF9BRE1JTiJdLCJleHAiOjE3NTE2MjkzODUsImlhdCI6MTc1MTI2OTM4NX0.zu4gurcKytvz9FeMLZP4mhm3l-PUXIq2QQE0AF9kb8X5fLr0H_D8qFy1mzxHv4rBzL13J4VjQaUWeN8bj3jVYA',
                'Content-Type': 'application/json'
            },
            json: {"requestPageDetails":{"pageNumber":1,"pageSize":500}}
        });
        
        const data = JSON.parse(response.body);
        if (data && data.data && Array.isArray(data.data)) {
            const companies = data.data.map(item => item.company || item.companyName || item.name).filter(Boolean);
            if (companies.length > 0) {
                console.log(`✅ Fetched ${companies.length} companies from external API`);
                return companies;
            }
        }
        throw new Error('No valid companies found in response');
    } catch (error) {
        console.log(`❌ Failed to fetch competitor list from external API: ${error.message}`);
        console.log('📋 Using default excluded companies');
        return DEFAULT_EXCLUDED_COMPANIES;
    }
};

const fetchLocations = async () => {
    try {
        console.log('Fetching locations from external workbook...');
        // Note: The workbook URL needs to be converted to an API endpoint
        // For now using a placeholder - you may need to adjust this based on the actual API structure
        const response = await got.get('https://be-eu.datagol.ai/noCo/api/v2/workspaces/8e894b95-cc40-44f0-88d7-4aae346b0325/workbooks/6122189a-764f-40a9-9721-d756b7dd3626/data', {
            headers: {
                'Authorization': 'Bearer eyJhbGciOiJIUzUxMiJ9.eyJtZmFfc3RhdHVzIjoiTk9UX1JFUVVJUkVEIiwic3ViIjoiZGV2QGpoLnBhcnRuZXJzIiwicGVybWlzc2lvbnMiOlsiVklFV19EQVRBU09VUkNFIiwiVklFV19VU0VSUyIsIkNSRUFURV9DT1BJTE9UIiwiRURJVF9DT1BJTE9UIiwiREVMRVRFX0NPUElMT1QiLCJWSUVXX0NPUElMT1QiLCJFRElUX0xBS0VIT1VTRSIsIlZJRVdfQ09OTkVDVE9SUyIsIkNSRUFURV9QSVBFTElORSIsIkNSRUFURV9EQVRBU09VUkNFIiwiRURJVF9VU0VSUyIsIlZJRVdfQUxFUlRTIiwiRURJVF9QSVBFTElORSIsIkVESVRfQ09OTkVDVE9SUyIsIkRFTEVURV9DT05ORUNUT1JTIiwiVklFV19QSVBFTElORSIsIkVESVRfQ09NUEFOWSIsIkRFTEVURV9VU0VSUyIsIlZJRVdfSk9CUyIsIkNSRUFURV9DT05ORUNUT1JTIiwiQ1JFQVRFX1VTRVJTIiwiRURJVF9EQVRBU09VUkNFIiwiREVMRVRFX0RBVEFTT1VSQ0UiLCJWSUVXX0xBS0VIT1VTRSIsIkNSRUFURV9MQUtFSE9VU0UiLCJERUxFVEVfTEFLRUhPVVNFIiwiREVMRVRFX1BJUEVMSU5FIiwiQVNTSUdOX1JPTEVTIl0sInJvbGVzIjpbIlVTRVIiLCJMQUtFSE9VU0VfQURNSU4iLCJDT05ORUNUT1JfQURNSU4iLCJDT1BJTE9USFVCX0FETUlOIiwiQUNDT1VOVF9BRE1JTiJdLCJleHAiOjE3NTE2MjkzODUsImlhdCI6MTc1MTI2OTM4NX0.zu4gurcKytvz9FeMLZP4mhm3l-PUXIq2QQE0AF9kb8X5fLr0H_D8qFy1mzxHv4rBzL13J4VjQaUWeN8bj3jVYA',
                'Accept': 'application/json'
            }
        });
        
        const data = JSON.parse(response.body);
        if (data && data.data && Array.isArray(data.data)) {
            const locations = data.data.map(item => item.location || item.city || item.name).filter(Boolean);
            if (locations.length > 0) {
                console.log(`✅ Fetched ${locations.length} locations from external API`);
                return locations;
            }
        }
        throw new Error('No valid locations found in response');
    } catch (error) {
        console.log(`❌ Failed to fetch locations from external API: ${error.message}`);
        console.log('📋 Using default locations');
        return DEFAULT_LOCATIONS;
    }
};

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

    // Use input values if provided, otherwise use fetched data
    const titles = Array.isArray(input.jobTitles) && input.jobTitles.length ? input.jobTitles : fetchedTitles;
    const locations = Array.isArray(input.locations) && input.locations.length ? input.locations : fetchedLocations;
    const excludedCompanies = fetchedCompetitors;

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
    
    // Set the current actor timeout to match the expected bridge execution time
    console.log(`🕐 Setting actor timeout to ${expectedBridgeSecs} seconds to match job scraping requirements`);
    await Actor.setTimeout(expectedBridgeSecs * 1000); // Convert to milliseconds
    
    if (process.env.APIFY_TIMEOUT_AT) {
        const remainingSecs = Math.floor((new Date(process.env.APIFY_TIMEOUT_AT).getTime() - Date.now()) / 1000);
        if (remainingSecs < expectedBridgeSecs) {
            console.log(`WARNING: current run timeout is ${remainingSecs}s but at least ${expectedBridgeSecs}s is recommended.`);
        } else {
            console.log(`✅ Actor timeout successfully set: ${remainingSecs}s available, ${expectedBridgeSecs}s required`);
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

        const filteredItems = items.filter(job => !excludedCompanies.includes((job.companyName ?? '').trim()));
        if (filteredItems.length === 0) {
            console.log('Nothing to forward — all jobs excluded by company name.');
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
