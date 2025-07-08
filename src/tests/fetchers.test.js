import { jest } from '@jest/globals';

// Mock the 'got' library using the ESM-compatible method
await jest.unstable_mockModule('got', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

// Dynamically import the mocked module and the function to test
const got = (await import('got')).default;
const { fetchJobTitles } = await import('../fetchers.js');

const mockConfig = {
  datagolApi: {
    baseUrl: 'https://api.datagol.io',
    workspaceId: 'test-workspace',
    readToken: 'test-token',
    tables: {
      jobTitles: 'table1',
      excludedCompanies: 'table2',
      locations: 'table3',
    },
  },
};

describe('fetchers', () => {
  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchJobTitles', () => {
    it('should return an empty array if the API call fails', async () => {
      // Arrange: mock the got.post method to throw an error
      got.post.mockRejectedValue(new Error('API Error'));

      // Act: call the function
      const jobTitles = await fetchJobTitles(mockConfig);

      // Assert: check that the function returns an empty array
      expect(jobTitles).toEqual([]);
    });
  });
});
