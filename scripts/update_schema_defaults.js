import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as fs from 'node:fs';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Get the current file and directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the input schema file
const SCHEMA_PATH = join(__dirname, '../.actor/input_schema.json');

// Helper function to execute shell commands
const execAsync = promisify(exec);

// API endpoints from filter_curl_info.txt
const API_ENDPOINTS = {
  jobTitles: {
    url: 'https://be-eu.datagol.ai/noCo/api/v2/workspaces/8e894b95-cc40-44f0-88d7-4aae346b0325/tables/395a586f-2d3e-4489-a5d9-be0039f97aa1/data/external',
    token: 'eyJhbGciOiJIUzUxMiJ9.eyJtZmFfc3RhdHVzIjoiTk9UX1JFUVVJUkVEIiwic3ViIjoiZGV2QGpoLnBhcnRuZXJzIiwicGVybWlzc2lvbnMiOlsiVklFV19EQVRBU09VUkNFIiwiVklFV19VU0VSUyIsIkNSRUFURV9DT1BJTE9UIiwiRURJVF9DT1BJTE9UIiwiREVMRVRFX0NPUElMT1QiLCJWSUVXX0NPUElMT1QiLCJFRElUX0xBS0VIT1VTRSIsIlZJRVdfQ09OTkVDVE9SUyIsIkNSRUFURV9QSVBFTElORSIsIkNSRUFURV9EQVRBU09VUkNFIiwiRURJVF9VU0VSUyIsIkVESVRfUElQRUxJTkUiLCJWSUVXX0FMRVJUUyIsIkVESVRfQ09OTkVDVE9SUyIsIkRFTEVURV9DT05ORUNUT1JTIiwiVklFV19QSVBFTElORSIsIkRFTEVURV9VU0VSUyIsIkVESVRfQ09NUEFOWSIsIlZJRVdfSk9CUyIsIkNSRUFURV9DT05ORUNUT1JTIiwiQ1JFQVRFX1VTRVJTIiwiRURJVF9EQVRBU09VUkNFIiwiREVMRVRFX0RBVEFTT1VSQ0UiLCJWSUVXX0xBS0VIT1VTRSIsIkNSRUFURV9MQUtFSE9VU0UiLCJERUxFVEVfTEFLRUhPVVNFIiwiREVMRVRFX1BJUEVMSU5FIiwiQVNTSUdOX1JPTEVTIl0sInJvbGVzIjpbIlVTRVIiLCJMQUtFSE9VU0VfQURNSU4iLCJDT05ORUNUT1JfQURNSU4iLCJDT1BJTE9USFVCX0FETUlOIiwiQUNDT1VOVF9BRE1JTiJdLCJleHAiOjE3NTIwMDkwMDQsImlhdCI6MTc1MTY0OTAwNH0.pv9zfQa2Ojk8aHVIMOynXzCdwGWExi82dPj5-cqsJ5sbSEeGvdxW01QFiL1lEYTx4xn_G14BxWALnH32aX5eaw'
  },
  competitors: {
    url: 'https://be-eu.datagol.ai/noCo/api/v2/workspaces/8e894b95-cc40-44f0-88d7-4aae346b0325/tables/ac27bdbc-b564-429e-815d-356d58b00d06/data/external',
    token: 'eyJhbGciOiJIUzUxMiJ9.eyJtZmFfc3RhdHVzIjoiTk9UX1JFUVVJUkVEIiwic3ViIjoiZGV2QGpoLnBhcnRuZXJzIiwicGVybWlzc2lvbnMiOlsiVklFV19EQVRBU09VUkNFIiwiVklFV19VU0VSUyIsIkNSRUFURV9DT1BJTE9UIiwiRURJVF9DT1BJTE9UIiwiREVMRVRFX0NPUElMT1QiLCJWSUVXX0NPUElMT1QiLCJFRElUX0xBS0VIT1VTRSIsIlZJRVdfQ09OTkVDVE9SUyIsIkNSRUFURV9QSVBFTElORSIsIkNSRUFURV9EQVRBU09VUkNFIiwiRURJVF9VU0VSUyIsIkVESVRfUElQRUxJTkUiLCJWSUVXX0FMRVJUUyIsIkVESVRfQ09OTkVDVE9SUyIsIkRFTEVURV9DT05ORUNUT1JTIiwiVklFV19QSVBFTElORSIsIkRFTEVURV9VU0VSUyIsIkVESVRfQ09NUEFOWSIsIlZJRVdfSk9CUyIsIkNSRUFURV9DT05ORUNUT1JTIiwiQ1JFQVRFX1VTRVJTIiwiRURJVF9EQVRBU09VUkNFIiwiREVMRVRFX0RBVEFTT1VSQ0UiLCJWSUVXX0xBS0VIT1VTRSIsIkNSRUFURV9MQUtFSE9VU0UiLCJERUxFVEVfTEFLRUhPVVNFIiwiREVMRVRFX1BJUEVMSU5FIiwiQVNTSUdOX1JPTEVTIl0sInJvbGVzIjpbIlVTRVIiLCJMQUtFSE9VU0VfQURNSU4iLCJDT05ORUNUT1JfQURNSU4iLCJDT1BJTE9USFVCX0FETUlOIiwiQUNDT1VOVF9BRE1JTiJdLCJleHAiOjE3NTIwMDkwMDQsImlhdCI6MTc1MTY0OTAwNH0.pv9zfQa2Ojk8aHVIMOynXzCdwGWExi82dPj5-cqsJ5sbSEeGvdxW01QFiL1lEYTx4xn_G14BxWALnH32aX5eaw'
  },
  locations: {
    url: 'https://be-eu.datagol.ai/noCo/api/v2/workspaces/8e894b95-cc40-44f0-88d7-4aae346b0325/tables/6122189a-764f-40a9-9721-d756b7dd3626/data/external',
    token: 'eyJhbGciOiJIUzUxMiJ9.eyJtZmFfc3RhdHVzIjoiTk9UX1JFUVVJUkVEIiwic3ViIjoiZGV2QGpoLnBhcnRuZXJzIiwicGVybWlzc2lvbnMiOlsiVklFV19EQVRBU09VUkNFIiwiVklFV19VU0VSUyIsIkNSRUFURV9DT1BJTE9UIiwiRURJVF9DT1BJTE9UIiwiREVMRVRFX0NPUElMT1QiLCJWSUVXX0NPUElMT1QiLCJFRElUX0xBS0VIT1VTRSIsIlZJRVdfQ09OTkVDVE9SUyIsIkNSRUFURV9QSVBFTElORSIsIkNSRUFURV9EQVRBU09VUkNFIiwiRURJVF9VU0VSUyIsIkVESVRfUElQRUxJTkUiLCJWSUVXX0FMRVJUUyIsIkVESVRfQ09OTkVDVE9SUyIsIkRFTEVURV9DT05ORUNUT1JTIiwiVklFV19QSVBFTElORSIsIkRFTEVURV9VU0VSUyIsIkVESVRfQ09NUEFOWSIsIlZJRVdfSk9CUyIsIkNSRUFURV9DT05ORUNUT1JTIiwiQ1JFQVRFX1VTRVJTIiwiRURJVF9EQVRBU09VUkNFIiwiREVMRVRFX0RBVEFTT1VSQ0UiLCJWSUVXX0xBS0VIT1VTRSIsIkNSRUFURV9MQUtFSE9VU0UiLCJERUxFVEVfTEFLRUhPVVNFIiwiREVMRVRFX1BJUEVMSU5FIiwiQVNTSUdOX1JPTEVTIl0sInJvbGVzIjpbIlVTRVIiLCJMQUtFSE9VU0VfQURNSU4iLCJDT05ORUNUT1JfQURNSU4iLCJDT1BJTE9USFVCX0FETUlOIiwiQUNDT1VOVF9BRE1JTiJdLCJleHAiOjE3NTIwMDkwMDQsImlhdCI6MTc1MTY0OTAwNH0.pv9zfQa2Ojk8aHVIMOynXzCdwGWExi82dPj5-cqsJ5sbSEeGvdxW01QFiL1lEYTx4xn_G14BxWALnH32aX5eaw'
  }
};

