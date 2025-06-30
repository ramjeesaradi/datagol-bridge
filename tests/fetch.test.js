import { jest } from '@jest/globals';

// Mock the got module
const mockPost = jest.fn();
const mockGot = {
    post: mockPost,
};

// Mock the Apify Actor
const mockActor = {
    getInput: jest.fn().mockResolvedValue({}),
    pushData: jest.fn().mockResolvedValue(undefined),
    setValue: jest.fn().mockResolvedValue(undefined),
    getValue: jest.fn().mockResolvedValue(undefined),
    call: jest.fn().mockImplementation(() => {
        // Return a resolved promise with a default dataset ID
        return Promise.resolve({ defaultDatasetId: 'test-dataset-id' });
    }),
    getEnv: jest.fn().mockReturnValue({}),
    getConfig: jest.fn().mockReturnValue({}),
    isAtHome: jest.fn().mockReturnValue(false),
    createProxyConfiguration: jest.fn().mockResolvedValue({
        newUrl: jest.fn().mockReturnValue('http://proxy-url.com')
    }),
    newClient: jest.fn().mockReturnValue({
        dataset: jest.fn().mockReturnValue({
            pushData: jest.fn().mockResolvedValue(undefined),
            getData: jest.fn().mockResolvedValue({ items: [] })
        })
    })
};

// Mock the Apify module
jest.mock('apify', () => {
    const originalModule = jest.requireActual('apify');
    return {
        ...originalModule,
        Actor: {
            ...originalModule.Actor,
            main: (fn) => {
                // Don't execute the function, just return it for testing
                return fn;
            },
            getInput: mockActor.getInput,
            pushData: mockActor.pushData,
            setValue: mockActor.setValue,
            getValue: mockActor.getValue,
            call: mockActor.call,
            getEnv: mockActor.getEnv,
            getConfig: mockActor.getConfig,
            isAtHome: mockActor.isAtHome,
            createProxyConfiguration: mockActor.createProxyConfiguration,
            newClient: mockActor.newClient,
            // Add missing methods that might be needed
            on: jest.fn(),
            off: jest.fn(),
            fail: jest.fn(),
            exit: jest.fn(),
            addListener: jest.fn(),
            removeListener: jest.fn(),
            emit: jest.fn(),
            once: jest.fn(),
            prependListener: jest.fn(),
            prependOnceListener: jest.fn(),
            removeAllListeners: jest.fn(),
            setMaxListeners: jest.fn(),
            getMaxListeners: jest.fn(),
            listeners: jest.fn(),
            rawListeners: jest.fn(),
            eventNames: jest.fn(),
            listenerCount: jest.fn(),
            // Add other Actor methods as needed
        },
    };
});

// Mock the got module
jest.mock('got', () => ({
    post: mockPost,
}));

// Import the actual implementation to test
import { 
    fetchJobTitles, 
    fetchCompetitorList, 
    fetchLocations 
} from '../src/main.js';

// Import got to access the mock
import got from 'got';

// Mock the console to avoid test output pollution
const originalConsole = { ...console };
beforeAll(() => {
    global.console = {
        ...console,
        log: jest.fn(),
        error: jest.fn()
    };
});

afterAll(() => {
    global.console = originalConsole;
    jest.restoreAllMocks();
});

// Helper function to mock successful API response
const mockSuccessfulResponse = (data) => ({
    body: JSON.stringify({ data })
});

// Helper function to mock failed API response
const mockFailedResponse = () => {
    throw new Error('API Error');
};

