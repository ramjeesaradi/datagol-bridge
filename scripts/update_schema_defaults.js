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

// Import fetchers from src/fetchers.js
import { fetchJobTitles, fetchExcludedCompanies, fetchLocations } from '../src/fetchers.js';

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
async function applyDataToSchema({ jobTitles, excludedCompanies, locations }) {
  try {
    // Read the current schema
    const schema = await readSchema();
    
    // Update filter defaults
    if (jobTitles.length > 0) {
      setNestedProperty(schema, 'properties.jobTitles.default', jobTitles);
    }
    
    if (locations.length > 0) {
      setNestedProperty(schema, 'properties.locations.default', locations);
    }
    
    // Update excluded companies
    if (excludedCompanies.length > 0) {
      console.log('\nUpdating excludedCompanies...');
      setNestedProperty(schema, 'properties.excludedCompanies.default', excludedCompanies);
      console.log('✅ Successfully updated excludedCompanies');
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
    // Read the current schema to get table IDs
    const schema = await readSchema();

    const jobTitlesTableId = schema.properties.jobTitlesTableId.default;
    const excludedCompaniesTableId = schema.properties.excludedCompaniesTableId.default;
    const locationsTableId = schema.properties.locationsTableId.default;

    // Construct the datagolApi config object
    const datagolApiConfig = {
      baseUrl: process.env.DATAGOL_API_BASE_URL || 'https://be-eu.datagol.ai/noCo/api/v2',
      workspaceId: process.env.DATAGOL_WORKSPACE_ID,
      readToken: process.env.DATAGOL_READ_TOKEN,
      tables: {
        jobTitles: jobTitlesTableId,
        excludedCompanies: excludedCompaniesTableId,
        locations: locationsTableId,
      },
    };

    // Construct the main config object to pass to fetchers
    const config = {
      datagolApi: datagolApiConfig,
    };

    // Fetch data from DataGOL
    console.log('\nFetching data from DataGOL...');
    
    // Fetch all data in parallel using the constructed config
    const [jobTitles, excludedCompanies, locations] = await Promise.all([
      fetchJobTitles(config),
      fetchExcludedCompanies(config),
      fetchLocations(config)
    ]);
    
    console.log('\nFetched data:');
    console.log(`- Job Titles: ${jobTitles.length} items`);
    console.log(`- Excluded Companies: ${excludedCompanies.length} items`);
    console.log(`- Locations: ${locations.length} items`);
    
    // If we didn't get any data, don't update the schema
    if (jobTitles.length === 0 && excludedCompanies.length === 0 && locations.length === 0) {
      console.log('\n⚠️  No data was fetched from the API. The schema was not updated.');
      console.log('   Please check your API tokens and network connection.');
      process.exit(0);
    }
    
    await applyDataToSchema({ jobTitles, excludedCompanies, locations });
    
    console.log('\n✅ Done! The input schema has been updated with default values from DataGOL.');
  } catch (error) {
    console.error('\n❌ Error updating schema:', error.message);
    if (error.stderr) console.error('Error details:', error.stderr);
    process.exit(1);
  }
}

// Run the script
updateSchemaWithDefaults();