/**
 * Fetches data from a DataGOL table
 * @param {string} tableId - The ID of the table to fetch
 * @returns {Promise<Array>} - Array of items from the table
 */
async function fetchWithCurl(url, token) {
  const curlCommand = `curl -X POST "${url}" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"requestPageDetails":{"pageNumber":1,"pageSize":500}}'`;
  
  try {
    console.log('Executing curl command...');
    const { stdout, stderr } = await execAsync(curlCommand.trim());
    
    if (stderr) {
      console.error('Curl stderr:', stderr);
    }
    
    console.log('Curl response received');
    return JSON.parse(stdout || '{}');
  } catch (error) {
    console.error('Curl error:', error.message);
    if (error.stdout) console.error('Curl stdout:', error.stdout);
    if (error.stderr) console.error('Curl stderr:', error.stderr);
    throw error;
  }
}

async function fetchTableData(type) {
  const endpoint = API_ENDPOINTS[type];
  if (!endpoint) {
    console.error(`Unknown table type: ${type}`);
    return [];
  }
  
  try {
    console.log(`\n=== Fetching ${type} data ===`);
    console.log(`URL: ${endpoint.url}`);
    console.log(`Using token: ${endpoint.token.substring(0, 20)}...`);
    
    const data = await fetchWithCurl(endpoint.url, endpoint.token);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    // Extract the appropriate field based on the type
    const items = data?.data || [];
    let result = [];
    
    if (type === 'jobTitles') {
      result = items.map(item => item.title || '').filter(Boolean);
    } else if (type === 'competitors') {
      result = items.map(item => item.name || '').filter(Boolean);
    } else if (type === 'locations') {
      result = items.map(item => item.location || '').filter(Boolean);
    }
    
    console.log(`\u2705 Successfully fetched ${result.length} ${type}`);
    return result;
  } catch (error) {
    console.error(`\u274c Error fetching ${type}:`, error.message);
    return [];
  }
}

