import { jest } from '@jest/globals';
import got from 'got';

// Mock the got module
const mockPost = jest.fn();
const mockGot = {
    post: mockPost,
};

// Mock the console to avoid test output pollution
const originalConsole = { ...console };

// Import the actual module for default values
import * as actualFetchers from '../src/fetchers.js';

// Mock the fetchers module
jest.unstable_mockModule('../src/fetchers.js', () => {
    return {
        __esModule: true,
        default: {
            ...actualFetchers.default,
            // We'll override these in tests
            fetchJobTitles: jest.fn(),
            fetchCompetitorList: jest.fn(),
            fetchLocations: jest.fn(),
        },
        // Re-export the constants
        DEFAULT_JOB_TITLES: fetchers.DEFAULT_JOB_TITLES,
        DEFAULT_EXCLUDED_COMPANIES: fetchers.DEFAULT_EXCLUDED_COMPANIES,
        DEFAULT_LOCATIONS: fetchers.DEFAULT_LOCATIONS,
    };
});

// Import the mocked module
let fetchersModule;
let fetchJobTitles, fetchCompetitorList, fetchLocations;

beforeAll(async () => {
    // Mock the got module first
    jest.unstable_mockModule('got', () => ({
        __esModule: true,
        default: mockGot,
        got: mockGot,
    }));

    // Import the mocked fetchers module
    const fetchersModule = await import('../src/fetchers.js');
    fetchers = fetchersModule.default;
    
    // Get the actual constants for testing
    DEFAULT_JOB_TITLES = fetchersModule.DEFAULT_JOB_TITLES;
    DEFAULT_EXCLUDED_COMPANIES = fetchersModule.DEFAULT_EXCLUDED_COMPANIES;
    DEFAULT_LOCATIONS = fetchersModule.DEFAULT_LOCATIONS;
    
    // Setup mock implementations that use the actual functions by default
    fetchers.fetchJobTitles.mockImplementation(actualFetchers.default.fetchJobTitles);
    fetchers.fetchCompetitorList.mockImplementation(actualFetchers.default.fetchCompetitorList);
    fetchers.fetchLocations.mockImplementation(actualFetchers.default.fetchLocations);
    
    // Mock console methods
    global.console = {
        ...console,
        log: jest.fn(),
        error: jest.fn()
    };
});

beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Reset the got mock
    got.post.mockReset();
    
    // Setup default mock implementation for got.post
    got.post.mockImplementation(() => Promise.resolve({
        statusCode: 200,
        body: { data: [] }
    }));
    
    // Reset the fetcher mocks to use actual implementations
    fetchers.fetchJobTitles.mockImplementation(actualFetchers.default.fetchJobTitles);
    fetchers.fetchCompetitorList.mockImplementation(actualFetchers.default.fetchCompetitorList);
    fetchers.fetchLocations.mockImplementation(actualFetchers.default.fetchLocations);
});

afterAll(() => {
    // Restore original console
    global.console = originalConsole;
    jest.restoreAllMocks();
});

// Helper function to mock successful API response
const mockSuccessfulResponse = (data) => ({
    body: {
        data: data
    },
    statusCode: 200
});

// Helper function to mock failed API response
const mockFailedResponse = () => {
    throw new Error('API Error');
};

