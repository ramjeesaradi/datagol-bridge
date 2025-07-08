import { jest } from '@jest/globals';

import 'dotenv/config';

// Mock fetchers
jest.unstable_mockModule('../fetchers.js', () => ({
    getFilterValues: jest.fn(async (config, filterType) => {
        if (filterType === 'jobTitles') {
            return ['Mock Job Title 1', 'Mock Job Title 2'];
        } else if (filterType === 'locations') {
            return ['Mock Location 1', 'Mock Location 2'];
        } else if (filterType === 'excludedCompanies') {
            return ['Mock Competitor 1', 'Mock Competitor 2'];
        }
        return [];
    }),
    saveToDatagol: jest.fn(async (config, jobPosting) => {
        console.log('INFO: Saving 1 jobs to Datagol...');
        if (!config.datagolApi?.writeToken || !config.datagolApi?.workspaceId) {
            console.warn('WARN: ❌ Missing workspaceId or writeToken for saving to Datagol. Skipping.');
            return;
        }
        // Simulate successful save
        console.log('INFO: ✅ Successfully saved job to Datagol.');
        return { success: true };
    }),
    processJobPostings: jest.fn((config, jobPostings) => {
        console.log('INFO: Mocking processJobPostings, returning input jobs.');
        return jobPostings;
    }),
}));

// Mock the entire 'apify' module
let Actor;

jest.unstable_mockModule('apify', () => ({
    Actor: {
        init: jest.fn(),
        call: jest.fn(async (actorId, input) => {
            console.log(`INFO: Mocking Apify Actor.call for ${actorId}`);
            // Simulate a successful scraper run with dummy job data
            return {
                status: 'SUCCEEDED',
                output: {
                    get: async () => [{
                        jobTitle: 'Mock Job',
                        company: 'Mock Company',
                        location: 'Mock Location',
                        jobUrl: 'http://mock.url',
                        jobDescription: 'Mock Description',
                        salary: 'Mock Salary',
                        postedDate: 'Mock Date',
                        jobType: 'Mock Type',
                        jobId: 'mock-id'
                    }]
                }
            };
        }),
        openDataset: jest.fn(async (datasetId) => {
            console.log(`INFO: Mocking Actor.openDataset for ${datasetId}`);
            return {
                getData: jest.fn(async () => ({
                    items: [{
                        jobTitle: 'Mock Job from Dataset',
                        company: 'Mock Company from Dataset',
                        location: 'Mock Location from Dataset',
                        jobUrl: 'http://mock.url/dataset',
                        jobDescription: 'Mock Description from Dataset',
                        salary: 'Mock Salary from Dataset',
                        postedDate: 'Mock Date from Dataset',
                        jobType: 'Mock Type from Dataset',
                        jobId: 'mock-id-dataset'
                    }]
                }))
            };
        })
    },
    log: {
        info: (...args) => console.log('INFO:', ...args),
        warning: (...args) => console.warn('WARN:', ...args),
        error: (...args) => console.error('ERROR:', ...args),
    },
}));

let processJobs;
let saveResults;

beforeAll(async () => {
    const apifyModule = await import('apify');
    Actor = apifyModule.Actor;
    Actor.pushData = jest.fn(); // Mock pushData
    await Actor.init();

    // Dynamically import services after mocks are set up
    const servicesModule = await import('../services.js');
    processJobs = servicesModule.processJobs;
    saveResults = servicesModule.saveResults;
});



// Configuration for integration tests, loaded from .env file
const testConfig = {
    datagolApi: {
        baseUrl: process.env.DATAGOL_BASE_URL || 'https://be-eu.datagol.ai/noCo/api/v2',
        workspaceId: process.env.DATAGOL_WORKSPACE_ID,
        readToken: process.env.DATAGOL_READ_TOKEN,
        writeToken: process.env.DATAGOL_WRITE_TOKEN,
        tables: {
            jobTitles: process.env.DATAGOL_JOB_TITLES_TABLE_ID,
            excludedCompanies: process.env.DATAGOL_EXCLUDED_COMPANIES_TABLE_ID,
            locations: process.env.DATAGOL_LOCATIONS_TABLE_ID,
            jobPostings: process.env.DATAGOL_JOB_POSTINGS_TABLE_ID,
        },
    },
    scraper: {
        totalJobsToFetch: 5, // Keep this low for testing
        apifyToken: process.env.APIFY_TOKEN,
        maxConcurrent: 1,
    },
    deduplication: {
        enabled: true,
    },
};

describe('processJobs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should run the scraper and process the results for a single search combination', async () => {
        const config = {
            ...testConfig,
            filters: { jobTitles: ['Software Engineer'], locations: ['London'] },
        };

        // This will call the actual scraper
        const jobs = await processJobs(config);

        // We expect to get an array of jobs back
        expect(Array.isArray(jobs)).toBe(true);
    }, 60000); // Increase timeout for external API calls

    
});

describe('saveResults', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should save job results to Datagol', async () => {
        const jobsToSave = [
            {
                title: 'Senior Test Engineer',
                company: 'Cascade Integration Tests',
                location: 'Remote',
                description: 'This is a test job created during an integration test run.',
                jobUrl: 'https://example.com/job/test-senior-engineer',
                applyUrl: 'https://example.com/apply/test-senior-engineer',
            },
        ];

        // We expect the function to complete without throwing an error
        await expect(saveResults(testConfig, jobsToSave)).resolves.not.toThrow();
    });

    
});
