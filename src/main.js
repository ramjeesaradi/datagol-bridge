import { Actor } from 'apify';
import got from 'got';
import { EXCLUDED_COMPANIES } from './excludedCompanies.js';
import { JOB_TITLES, LOCATIONS, ROWS } from './scraperInput.js';
import { buildReportRow } from './reportBase.js';

const scraperTimeoutEnv = parseInt(process.env.SCRAPER_TIMEOUT_SECS ?? '', 10);
const SCRAPER_TIMEOUT = Number.isFinite(scraperTimeoutEnv) ? scraperTimeoutEnv : undefined;

export default Actor.main(async () => {
    const url = process.env.DATAGOL_URL;
    const token = process.env.DATAGOL_TOKEN;

    for (const title of JOB_TITLES) {
        for (const location of LOCATIONS) {
            const input = { title, location, rows: ROWS };
            console.log(`Running LinkedIn jobs scraper with input: ${JSON.stringify(input)}`);

            const { defaultDatasetId } = await Actor.call('bebity/linkedin-jobs-scraper', input, { timeout: SCRAPER_TIMEOUT });
            const { items } = await Actor.openDataset(defaultDatasetId).then(ds => ds.getData());

            if (items.length === 0) {
                console.log('Nothing to forward — dataset empty.');
                continue;
            }

            const filteredItems = items.filter(job => !EXCLUDED_COMPANIES.includes((job.companyName ?? '').trim()));
            if (filteredItems.length === 0) {
                console.log('Nothing to forward — all jobs excluded by company name.');
                continue;
            }

            const rows = filteredItems.map(buildReportRow);

            console.log(`\n--- About to POST ${rows.length} row(s) to DataGOL at:\n   ${url}\n--- Using token prefix: ${token?.slice(0, 6)}\n`);

            for (const [i, row] of rows.entries()) {
                console.log(`→ [${i + 1}/${rows.length}]`, JSON.stringify(row).slice(0, 200) + '…');
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

            console.log(`\n✅ Finished processing ${rows.length} row(s) for input ${JSON.stringify(input)}\n`);
        }
    }
});
