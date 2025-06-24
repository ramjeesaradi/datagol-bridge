import { Actor } from 'apify';
import got from 'got';
import { EXCLUDED_COMPANIES } from './excludedCompanies.js';
import { JOB_TITLES as DEFAULT_JOB_TITLES, LOCATIONS as DEFAULT_LOCATIONS, ROWS as DEFAULT_ROWS } from './scraperInput.js';
import { buildReportRow } from './reportBase.js';

export default Actor.main(async () => {
    const input = await Actor.getInput() ?? {};

    const url = input.datagolUrl ?? process.env.DATAGOL_URL;
    const token = input.datagolToken ?? process.env.DATAGOL_TOKEN;

    const titles = Array.isArray(input.jobTitles) && input.jobTitles.length ? input.jobTitles : DEFAULT_JOB_TITLES;
    const locations = Array.isArray(input.locations) && input.locations.length ? input.locations : DEFAULT_LOCATIONS;

    const rows = Number.isFinite(input.rows) ? input.rows : DEFAULT_ROWS;

    const scraperTimeoutEnv = parseInt(input.scraperTimeoutSecs ?? process.env.SCRAPER_TIMEOUT_SECS ?? '3600', 10);
    const SCRAPER_TIMEOUT = Number.isFinite(scraperTimeoutEnv) ? Math.min(scraperTimeoutEnv, 3600) : 3600;

    const runInputs = [];
    for (const title of titles) {
        for (const location of locations) {
            runInputs.push({ title, location, rows });
        }
    }

    await Promise.all(runInputs.map(async (scraperInput) => {
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

        const filteredItems = items.filter(job => !EXCLUDED_COMPANIES.includes((job.companyName ?? '').trim()));
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
    }));
});
