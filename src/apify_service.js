import { Actor, log } from 'apify';
import { ApifyClient } from 'apify-client';

// Helper function to introduce a small, random delay to stagger API calls
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs the LinkedIn scraper actor, checking for recent successful runs first.
 * @param {object} scraperInput - The specific input for this scraper run (e.g., title, location).
 * @param {object} config - The main configuration object.
 * @returns {Promise<Array>} A promise that resolves to an array of job items.
 */
export async function runScraper(scraperInput, config, recentRun) {
    // Add a random stagger between 100ms and 500ms to avoid API rate limits
    await sleep(100 + Math.random() * 400);
    const { scraper: scraperConfig } = config;
    const apifyClient = new ApifyClient({ token: scraperConfig.apifyToken });

    const actorInput = {
        title: scraperInput.title,
        location: scraperInput.location,
        rows: scraperConfig.totalJobsToFetch,
        publishedAt: 'r86400', // Last 24 hours
    };



    if (recentRun) {
        log.info(`Reusing results from recent run ${recentRun.id} for input: ${JSON.stringify(actorInput)}`);
        return getDatasetItems(recentRun.defaultDatasetId);
    }

    log.info(`Starting new scraper run for input: ${JSON.stringify(actorInput)}`);
    const run = await Actor.call(scraperConfig.id, actorInput, {
        memory: scraperConfig.memory,
        timeout: scraperConfig.timeoutSecs,
    });

    if (run.status !== 'SUCCEEDED') {
        log.error(`Scraper run ${run.id} failed with status: ${run.status}`);
        return [];
    }

    log.info(`Scraper run ${run.id} finished successfully.`);
    return getDatasetItems(run.defaultDatasetId);
}

/**
 * Fetches the latest successful run for a given actor within the last 24 hours with matching input.
 * @param {ApifyClient} apifyClient - The ApifyClient instance.
 * @param {string} scraperId - The ID of the actor to check.
 * @param {Date} twentyFourHoursAgo - A Date object representing 24 hours ago.
 * @param {object} currentInput - The current input to match against.
 * @returns {Promise<object|null>} The run object if found, otherwise null.
 */
export async function getRecentScraperRuns(apifyClient, scraperId, twentyFourHoursAgo, currentInput) {
    log.info(`Attempting to find a recent successful run for scraper ${scraperId} after: ${twentyFourHoursAgo.toISOString()}`);
    try {
        const runs = await apifyClient.actor(scraperId).runs().list({
            limit: 10, // Fetch a small number of recent runs
            desc: true, // Sort by creation time descending
            status: 'SUCCEEDED', // Only consider successful runs
        });

        for (const run of runs.items) {
            if (!run.startedAt) {
                log.warning(`Run ${run.id} has no startedAt timestamp. Skipping.`);
                continue;
            }
            const runStartedAt = new Date(run.startedAt);
            if (isNaN(runStartedAt.getTime())) {
                log.warning(`Run ${run.id} has an invalid startedAt timestamp: ${run.startedAt}. Skipping.`);
                continue;
            }

            log.info(`Processing run ${run.id}, started at: ${runStartedAt.toISOString()}`);

            if (runStartedAt > twentyFourHoursAgo) {
                try {
                    const runDetail = await apifyClient.run(run.id).get();
                    if (runDetail && runDetail.input) {
                        log.info(`Found recent successful run ${run.id}. Checking input similarity...`);
                        if (isSimilarInput(currentInput, runDetail.input)) {
                            log.info(`Input is similar for run ${run.id}. Reusing this run.`);
                            return runDetail;
                        } else {
                            log.info(`Input is NOT similar for run ${run.id}. Skipping.`);
                        }
                    } else {
                        log.warning(`Run ${run.id} detail or input could not be fetched or was empty. Skipping.`);
                    }
                } catch (detailError) {
                    log.error(`Failed to fetch details for run ${run.id}: ${detailError.message}. Skipping.`);
                }
            } else {
                log.info(`Run ${run.id} started too long ago. Skipping.`);
            }
        }
        log.info(`No recent successful run found for scraper ${scraperId} with similar input.`);
        return null;
    } catch (error) {
        log.error(`Failed to fetch recent runs for scraper ${scraperId} due to a non-retriable error.`, { error: error.message });
        throw error;
    }
}

/**
 * Checks if two inputs are similar.
 * @param {object} input1 - The first input.
 * @param {object} input2 - The second input.
 * @returns {boolean} True if the inputs are similar, false otherwise.
 */
function isSimilarInput(input1, input2) {
    log.info('Performing similarity check for inputs.', {
        input1: { title: input1.title, location: input1.location, rows: input1.rows },
        input2: { title: input2.title, location: input2.location, rows: input2.rows }
    });
    const isMatch = input1.title === input2.title &&
                    input1.location === input2.location &&
                    input1.rows === input2.rows;
    log.info(`Similarity check result: ${isMatch ? 'Match' : 'No Match'}`);
    return isMatch;
}

/**
 * Fetches all items from a given dataset.
 * @param {string} datasetId - The ID of the dataset to fetch items from.
 * @returns {Promise<Array>} An array of items from the dataset.
 */
export async function getDatasetItems(actor, datasetId) {
    console.log(`INFO  Attempting to open dataset with ID: ${datasetId}`);
    const dataset = await actor.openDataset(datasetId);
    console.log(`INFO  Dataset opened. Dataset name: ${dataset.name}, ID: ${dataset.id}`);
    const { items, ...rest } = await dataset.getData();
    console.log(`INFO  Raw items from dataset.getData(): ${JSON.stringify(items.slice(0, 5))}`); // Log first 5 items
    console.log(`INFO  Total items found in dataset.getData(): ${items.length}`);
    return items;
}