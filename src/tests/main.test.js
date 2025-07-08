import { jest } from '@jest/globals';

const mockLog = {
  info: jest.fn(),
  warning: jest.fn(),
  exception: jest.fn(),
};

const mockActor = {
  getInput: jest.fn(),
  fail: jest.fn(),
  main: jest.fn(async (mainFunction) => {
            // This mock simulates Actor.main by running the provided function.
            // The try/catch inside main.js should handle the error.
            try {
                await mainFunction();
            } catch (error) {
                // The test expects the main.js catch block to handle this, so we do nothing here.
            }
        }),
};

// Mock the apify and fetchers modules
await jest.unstable_mockModule('apify', () => ({
  Actor: mockActor,
  log: mockLog,
}));

const mockGetFilterValues = jest.fn().mockRejectedValue(new Error('Fetcher Error'));

// Mock fetchers.js
await jest.unstable_mockModule('../fetchers.js', () => ({
    getFilterValues: mockGetFilterValues,
    processJobPostings: jest.fn(),
    saveToDatagol: jest.fn(),
}));

const mockProcessJobs = jest.fn().mockResolvedValue([]);
const mockSaveResults = jest.fn();

// Mock services.js
await jest.unstable_mockModule('../services.js', () => ({
    processJobs: mockProcessJobs,
    saveResults: mockSaveResults,
}));

describe('Main Actor Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should orchestrate the job fetching, processing, and saving on a successful run', async () => {
        // Arrange
        mockActor.getInput.mockResolvedValue({});
        mockGetFilterValues.mockResolvedValue(['Engineer']); // Mock successful filter fetching
        const mockJobs = [{ title: 'Software Engineer' }];
        mockProcessJobs.mockResolvedValue(mockJobs);

        // Act
        await import('../main.js');

        // Assert
        expect(mockGetFilterValues).toHaveBeenCalledTimes(3);
        expect(mockProcessJobs).toHaveBeenCalled();
        expect(mockSaveResults).toHaveBeenCalledWith(expect.any(Object), mockJobs);
        expect(mockLog.exception).not.toHaveBeenCalled();
        expect(mockActor.fail).not.toHaveBeenCalled();
    });

    it.skip('should call log.exception and Actor.fail on a fatal error', async () => {
        // Arrange: getInput will be called, and getFilterValues is mocked to fail
        mockActor.getInput.mockResolvedValue({});
        // We need to re-apply the mock's behavior for this specific test
        mockGetFilterValues.mockRejectedValue(new Error('Fetcher Error'));

        // Act: Dynamically import main.js to trigger the execution
        const main = (await import('../main.js')).default;
        try {
            await main();
        } catch (e) {
            // Error is expected, and handled by the Actor.main mock
        }

        // Assert: Check that the error was logged and the actor failed gracefully
        expect(mockProcessJobs).not.toHaveBeenCalled();
        expect(mockSaveResults).not.toHaveBeenCalled();
        expect(mockLog.exception).toHaveBeenCalledWith(
            '❌ Fatal error in main execution block',
            expect.any(Error)
        );
        expect(mockActor.fail).toHaveBeenCalledWith('Actor failed with a fatal error.');
    });
});
