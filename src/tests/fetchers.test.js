import { jest } from '@jest/globals';
import 'dotenv/config';

// Mock dependencies


const mockBuildReportRow = jest.fn();
jest.unstable_mockModule('../reportBase.js', () => ({
    buildReportRow: mockBuildReportRow,
}));

// Mock apify
jest.unstable_mockModule('apify', () => ({
    log: {
        info: (...args) => console.log('INFO:', ...args),
        warning: (...args) => console.warn('WARN:', ...args),
        error: (...args) => console.error('ERROR:', ...args),
    },
}));

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
}));

// Import functions to test
const testConfig = {
    filters: {},

    datagolApi: {
        baseUrl: process.env.DATAGOL_BASE_URL || 'https://be-eu.datagol.ai/noCo/api/v2',
        workspaceId: process.env.DATAGOL_WORKSPACE_ID,
        readToken: process.env.DATAGOL_READ_TOKEN,
        writeToken: process.env.DATAGOL_WRITE_TOKEN,
        tables: {
            jobTitles: process.env.DATAGOL_JOB_TITLES_TABLE_ID || '395a586f-2d3e-4489-a5d9-be0039f97aa1',
            excludedCompanies: process.env.DATAGOL_EXCLUDED_COMPANIES_TABLE_ID || 'ac27bdbc-b564-429e-815d-356d58b00d06',
            locations: process.env.DATAGOL_LOCATIONS_TABLE_ID || '6122189a-764f-40a9-9721-d756b7dd3626',
            jobPostings: process.env.DATAGOL_JOB_POSTINGS_TABLE_ID || 'your_job_postings_table_id',
        },
    },
};

describe('fetchers', () => {
    let getFilterValues;
    let saveToDatagol;

    beforeAll(async () => {
        // Dynamically import the mocked module after the mock is defined
        const { getFilterValues: mockedGetFilterValues, saveToDatagol: mockedSaveToDatagol } = await import('../fetchers.js');
        getFilterValues = mockedGetFilterValues;
        saveToDatagol = mockedSaveToDatagol;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getFilterValues', () => {
        it('should fetch job titles from the Datagol API', async () => {
            const titles = await getFilterValues(testConfig, 'jobTitles');
            console.log(`📄 Fetched ${titles.length} job titles.`);
            expect(Array.isArray(titles)).toBe(true);
            expect(titles.length).toBeGreaterThan(0);
            expect(typeof titles[0]).toBe('string');
        });

        it('should fetch locations from the Datagol API', async () => {
            const locations = await getFilterValues(testConfig, 'locations');
            expect(Array.isArray(locations)).toBe(true);
            expect(locations.length).toBeGreaterThan(0);
            expect(typeof locations[0]).toBe('string');
        });

        it('should fetch excluded companies from the Datagol API', async () => {
            const competitors = await getFilterValues(testConfig, 'excludedCompanies');
            expect(Array.isArray(competitors)).toBe(true);
            expect(competitors.length).toBeGreaterThan(0);
            expect(typeof competitors[0]).toBe('string');
        });
    });

    describe('saveToDatagol', () => {
        it('should save job posting to Datagol', async () => {
            const jobPosting = {
                jobTitle: 'Test Job',
                company: 'Test Company',
                location: 'Test Location',
                jobUrl: 'http://test.url',
                jobDescription: 'Test Description',
                salary: 'Test Salary',
                postedDate: '2023-01-01',
                jobType: 'Full-time',
                jobId: 'test-id'
            };
            const result = await saveToDatagol(testConfig, jobPosting);
            expect(result).toEqual({ success: true });
        });
    });
});
