# DataGOL Bridge

This actor collects job postings from LinkedIn and forwards them to a DataGOL instance. It
runs the `bebity/linkedin-jobs-scraper` actor for each job title and location listed in
`src/scraperInput.js`, filters out postings from companies listed in `src/excludedCompanies.js`
and posts the remaining jobs to DataGOL using HTTP requests.

## Usage

1. Install dependencies
   ```bash
   npm install
   ```
2. Set the following environment variables:
   - `DATAGOL_URL` – URL of the DataGOL endpoint
   - `DATAGOL_TOKEN` – authentication token for the endpoint
   - `ROWS` *(optional)* – number of results to fetch for each query (default: 10)
3. Run the actor
   ```bash
   npm start
   ```

The actor does not require any input fields – it uses the data defined in the source files.
You can adjust job titles and locations directly in `src/scraperInput.js`. The number of rows can be changed by setting the `ROWS` environment variable or editing `src/scraperInput.js`.

## Development

Run the test suite with:
```bash
npm test
```
