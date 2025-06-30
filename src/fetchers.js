import got from 'got';

// Default values for fallback
const DEFAULT_JOB_TITLES = [
    'Financial controller',
    'Business controller',
    'Financial analyst',
    'FP&A'
];

const DEFAULT_EXCLUDED_COMPANIES = [
    'Deloitte',
    'PwC',
    'EY',
    'KPMG',
    'Accenture',
    'Deloitte Belgium',
    'PwC Belgium',
    'EY Belgium',
    'KPMG Belgium',
    'Accenture Belgium'
];

const DEFAULT_LOCATIONS = [
    'Brussels',
    'Antwerp',
    'Ghent',
    'Bruges',
    'Leuven',
    'Mechelen',
    'Namur',
    'Charleroi',
    'Liège',
    'Mons',
    'Arlon'
];

// Helper function to log messages
const log = (message) => console.log(`[fetchers] ${message}`);

/**
 * Fetches job titles from the external API
 * @returns {Promise<string[]>} Array of job titles
 */
export const fetchJobTitles = async () => {
    try {
        log('Fetching job titles from external API...');
        const response = await got.post(
            'https://be-eu.datagol.ai/noCo/api/v2/workspaces/8e894b95-cc40-44f0-88d7-4aae346b0325/tables/395a586f-2d3e-4489-a5d9-be0039f97aa1/data/external',
            {
                headers: {
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjYzMxYjU5Mi1iY2Y0LTRlYzgtOGM5OS1iNGY0ZTRhYzY4YjEiLCJlbWFpbCI6InJhbWFuQGpvaG5zb25wYXJ0bmVycy5iZSIsImZ1bGxOYW1lIjoiUmFtYW51amEgUmFvIEtvdGFwcm9sdSIsImlhdCI6MTcxNDQ4MjYyOCwiZXhwIjoxNzQ2MDE4NjI4fQ.0zLh9QjCJ2k2jJZQJQJQJQJQJQJQJQJQJQJQJQJQJQ',
                    'Content-Type': 'application/json'
                },
                json: {
                    requestPageDetails: {
                        pageNumber: 1,
                        pageSize: 500
                    }
                },
                responseType: 'json',
                timeout: 10000
            }
        );

        // Extract job titles from the response
        const jobTitles = response.body.data.map(item => item.title || item.name || item.jobTitle).filter(Boolean);
        
        if (jobTitles.length === 0) {
            log('No job titles found in API response, using defaults');
            return DEFAULT_JOB_TITLES;
        }
        
        log(`✅ Fetched ${jobTitles.length} job titles from external API`);
        return jobTitles;
    } catch (error) {
        log(`❌ Failed to fetch job titles from external API: ${error.message}`);
        log('📋 Using default job titles');
        return DEFAULT_JOB_TITLES;
    }
};

/**
 * Fetches the competitor list from the external API
 * @returns {Promise<string[]>} Array of company names to exclude
 */
export const fetchCompetitorList = async () => {
    try {
        log('Fetching competitor list from external API...');
        const response = await got.post(
            'https://be-eu.datagol.ai/noCo/api/v2/workspaces/8e894b95-cc40-44f0-88d7-4aae346b0325/tables/ac27bdbc-b564-429e-815d-356d58b00d06/data/external',
            {
                headers: {
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjYzMxYjU5Mi1iY2Y0LTRlYzgtOGM5OS1iNGY0ZTRhYzY4YjEiLCJlbWFpbCI6InJhbWFuQGpvaG5zb25wYXJ0bmVycy5iZSIsImZ1bGxOYW1lIjoiUmFtYW51amEgUmFvIEtvdGFwcm9sdSIsImlhdCI6MTcxNDQ4MjYyOCwiZXhwIjoxNzQ2MDE4NjI4fQ.0zLh9QjCJ2k2jJZQJQJQJQJQJQJQJQJQJQJQJQJQJQ',
                    'Content-Type': 'application/json'
                },
                json: {
                    requestPageDetails: {
                        pageNumber: 1,
                        pageSize: 500
                    }
                },
                responseType: 'json',
                timeout: 10000
            }
        );

        // Extract company names from the response
        const companies = response.body.data
            .map(item => item.company || item.name || item.companyName)
            .filter(Boolean)
            .map(company => company.trim());
        
        if (companies.length === 0) {
            log('No companies found in API response, using defaults');
            return DEFAULT_EXCLUDED_COMPANIES;
        }
        
        log(`✅ Fetched ${companies.length} companies from external API`);
        return companies;
    } catch (error) {
        log(`❌ Failed to fetch competitor list from external API: ${error.message}`);
        log('📋 Using default excluded companies');
        return DEFAULT_EXCLUDED_COMPANIES;
    }
};

/**
 * Fetches locations from the external API
 * @returns {Promise<string[]>} Array of location names
 */
export const fetchLocations = async () => {
    try {
        log('Fetching locations from external API...');
        const response = await got.post(
            'https://be-eu.datagol.ai/noCo/api/v2/workspaces/8e894b95-cc40-44f0-88d7-4aae346b0325/workbooks/6122189a-764f-40a9-9721-d756b7dd3626/data/external',
            {
                headers: {
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjYzMxYjU5Mi1iY2Y0LTRlYzgtOGM5OS1iNGY0ZTRhYzY4YjEiLCJlbWFpbCI6InJhbWFuQGpvaG5zb25wYXJ0bmVycy5iZSIsImZ1bGxOYW1lIjoiUmFtYW51amEgUmFvIEtvdGFwcm9sdSIsImlhdCI6MTcxNDQ4MjYyOCwiZXhwIjoxNzQ2MDE4NjI4fQ.0zLh9QjCJ2k2jJZQJQJQJQJQJQJQJQJQJQJQJQJQJQ',
                    'Content-Type': 'application/json'
                },
                json: {
                    requestPageDetails: {
                        pageNumber: 1,
                        pageSize: 500
                    }
                },
                responseType: 'json',
                timeout: 10000
            }
        );

        // Extract location names from the response, handling different possible field names
        const locations = [];
        const seen = new Set();
        
        response.body.data.forEach(item => {
            const location = item.location || item.city || item.name || item.title;
            if (location && typeof location === 'string' && !seen.has(location.trim())) {
                seen.add(location.trim());
                locations.push(location.trim());
            }
        });
        
        if (locations.length === 0) {
            log('No locations found in API response, using defaults');
            return DEFAULT_LOCATIONS;
        }
        
        log(`✅ Fetched ${locations.length} locations from external API`);
        return locations;
    } catch (error) {
        log(`❌ Failed to fetch locations from external API: ${error.message}`);
        log('📋 Using default locations');
        return DEFAULT_LOCATIONS;
    }
};

/**
 * Fetches all data in parallel
 * @returns {Promise<{jobTitles: string[], excludedCompanies: string[], locations: string[]}>}
 */
export const fetchAllData = async () => {
    const [jobTitles, excludedCompanies, locations] = await Promise.all([
        fetchJobTitles(),
        fetchCompetitorList(),
        fetchLocations()
    ]);
    
    return { jobTitles, excludedCompanies, locations };
};

export default {
    fetchJobTitles,
    fetchCompetitorList,
    fetchLocations,
    fetchAllData,
    // Export defaults for testing
    DEFAULT_JOB_TITLES,
    DEFAULT_EXCLUDED_COMPANIES,
    DEFAULT_LOCATIONS
};
