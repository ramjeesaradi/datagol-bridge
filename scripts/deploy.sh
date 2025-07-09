#!/usr/bin/env bash
set -euo pipefail

# This script deploys the Apify actor using the 'apify push' command,
# which is the recommended method for deploying actors to the Apify platform.
# It handles building the Docker image in the cloud.

log() { printf '[%s] %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*"; }
die() { log "FATAL: $*"; exit 1; }

# Check if Apify CLI is installed
if ! command -v apify &> /dev/null; then
    die "Apify CLI not found. Please install it first: https://docs.apify.com/cli/docs/installation"
fi

# Check if .env file exists
if [ ! -f .env ]; then
    die ".env file not found. Please create it and add your APIFY_TOKEN."
fi

# Source the APIFY_TOKEN from the .env file
log "Sourcing APIFY_TOKEN from .env file..."
APIFY_TOKEN=$(grep APIFY_TOKEN .env | cut -d '=' -f2)

if [ -z "$APIFY_TOKEN" ]; then
    die "APIFY_TOKEN not found in .env file."
fi

log "Deploying actor to Apify platform..."

# Push the actor. This will upload the source code and build the Docker image on Apify cloud.
apify push --no-prompt --force || die "Failed to push actor to Apify."

log "Running the actor on the Apify platform..."
# Run the actor and capture the run ID
log "Running the actor on the Apify platform..."
RUN_OUTPUT=$(apify call --json || die "Failed to call actor on Apify.")
RUN_ID=$(echo "$RUN_OUTPUT" | jq -r '.id')

if [ -z "$RUN_ID" ]; then
    die "Failed to get run ID from apify call output."
fi

log "Actor run started with ID: $RUN_ID"

# Create logs directory if it doesn't exist
mkdir -p logs

# Fetch and save logs
log "Fetching logs for run $RUN_ID..."
apify get log "$RUN_ID" > "logs/apify_run_${RUN_ID}.log" || log "Warning: Failed to fetch logs for run $RUN_ID."

log "Logs saved to logs/apify_run_${RUN_ID}.log"

log "Actor deployed and run successfully!"

log "Actor deployed successfully!"