// Read the current schema
async function readSchema() {
  try {
    const content = await fs.promises.readFile(SCHEMA_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Error reading schema file:', error.message);
    process.exit(1);
  }
}

// Write the updated schema back to file
async function writeSchema(schema) {
  try {
    await fs.promises.writeFile(SCHEMA_PATH, JSON.stringify(schema, null, 2), 'utf8');
    console.log('\u2705 Successfully updated input schema with default values');
  } catch (error) {
    console.error('\u274c Error writing schema file:', error.message);
    process.exit(1);
  }
}

/**
 * Helper function to set a nested property using dot notation
 * @param {Object} obj - The object to update
 * @param {string} path - Dot notation path to the property
 * @param {*} value - The value to set
 */
function setNestedProperty(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key]) {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}

// Function to apply fetched data to schema
async function applyDataToSchema({ jobTitles, competitors, locations }) {
  try {
    // Read the current schema
    const schema = await readSchema();
    
    // Update filter defaults
    if (jobTitles.length > 0) {
      setNestedProperty(schema, 'properties.filters.jobTitles.default', jobTitles);
      setNestedProperty(schema, 'properties.jobTitles.default', jobTitles);
    }
    
    if (locations.length > 0) {
      setNestedProperty(schema, 'properties.filters.locations.default', locations);
      setNestedProperty(schema, 'properties.locations.default', locations);
    }
    
    // Update excluded companies with competitors list
    // This ensures job postings from competitors are excluded
    if (competitors.length > 0) {
      console.log('\nUpdating excludedCompanies with competitors list...');
      try {
        // Check if the path exists
        const filtersProp = schema.properties?.filters;
        const excludedCompaniesProp = filtersProp?.excludedCompanies;
        console.log('Filters property exists:', !!filtersProp);
        console.log('ExcludedCompanies property exists:', !!excludedCompaniesProp);
        
        // Update both properties
        setNestedProperty(schema, 'properties.filters.excludedCompanies.default', competitors);
        setNestedProperty(schema, 'properties.competitors.default', competitors);
        
        console.log('✅ Successfully updated excludedCompanies and competitors');
      } catch (error) {
        console.error('❌ Error updating excludedCompanies:', error.message);
      }
    }
    
    await writeSchema(schema);
    return true;
  } catch (error) {
    console.error('Error applying data to schema:', error.message);
    return false;
  }
}

// Main function to update schema with default values
async function updateSchemaWithDefaults() {
  try {
    // Fetch data from DataGOL
    console.log('\nFetching data from DataGOL...');
    
    // Fetch all data in parallel
    const [jobTitles, competitors, locations] = await Promise.all([
      fetchTableData('jobTitles'),
      fetchTableData('competitors'),
      fetchTableData('locations')
    ]);
    
    console.log('\nFetched data:');
    console.log(`- Job Titles: ${jobTitles.length} items`);
    console.log(`- Competitors: ${competitors.length} items`);
    console.log(`- Locations: ${locations.length} items`);
    
    // If we didn't get any data, don't update the schema
    if (jobTitles.length === 0 && competitors.length === 0 && locations.length === 0) {
      console.log('\n⚠️  No data was fetched from the API. The schema was not updated.');
      console.log('   Please check your API tokens and network connection.');
      process.exit(0);
    }
    
    await applyDataToSchema({ jobTitles, competitors, locations });
    
    console.log('\n✅ Done! The input schema has been updated with default values from DataGOL.');
  } catch (error) {
    console.error('\n❌ Error updating schema:', error.message);
    if (error.stderr) console.error('Error details:', error.stderr);
    process.exit(1);
  }
}

// Run the script
updateSchemaWithDefaults();
