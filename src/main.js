import { Actor } from 'apify';
import got from 'got';
import { EXCLUDED_COMPANIES } from './excludedCompanies.js';

export default Actor.main(async () => {
    const { datasetId } = await Actor.getInput() ?? {};
    if (!datasetId) throw new Error('datasetId missing in input');

    // 1. Fetch scraped jobs
    const { items } = await Actor.openDataset(datasetId).then(ds => ds.getData());
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

    // 2. Map to DataGOL schema
    const rows = filteredItems.map(job => ({
        position: 0,
        cellValues: {
            title: job.title ?? '',
            location: job.location ?? '',
            postedtime: job.postedTime ?? '',
            publishedat: job.publishedAt ?? '',
            joburl: job.jobUrl ?? '',
            companyname: job.companyName ?? '',
            companyurl: job.companyUrl ?? '',
            description: job.description ?? '',
            applicationscount: job.applicationsCount ?? '',
            contracttype: job.contractType ?? '',
            experiencelevel: job.experienceLevel ?? '',
            worktype: job.workType ?? '',
            sector: job.sector ?? '',
            salary: job.salary ?? '',
            posterfullname: job.posterFullName ?? '',
            posterprofileurl: job.posterProfileUrl ?? '',
            companyid: job.companyId ?? '',
            applyurl: job.applyUrl ?? '',
            applytype: job.applyType ?? '',
            benefits: job.benefits ?? '',
        },
    }));

    const url = process.env.DATAGOL_URL;
    const token = process.env.DATAGOL_TOKEN;
    console.log(`\n--- About to POST ${rows.length} row(s) to DataGOL at:\n   ${url}\n--- Using token prefix: ${token?.slice(0, 6)}\n`);

    // 3. Send one row at a time, log details
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