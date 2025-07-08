import { jest } from '@jest/globals';

// Mock dependencies
const mockGotPost = jest.fn();
jest.unstable_mockModule('got', () => ({
    __esModule: true,
    default: {
        post: mockGotPost,
    },
}));

const mockBuildReportRow = jest.fn();
jest.unstable_mockModule('../reportBase.js', () => ({
    buildReportRow: mockBuildReportRow,
}));

// Mock apify
jest.unstable_mockModule('apify', () => ({
    log: {
        info: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
    },
}));

// Import functions to test
const { fetchJobTitles, saveToDatagol } = await import('../fetchers.js');

const mockConfig = {
    datagolApi: {
        baseUrl: 'https://api.datagol.io',
        workspaceId: 'test-workspace',
        readToken: 'test-read-token',
        writeToken: 'test-write-token',
        tables: {
            jobTitles: 'job-titles-table',
            jobPostings: 'job-postings-table',
        },
    },
};

describe('fetchers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('fetchJobTitles', () => {
        it('should return an empty array if the API call fails', async () => {
            mockGotPost.mockRejectedValue(new Error('API Error'));
            const titles = await fetchJobTitles(mockConfig);
            expect(titles).toEqual([]);
        });

        it('should return mapped job titles on successful API call', async () => {
            const apiResponse = [{ title: 'Engineer' }, { name: 'Developer' }];
            mockGotPost.mockResolvedValue({ body: apiResponse });

            const titles = await fetchJobTitles(mockConfig);

            expect(titles).toEqual(['Engineer', 'Developer']);
            expect(mockGotPost).toHaveBeenCalledWith(
                'https://api.datagol.io/workspaces/test-workspace/tables/job-titles-table/data/external',
                expect.any(Object)
            );
        });
    });

    describe('saveToDatagol', () => {
        it('should call the Datagol API with the correct payload for each job', async () => {
            const jobs = [{ title: 'Job 1' }, { title: 'Job 2' }];
            mockBuildReportRow.mockImplementation(job => ({ values: { ...job } }));
            mockGotPost.mockResolvedValue({ statusCode: 200 });

            await saveToDatagol(mockConfig, jobs);

            expect(mockBuildReportRow).toHaveBeenCalledTimes(2);
            expect(mockGotPost).toHaveBeenCalledTimes(2);
            expect(mockGotPost).toHaveBeenCalledWith(
                'https://api.datagol.io/workspaces/test-workspace/tables/job-postings-table/rows',
                expect.objectContaining({
                    json: { values: { title: 'Job 1' } },
                })
            );
        });

        it('should not attempt to save if writeToken is missing', async () => {
            const configWithoutToken = { ...mockConfig, datagolApi: { ...mockConfig.datagolApi, writeToken: null } };
            await saveToDatagol(configWithoutToken, [{ title: 'Job 1' }]);
            expect(mockGotPost).not.toHaveBeenCalled();
        });
    });
});