describe('Fetch Functions', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        // Reset the mock implementation for each test
        got.post.mockReset();
        // Reset the mock implementation for console methods
        console.log.mockClear();
        console.error.mockClear();
    });

    describe('fetchJobTitles', () => {
        it('should fetch and return job titles', async () => {
            // Mock successful API response
            const mockData = [
                { title: 'Software Engineer' },
                { title: 'Data Scientist' },
                { title: 'Product Manager' }
            ];
            
            got.post.mockResolvedValueOnce(mockSuccessfulResponse(mockData));

            const result = await fetchJobTitles();
            
            // Verify the API was called with the correct parameters
            expect(got.post).toHaveBeenCalledWith(
                'https://be-eu.datagol.ai/noCo/api/v2/workspaces/8e894b95-cc40-44f0-88d7-4aae346b0325/tables/395a586f-2d3e-4489-a5d9-be0039f97aa1/data/external',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': expect.stringContaining('Bearer'),
                        'Content-Type': 'application/json'
                    }),
                    json: expect.objectContaining({
                        requestPageDetails: {
                            pageNumber: 1,
                            pageSize: 500
                        }
                    })
                })
            );
            
            // Check that the function returns an array with the expected titles
            expect(Array.isArray(result)).toBe(true);
            expect(result).toContain('Software Engineer');
            expect(result).toContain('Data Scientist');
            expect(result).toContain('Product Manager');
            
            // Verify the success log message
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Fetched 3 job titles from external API'));
        });

        it('should return default titles on error', async () => {
            // Mock failed API response
            got.post.mockRejectedValueOnce(mockFailedResponse());
            
            const result = await fetchJobTitles();
            
            // Should have called console.log with error message
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch job titles'));
            
            // Should return default titles (array with at least one item)
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            
            // Should log that we're using default titles
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Using default job titles'));
        });
    });

    describe('fetchCompetitorList', () => {
        it('should fetch and return competitor list', async () => {
            // Mock successful API response
            const mockData = [
                { company: 'Company A' },
                { company: 'Company B' },
                { company: 'Company C' }
            ];
            
            got.post.mockResolvedValueOnce(mockSuccessfulResponse(mockData));

            const result = await fetchCompetitorList();
            
            // Verify the API was called with the correct parameters
            expect(got.post).toHaveBeenCalledWith(
                'https://be-eu.datagol.ai/noCo/api/v2/workspaces/8e894b95-cc40-44f0-88d7-4aae346b0325/tables/ac27bdbc-b564-429e-815d-356d58b00d06/data/external',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': expect.stringContaining('Bearer'),
                        'Content-Type': 'application/json'
                    }),
                    json: expect.objectContaining({
                        requestPageDetails: {
                            pageNumber: 1,
                            pageSize: 500
                        }
                    })
                })
            );
            
            // Check that the function returns an array with the expected companies
            expect(Array.isArray(result)).toBe(true);
            expect(result).toContain('Company A');
            expect(result).toContain('Company B');
            expect(result).toContain('Company C');
            
            // Verify the success log message
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Fetched 3 companies from external API'));
        });
        
        it('should return default excluded companies on error', async () => {
            // Mock failed API response
            got.post.mockRejectedValueOnce(mockFailedResponse());
            
            const result = await fetchCompetitorList();
            
            // Should have called console.log with error message
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch competitor list'));
            
            // Should return default excluded companies (array with at least one item)
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            
            // Should log that we're using default excluded companies
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Using default excluded companies'));
        });
    });

    describe('fetchLocations', () => {
        it('should fetch and return locations', async () => {
            // Mock successful API response
            const mockData = [
                { location: 'New York' },
                { city: 'London' },
                { name: 'Paris' },
                { title: 'Berlin' }
            ];
            
            got.post.mockResolvedValueOnce({
                statusCode: 200,
                body: { data: mockData }
            });

            const result = await fetchLocations();
            
            // Verify the API was called with the correct parameters
            expect(got.post).toHaveBeenCalledWith(
                'https://be-eu.datagol.ai/noCo/api/v2/workspaces/8e894b95-cc40-44f0-88d7-4aae346b0325/workbooks/6122189a-764f-40a9-9721-d756b7dd3626/data/external',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': expect.stringContaining('Bearer'),
                        'Content-Type': 'application/json'
                    }),
                    json: expect.objectContaining({
                        requestPageDetails: {
                            pageNumber: 1,
                            pageSize: 500
                        }
                    })
                })
            );
            
            // Check that the function returns an array with the expected locations
            expect(Array.isArray(result)).toBe(true);
            expect(result).toContain('New York');
            expect(result).toContain('London');
            expect(result).toContain('Paris');
            expect(result).toContain('Berlin');
            
            // Verify the success log message
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Fetched 4 locations from external API'));
        });

        it('should remove duplicate locations', async () => {
            // Mock response with duplicate locations
            const mockData = [
                { location: 'New York' },
                { city: 'New York' },
                { name: 'London' }
            ];
            
            got.post.mockResolvedValueOnce({
                statusCode: 200,
                body: { data: mockData }
            });

            const result = await fetchLocations();
            
            // Should only contain unique locations
            expect(result).toHaveLength(2);
            expect(result).toContain('New York');
            expect(result).toContain('London');
        });

        it('should handle API errors gracefully', async () => {
            // Mock failed API response
            got.post.mockRejectedValueOnce(mockFailedResponse());
            
            const result = await fetchLocations();
            
            // Should have called console.log with error message
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch locations'));
            
            // Should return default locations (array with at least one item)
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            
            // Should log that we're using default locations
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Using default locations'));
        });
    });
});
