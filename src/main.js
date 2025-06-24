import { Actor } from 'apify';
import got from 'got';
import { EXCLUDED_COMPANIES } from './excludedCompanies.js';
import { JOB_TITLES, LOCATIONS, ROWS } from './scraperInput.js';
import { buildReportRow } from './reportBase.js';

export default Actor.main(async () => {
    // 1. Run LinkedIn jobs scraper for each job title and location
    const allItems = [];
    for (const title of JOB_TITLES) {
        for (const location of LOCATIONS) {
            const input = { title, location, rows: ROWS };
            console.log(`Running LinkedIn jobs scraper with input: ${JSON.stringify(input)}`);
            const { defaultDatasetId } = await Actor.call('bebity/linkedin-jobs-scraper', input);
            const { items } = await Actor.openDataset(defaultDatasetId).then(ds => ds.getData());
            allItems.push(...items);
        }
    }

    // 2. Merge results
    const items = allItems;
    if (items.length === 0) {
        console.log('Nothing to forward — dataset empty.');
        return;
    }

    // Filter out jobs with excluded company names
    const filteredItems = items.filter(job => !EXCLUDED_COMPANIES.includes((job.companyName ?? '').trim()));
    if (filteredItems.length === 0) {
        console.log('Nothing to forward — all jobs excluded by company name.');
        return;
    }

    // 3. Map to DataGOL schema
    const rows = filteredItems.map(buildReportRow);

    const url = process.env.DATAGOL_URL;
    const token = process.env.DATAGOL_TOKEN;
    console.log(`\n--- About to POST ${rows.length} row(s) to DataGOL at:\n   ${url}\n--- Using token prefix: ${token?.slice(0, 6)}\n`);

    // 4. Send one row at a time, log details
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
                throwHttpErrors: false,      // so we can inspect 4xx/5xx
            });
            console.log(`  ✔ status=${resp.statusCode}`, resp.body);
        } catch (err) {
            console.error(`  ✖ Exception:`, err.message);
        }
    }

    console.log(`\n✅ Finished processing ${rows.length} row(s)\n`);
});
