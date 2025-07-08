import { jest } from '@jest/globals';

// Mock dependencies before importing the service
const mockRunScraper = jest.fn();
const mockProcessJobPostings = jest.fn((config, jobs) => jobs); // Correctly mock this function
const mockSaveToDatagol = jest.fn();
const mockActorPushData = jest.fn();
const mockGetFilterValues = jest.fn();

// Mock the entire fetchers module
jest.unstable_mockModule('../fetchers.js', () => ({
    getFilterValues: mockGetFilterValues,
    processJobPostings: mockProcessJobPostings,
    saveToDatagol: mockSaveToDatagol,
}));

// Mock the apify module
jest.unstable_mockModule('apify', () => ({
    Actor: {
        main: jest.fn(async (mainFunction) => {
            try {
                await mainFunction();
            } catch (err) {
                // In a real scenario, Actor.main would handle this.
                // For testing, we allow the error to propagate to be caught by Jest.
                throw err;
            }
        }),
        getInput: jest.fn(),
        pushData: mockActorPushData,
        call: mockRunScraper, // Simplified: Actor.call is our scraper runner
        openDataset: jest.fn().mockResolvedValue({
            getData: jest.fn().mockResolvedValue({ items: [] }),
        }),
        fail: jest.fn(),
    },
    log: {
        info: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
        exception: jest.fn(),
    },
}));

// Dynamically import services after mocks are set up
const { processJobs, saveResults } = await import('../services.js');

describe('processJobs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should run the scraper and process the results', async () => {
        const config = {
            filters: { jobTitles: ['Engineer'], locations: ['London'] },
            scraper: { totalJobsToFetch: 5, maxConcurrent: 1 },
            deduplication: { enabled: true },
        };
        const scrapedJobs = [{ title: 'Engineer', company: 'OldCo', location: 'London' }];
        mockRunScraper.mockResolvedValue({ status: 'SUCCEEDED', defaultDatasetId: 'mock-dataset-id' });
        // Mock the dataset retrieval for the scraped jobs
        const mockDataset = { getData: jest.fn().mockResolvedValue({ items: scrapedJobs }) };
        (await import('apify')).Actor.openDataset.mockResolvedValue(mockDataset);

        const result = await processJobs(config);

        expect(mockRunScraper).toHaveBeenCalled();
        expect(mockProcessJobPostings).toHaveBeenCalledWith(config, scrapedJobs);
        expect(result).toEqual(scrapedJobs);
    });

    it('should not run scraper if filters are missing', async () => {
        const config = { filters: {}, scraper: {}, deduplication: {} };
        await processJobs(config);
        expect(mockRunScraper).not.toHaveBeenCalled();
    });
});

describe('saveResults', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should push data to Actor and save to Datagol', async () => {
        const config = { datagolApi: { tables: { jobPostings: 'table-id' } } };
        const jobs = [{ title: 'Developer' }];

        await saveResults(config, jobs);

        expect(mockActorPushData).toHaveBeenCalledWith(jobs);
        expect(mockSaveToDatagol).toHaveBeenCalledWith(config, jobs);
    });

    it('should not save to Datagol if table is not configured', async () => {
        const config = { datagolApi: { tables: {} } };
        const jobs = [{ title: 'Developer' }];

        await saveResults(config, jobs);

        expect(mockActorPushData).toHaveBeenCalledWith(jobs);
        expect(mockSaveToDatagol).not.toHaveBeenCalled();
    });

    it('should not do anything if there are no jobs', async () => {
        const config = { datagolApi: { tables: { jobPostings: 'table-id' } } };
        const jobs = [];

        await saveResults(config, jobs);

        expect(mockActorPushData).not.toHaveBeenCalled();
        expect(mockSaveToDatagol).not.toHaveBeenCalled();
    });
});