describe('Fetchers Module', () => {
    // Mock data for tests
    const mockJobTitles = [
        { title: 'Software Engineer' },
        { name: 'Data Scientist' },
        { jobTitle: 'Product Manager' }
    ];

    const mockCompanies = [
        { company: 'Acme Inc' },
        { companyName: 'Globex Corp' },
        { name: 'Initech' }
    ];

    const mockLocations = [
        { location: 'New York' },
        { city: 'San Francisco' },
        { name: 'Remote' },
        { title: 'London' }
    ];
    
    // Helper function to get the actual implementation for testing
    const getActualImplementation = (fnName) => {
        return actualFetchers.default[fnName];
    };

    // Reset all mocks before each test
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock the got.post implementation
        got.post.mockReset();
        // Clear console mocks
        console.log.mockClear();
        console.error.mockClear();
    });

    describe('fetchJobTitles', () => {
        it('should fetch and return job titles from API', async () => {
            // Setup mock implementation for this test
            const actualFetchJobTitles = getActualImplementation('fetchJobTitles');
            fetchers.fetchJobTitles.mockImplementation(actualFetchJobTitles);
            
            // Mock successful API response
            got.post.mockResolvedValueOnce({
                statusCode: 200,
                body: {
                    data: mockJobTitles
                }
            });

            const result = await fetchers.fetchJobTitles();

            // Verify API was called with correct parameters
            expect(got.post).toHaveBeenCalledWith(
                expect.stringContaining('/tables/395a586f-2d3e-4489-a5d9-be0039f97aa1/data/external'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': expect.stringContaining('Bearer'),
                        'Content-Type': 'application/json'
                    }),
                    json: {
                        requestPageDetails: {
                            pageNumber: 1,
                            pageSize: 500
                        }
                    },
                    responseType: 'json',
                    timeout: 10000
                })
            );

            // Should return an array of job titles
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(3);
            expect(result).toContain('Software Engineer');
            expect(result).toContain('Data Scientist');
            expect(result).toContain('Product Manager');

            // Should log success
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Fetched 3 job titles from external API')
            );
        });

        it('should handle empty API response by returning default titles', async () => {
            // Setup mock implementation for this test
            const actualFetchJobTitles = getActualImplementation('fetchJobTitles');
            fetchers.fetchJobTitles.mockImplementation(actualFetchJobTitles);
            
            // Mock empty response
            got.post.mockResolvedValueOnce({
                statusCode: 200,
                body: { data: [] }
            });

            const result = await fetchers.fetchJobTitles();

            // Should return default titles
            expect(result).toEqual(expect.arrayContaining(DEFAULT_JOB_TITLES));
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('No job titles found in API response')
            );
        });

        it('should handle API error by returning default titles', async () => {
            // Setup mock implementation for this test
            const actualFetchJobTitles = getActualImplementation('fetchJobTitles');
            fetchers.fetchJobTitles.mockImplementation(actualFetchJobTitles);
            
            // Mock API error
            got.post.mockRejectedValueOnce(new Error('Network error'));

            const result = await fetchers.fetchJobTitles();

            // Should return default titles
            expect(result).toEqual(expect.arrayContaining(DEFAULT_JOB_TITLES));
            
            // Should log error
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Failed to fetch job titles from external API')
            );
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Using default job titles')
            );
        });

        it('should handle malformed API response', async () => {
            // Setup mock implementation for this test
            const actualFetchJobTitles = getActualImplementation('fetchJobTitles');
            fetchers.fetchJobTitles.mockImplementation(actualFetchJobTitles);
            
            // Mock malformed response (missing data property)
            got.post.mockResolvedValueOnce({
                statusCode: 200,
                body: {}
            });

            const result = await fetchers.fetchJobTitles();

            // Should return default titles
            expect(result).toEqual(expect.arrayContaining(DEFAULT_JOB_TITLES));
        });
    });

    describe('fetchCompetitorList', () => {
        it('should fetch and return competitor list from API', async () => {
            // Setup mock implementation for this test
            const actualFetchCompetitorList = getActualImplementation('fetchCompetitorList');
            fetchers.fetchCompetitorList.mockImplementation(actualFetchCompetitorList);
            
            // Mock successful API response
            got.post.mockResolvedValueOnce({
                statusCode: 200,
                body: {
                    data: mockCompanies
                }
            });

            const result = await fetchers.fetchCompetitorList();

            // Verify API was called with correct parameters
            expect(got.post).toHaveBeenCalledWith(
                expect.stringContaining('/tables/ac27bdbc-b564-429e-815d-356d58b00d06/data/external'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': expect.stringContaining('Bearer'),
                        'Content-Type': 'application/json'
                    }),
                    json: {
                        requestPageDetails: {
                            pageNumber: 1,
                            pageSize: 500
                        }
                    },
                    responseType: 'json',
                    timeout: 10000
                })
            );

            // Should return an array of company names
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(3);
            expect(result).toContain('Acme Inc');
            expect(result).toContain('Globex Corp');
            expect(result).toContain('Initech');

            // Should log success
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Fetched 3 companies from external API')
            );
        });

        it('should handle empty API response by returning default companies', async () => {
            // Setup mock implementation for this test
            const actualFetchCompetitorList = getActualImplementation('fetchCompetitorList');
            fetchers.fetchCompetitorList.mockImplementation(actualFetchCompetitorList);
            
            // Mock empty response
            got.post.mockResolvedValueOnce({
                statusCode: 200,
                body: { data: [] }
            });

            const result = await fetchers.fetchCompetitorList();

            // Should return default companies
            expect(result).toEqual(expect.arrayContaining(DEFAULT_EXCLUDED_COMPANIES));
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('No companies found in API response')
            );
        });

        it('should handle API error by returning default companies', async () => {
            // Setup mock implementation for this test
            const actualFetchCompetitorList = getActualImplementation('fetchCompetitorList');
            fetchers.fetchCompetitorList.mockImplementation(actualFetchCompetitorList);
            
            // Mock API error
            got.post.mockRejectedValueOnce(new Error('Network error'));

            const result = await fetchers.fetchCompetitorList();

            // Should return default companies
            expect(result).toEqual(expect.arrayContaining(DEFAULT_EXCLUDED_COMPANIES));
            
            // Should log error
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Failed to fetch competitor list from external API')
            );
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Using default excluded companies')
            );
        });

        it('should handle malformed API response', async () => {
            // Setup mock implementation for this test
            const actualFetchCompetitorList = getActualImplementation('fetchCompetitorList');
            fetchers.fetchCompetitorList.mockImplementation(actualFetchCompetitorList);
            
            // Mock malformed response (missing data property)
            got.post.mockResolvedValueOnce({
                statusCode: 200,
                body: {}
            });

            const result = await fetchers.fetchCompetitorList();

            // Should return default companies
            expect(result).toEqual(expect.arrayContaining(DEFAULT_EXCLUDED_COMPANIES));
        });

        it('should handle duplicate company names', async () => {
            // Setup mock implementation for this test
            const actualFetchCompetitorList = getActualImplementation('fetchCompetitorList');
            fetchers.fetchCompetitorList.mockImplementation(actualFetchCompetitorList);
            
            // Mock response with duplicate company names
            const duplicateCompanies = [
                { company: 'Acme Inc' },
                { company: 'Acme Inc' }, // Duplicate
                { companyName: 'Acme Inc' } // Also duplicate, different field
            ];
            
            got.post.mockResolvedValueOnce({
                statusCode: 200,
                body: { data: duplicateCompanies }
            });

            const result = await fetchers.fetchCompetitorList();

            // Should deduplicate company names
            expect(result).toHaveLength(1);
            expect(result).toContain('Acme Inc');
        });
    });

    describe('fetchLocations', () => {
        it('should fetch and return locations from API', async () => {
            // Setup mock implementation for this test
            const actualFetchLocations = getActualImplementation('fetchLocations');
            fetchers.fetchLocations.mockImplementation(actualFetchLocations);
            
            // Mock successful API response
            got.post.mockResolvedValueOnce({
                statusCode: 200,
                body: { data: mockLocations }
            });

            const result = await fetchers.fetchLocations();

            // Verify API was called with correct parameters
            expect(got.post).toHaveBeenCalledWith(
                expect.stringContaining('/workbooks/6122189a-764f-40a9-9721-d756b7dd3626/data/external'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': expect.stringContaining('Bearer'),
                        'Content-Type': 'application/json'
                    }),
                    json: {
                        requestPageDetails: {
                            pageNumber: 1,
                            pageSize: 500
                        }
                    },
                    responseType: 'json',
                    timeout: 10000,
                    throwHttpErrors: false
                })
            );

            // Should return an array of locations
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(4);
            expect(result).toContain('New York');
            expect(result).toContain('San Francisco');
            expect(result).toContain('Remote');
            expect(result).toContain('London');

            // Should log success
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Fetched 4 locations from external API')
            );
        });

        it('should handle empty API response by returning default locations', async () => {
            // Setup mock implementation for this test
            const actualFetchLocations = getActualImplementation('fetchLocations');
            fetchers.fetchLocations.mockImplementation(actualFetchLocations);
            
            // Mock empty response
            got.post.mockResolvedValueOnce({
                statusCode: 200,
                body: { data: [] }
            });

            const result = await fetchers.fetchLocations();

            // Should return default locations
            expect(result).toEqual(expect.arrayContaining(DEFAULT_LOCATIONS));
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('No locations found in API response')
            );
        });

        it('should handle API error by returning default locations', async () => {
            // Setup mock implementation for this test
            const actualFetchLocations = getActualImplementation('fetchLocations');
            fetchers.fetchLocations.mockImplementation(actualFetchLocations);
            
            // Mock API error
            got.post.mockRejectedValueOnce(new Error('Network error'));

            const result = await fetchers.fetchLocations();

            // Should return default locations
            expect(result).toEqual(expect.arrayContaining(DEFAULT_LOCATIONS));
            
            // Should log error
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Failed to fetch locations from external API')
            );
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Using default locations')
            );
        });

        it('should handle HTTP error status codes', async () => {
            // Setup mock implementation for this test
            const actualFetchLocations = getActualImplementation('fetchLocations');
            fetchers.fetchLocations.mockImplementation(actualFetchLocations);
            
            // Mock HTTP error response
            got.post.mockResolvedValueOnce({
                statusCode: 404,
                statusMessage: 'Not Found'
            });

            const result = await fetchers.fetchLocations();

            // Should return default locations
            expect(result).toEqual(expect.arrayContaining(DEFAULT_LOCATIONS));
            
            // Should log error
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Failed to fetch locations from external API')
            );
        });

        it('should handle malformed API response', async () => {
            // Setup mock implementation for this test
            const actualFetchLocations = getActualImplementation('fetchLocations');
            fetchers.fetchLocations.mockImplementation(actualFetchLocations);
            
            // Mock malformed response (missing data property)
            got.post.mockResolvedValueOnce({
                statusCode: 200,
                body: {}
            });

            const result = await fetchers.fetchLocations();

            // Should return default locations
            expect(result).toEqual(expect.arrayContaining(DEFAULT_LOCATIONS));
        });

        it('should remove duplicate locations', async () => {
            // Setup mock implementation for this test
            const actualFetchLocations = getActualImplementation('fetchLocations');
            fetchers.fetchLocations.mockImplementation(actualFetchLocations);
            
            // Mock response with duplicate locations
            const duplicateLocations = [
                { location: 'New York' },
                { city: 'New York' }, // Duplicate
                { name: 'New York' },  // Also duplicate
                { title: 'London' },
                { location: 'London' } // Duplicate
            ];
            
            got.post.mockResolvedValueOnce({
                statusCode: 200,
                body: { data: duplicateLocations }
            });

            const result = await fetchers.fetchLocations();

            // Should deduplicate locations
            expect(result).toHaveLength(2);
            expect(result).toContain('New York');
            expect(result).toContain('London');
        });

        it('should handle various location field names', async () => {
            // Setup mock implementation for this test
            const actualFetchLocations = getActualImplementation('fetchLocations');
            fetchers.fetchLocations.mockImplementation(actualFetchLocations);
            
            // Mock response with different field names
            const locationsWithDifferentFields = [
                { location: 'New York' },
                { city: 'San Francisco' },
                { name: 'Remote' },
                { title: 'London' },
                { address: 'Paris' } // Should be ignored (not a recognized field)
            ];
            
            got.post.mockResolvedValueOnce({
                statusCode: 200,
                body: { data: locationsWithDifferentFields }
            });

            const result = await fetchers.fetchLocations();

            // Should only include recognized fields
            expect(result).toHaveLength(4);
            expect(result).toContain('New York');
            expect(result).toContain('San Francisco');
            expect(result).toContain('Remote');
            expect(result).toContain('London');
            expect(result).not.toContain('Paris');
        });

        it('should trim whitespace from location names', async () => {
            // Setup mock implementation for this test
            const actualFetchLocations = getActualImplementation('fetchLocations');
            fetchers.fetchLocations.mockImplementation(actualFetchLocations);
            
            // Mock response with locations with extra whitespace
            const locationsWithWhitespace = [
                { location: '  New York  ' },
                { city: '  San Francisco  ' },
                { name: '  Remote  ' }
            ];
            
            got.post.mockResolvedValueOnce({
                statusCode: 200,
                body: { data: locationsWithWhitespace }
            });

            const result = await fetchers.fetchLocations();

            // Should trim whitespace from location names
            expect(result).toContain('New York');
            expect(result).toContain('San Francisco');
            expect(result).toContain('Remote');
            
            // Should not contain the original strings with whitespace
            expect(result).not.toContain('  New York  ');
            expect(result).not.toContain('  San Francisco  ');
            expect(result).not.toContain('  Remote  ');
        });
    });
});
