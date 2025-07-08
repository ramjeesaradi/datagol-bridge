# DataGOL Bridge

This actor collects job postings from LinkedIn and forwards them to a DataGOL instance. It
runs the `bebity/linkedin-jobs-scraper` actor for each job title and location listed in
`src/scraperInput.js`, filters out postings from companies listed in `src/excludedCompanies.js`
and posts the remaining jobs to DataGOL using HTTP requests. Scraper runs for all
title/location pairs are executed in batches of 24 in parallel due to the platform's
concurrent run limit, and results are forwarded as soon as
each batch finishes.
Each LinkedIn scraper run is started with only 256&nbsp;MB of memory and
will be aborted if it runs longer than 600&nbsp;seconds (10&nbsp;minutes by default).
When scheduling this actor, set its run timeout to at least the scraper timeout
multiplied by the number of batches plus 120&nbsp;seconds so the bridge has enough time to finish.

## Usage

This actor is designed to fetch job titles, locations, and excluded companies from the DataGOL API to configure subsequent job scraping operations. Sensitive API tokens are managed via environment variables for security.

1.  **Install dependencies**
    ```bash
    npm install
    ```
2.  **Prepare `input.json` with your parameters**
    The actor's configuration is primarily handled via environment variables and the `.actor/input_schema.json`. You can provide additional parameters via `input.json` or the Apify platform UI. For example:
    ```json
    {
      "totalJobsToFetch": 50,
      "timeoutSecs": 600,
      "maxConcurrent": 30
    }
    ```
    (600 seconds equals 10 minutes.)

3.  **Run the actor locally**
    ```bash
    npm start
    ```

All parameters can also be passed via the Apify platform UI. When not provided, the defaults from `src/scraperInput.js` are used.

## Deployment

To build the Docker image locally and push it to the Apify platform's registry (to reduce build costs on Apify):

1.  **Ensure you have Docker installed and running.**
2.  **Ensure you have your Apify API Token ready.** You can find it in your Apify Console under Settings &rarr; Integrations.
3.  **Run the deployment script:**
    ```bash
    ./scripts/deploy_local_docker.sh
    ```
    This script will prompt you for your Apify Username and API Token, then it will:
    *   Log in to the Apify Docker registry.
    *   Build the Docker image locally.
    *   Tag the image for the Apify registry.
    *   Push the tagged image to the Apify registry.

    **Important:** After successfully pushing the image, ensure that your `.actor/actor.json` file is configured to use this pre-built image. It should contain a line like:
    `"image": "registry.apify.com/<your-apify-username>/datagol-bridge:latest"`
    (Remember to replace `<your-apify-username>` with your actual Apify username.)

## Development

Run the test suite with:
```bash
npm test
```
