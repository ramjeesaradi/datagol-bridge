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

1. Install dependencies
   ```bash
   npm install
   ```
2. Prepare `input.json` with your parameters, for example:
   ```json
  {
    "datagolUrl": "https://example.com/api",
    "datagolToken": "<TOKEN>",
    "rows": 10,
    "scraperTimeoutSecs": 600,
    "jobTitles": ["Financial controller"],
    "locations": ["Brussels"]
  }
  ```
   (600 seconds equals 10 minutes.)
3. Run the actor
   ```bash
   npm start
   ```

All parameters can also be passed via the Apify platform UI. When not provided, the defaults from `src/scraperInput.js` are used.

## Development

Run the test suite with:
```bash
npm test
```
