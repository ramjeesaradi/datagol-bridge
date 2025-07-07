import { jest } from '@jest/globals';

const fetchFromDatagolMock = jest.fn();

jest.unstable_mockModule('../src/services.js', () => ({ fetchFromDatagol: fetchFromDatagolMock }));

const fetchers = await import('../src/fetchers.js');
const {
  fetchJobTitles,
  fetchCompetitorList,
  fetchLocations,
  fetchAllData,
  DEFAULT_JOB_TITLES,
  DEFAULT_EXCLUDED_COMPANIES,
  DEFAULT_LOCATIONS,
} = fetchers.default;

describe('fetchers fallback behaviour', () => {
  afterEach(() => {
    fetchFromDatagolMock.mockReset();
  });

  test('returns default job titles when response has no data', async () => {
    fetchFromDatagolMock.mockResolvedValue(null);
    const result = await fetchJobTitles();
    expect(result).toEqual(DEFAULT_JOB_TITLES);
  });

  test('returns default competitors when response has no data', async () => {
    fetchFromDatagolMock.mockResolvedValue(null);
    const result = await fetchCompetitorList();
    expect(result).toEqual(DEFAULT_EXCLUDED_COMPANIES);
  });

  test('returns default locations when response has no data', async () => {
    fetchFromDatagolMock.mockResolvedValue(null);
    const result = await fetchLocations();
    expect(result).toEqual(DEFAULT_LOCATIONS);
  });
});

describe('fetchAllData', () => {
    test('fetches all data correctly', async () => {
        const mockJobTitles = [{ title: 'Financial Controller' }];
        const mockCompetitors = [{ company: 'Competitor Inc.' }];
        const mockLocations = [{ location: 'Brussels' }];

        fetchFromDatagolMock.mockImplementation(async (tableId) => {
            if (tableId === '395a586f-2d3e-4489-a5d9-be0039f97aa1') return mockJobTitles;
            if (tableId === 'ac27bdbc-b564-429e-815d-356d58b00d06') return mockCompetitors;
            if (tableId === '6122189a-764f-40a9-9721-d756b7dd3626') return mockLocations;
            return null;
        });

        const result = await fetchAllData();

        expect(result.jobTitles).toEqual(['Financial Controller']);
        expect(result.excludedCompanies).toEqual(['Competitor Inc.']);
        expect(result.locations).toEqual(['Brussels']);
    });
});