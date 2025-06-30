import { jest } from '@jest/globals';

const postMock = jest.fn();

jest.unstable_mockModule('got', () => ({ default: { post: postMock } }));

const fetchers = await import('../src/fetchers.js');
const {
  fetchJobTitles,
  fetchCompetitorList,
  fetchLocations,
  DEFAULT_JOB_TITLES,
  DEFAULT_EXCLUDED_COMPANIES,
  DEFAULT_LOCATIONS,
} = fetchers.default;

describe('fetchers fallback behaviour', () => {
  afterEach(() => {
    postMock.mockReset();
  });

  test('returns default job titles when response has no data', async () => {
    postMock.mockResolvedValue({ statusCode: 200, body: {} });
    const result = await fetchJobTitles();
    expect(result).toEqual(DEFAULT_JOB_TITLES);
  });

  test('returns default competitors when response has no data', async () => {
    postMock.mockResolvedValue({ statusCode: 200, body: {} });
    const result = await fetchCompetitorList();
    expect(result).toEqual(DEFAULT_EXCLUDED_COMPANIES);
  });

  test('returns default locations when response has no data', async () => {
    postMock.mockResolvedValue({ statusCode: 200, body: {} });
    const result = await fetchLocations();
    expect(result).toEqual(DEFAULT_LOCATIONS);
  });
});
