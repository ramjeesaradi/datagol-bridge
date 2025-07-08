import { jest } from '@jest/globals';

const mockLog = {
  info: jest.fn(),
  warning: jest.fn(),
  exception: jest.fn(),
};

const mockActor = {
  getInput: jest.fn(),
  fail: jest.fn(),
  main: jest.fn(async (mainFn) => {
    try {
      await mainFn();
    } catch (error) {
      // The real Actor.main would catch this, but we need to simulate it
    }
  }),
};

// Mock the apify and fetchers modules
await jest.unstable_mockModule('apify', () => ({
  Actor: mockActor,
  log: mockLog,
}));

await jest.unstable_mockModule('../fetchers.js', () => ({
  getFilterValues: jest.fn().mockRejectedValue(new Error('Fetcher Error')),
  processJobPostings: jest.fn(),
}));

describe('Main Actor Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call log.exception and Actor.fail on a fatal error', async () => {
    // Arrange: getInput will be called, and getFilterValues is mocked to fail
    mockActor.getInput.mockResolvedValue({});

    // Act: Dynamically import main.js to trigger the execution
    await import('../main.js');

    // Assert: Check that the error was logged and the actor failed gracefully
    expect(mockLog.exception).toHaveBeenCalled();
    expect(mockLog.exception).toHaveBeenCalledWith(
      '❌ Fatal error in main execution block',
      expect.any(Error)
    );
    expect(mockActor.fail).toHaveBeenCalledWith('Actor failed with a fatal error.');
  });
});
