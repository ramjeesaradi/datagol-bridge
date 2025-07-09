import { Actor, log } from 'apify';
import { ApifyClient } from 'apify-client';
import { getMergedConfig } from './config.js';
import { fetchAllData, saveToDatagol } from './datagol_api.js';
import { getDatasetItems } from './apify_service.js';
import { processAllJobs } from './job_processor.js';

Actor.main(async () => {
    try {
        log.info('Starting the Datagol Bridge actor.');

        // 1. Configuration
        const input = await Actor.getInput() ?? {};
        const config = getMergedConfig(input);

        // Initialize ApifyClient for checking actor's own runs
        const apifyClient = new ApifyClient({ token: process.env.APIFY_TOKEN });
        const currentActorId = process.env.APIFY_ACTOR_ID;

        // Check for a recent successful run of this actor itself
        if (currentActorId) {
            log.info(`Checking for recent runs of this actor (${currentActorId})...`);
            const runs = await apifyClient.actor(currentActorId).runs().list({
                desc: true,
                limit: 1000, // Only need the very last run
                status: 'SUCCEEDED',
            });

            if (runs.items.length > 0) {
                log.info(`Found ${runs.items.length} previous runs for this actor.`);
                const lastRun = runs.items[0];
                const runStartedAt = new Date(lastRun.startedAt);
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

                log.info(`Last run (${lastRun.id}) started at: ${runStartedAt.toISOString()}`);
                log.info(`Twenty-four hours ago: ${twentyFourHoursAgo.toISOString()}`);

                if (runStartedAt > twentyFourHoursAgo) {
                    log.info(`Found recent successful run of this actor (${lastRun.id}) started at ${lastRun.startedAt}. Reusing its dataset.`);
                    log.info(`Attempting to fetch items from dataset ID: ${lastRun.defaultDatasetId}`);
                    const finalJobs = await getDatasetItems(Actor, lastRun.defaultDatasetId);
                    console.log(`INFO  DEBUG: finalJobs length: ${finalJobs.length}`);
                    console.log(`INFO  DEBUG: finalJobs content (first 5 items): ${JSON.stringify(finalJobs.slice(0, 5))}`);
                    if (finalJobs.length > 0) {
                        log.info(`Fetched ${finalJobs.length} items from dataset ${lastRun.defaultDatasetId}.`);
                        await Actor.pushData(finalJobs);
                        await saveToDatagol(finalJobs, config);
                        log.info('Datagol Bridge actor finished successfully by reusing data.');
                        // Removed the temporary Actor.exit() breakpoint
                        return; // Exit here if data is reused
                    } else {
                        log.warning(`Recent run found (${lastRun.id}), but its dataset (${lastRun.defaultDatasetId}) was empty. Proceeding with new scrape.`);
                    }
                } else {
                    log.info(`Last run (${lastRun.id}) started more than 24 hours ago. Proceeding with new scrape.`);
                }
            } else {
                log.info('No previous successful runs found for this actor.');
            }
        }

        // 2. Fetch initial data from DataGOL
        log.info('Fetching initial data from DataGOL...');
        const filters = await fetchAllData(config);
        log.info(`Fetched ${filters.jobTitles.length} job titles, ${filters.locations.length} locations, and ${filters.excludedCompanies.length} excluded companies.`);

        if (filters.jobTitles.length === 0 || filters.locations.length === 0) {
            log.warning('No job titles or locations found. Actor will exit.');
            await Actor.exit();
            return;
        }

        // 3. Process all jobs
        log.info('Starting the job processing pipeline...');
        const finalJobs = await processAllJobs(config, filters);

        // 4. Save results
        if (finalJobs.length > 0) {
            log.info(`Saving ${finalJobs.length} unique jobs...`);
            await Actor.pushData(finalJobs);
            await saveToDatagol(finalJobs, config);
            log.info('All jobs saved successfully.');
        } else {
            log.warning('No new jobs found matching the criteria.');
        }

        log.info('Datagol Bridge actor finished successfully.');

    } catch (error) {
        log.exception('A fatal error occurred during actor execution:', error);
        await Actor.fail('Actor execution failed.');
    }
});