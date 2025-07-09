#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Source environment variables from .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
  echo "Environment variables sourced from .env"
else
  echo "Error: .env file not found! Please create one with your APIFY_TOKEN, DATAGOL_WORKSPACE_ID, and DATAGOL_WRITE_TOKEN."
  exit 1
fi

echo "Running Apify actor locally..."
# Run the actor locally. The --purge flag ensures a clean run each time.
apify run --purge
