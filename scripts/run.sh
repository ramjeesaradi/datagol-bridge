#!/usr/bin/env bash
set -euo pipefail

# This script runs the latest version of the actor on the Apify platform.
# It does NOT rebuild or deploy the actor. Use deploy.sh for that.

log() { printf '[%s] %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*"; }
die() { log "FATAL: $*"; exit 1; }

# Check if Apify CLI is installed
if ! command -v apify &> /dev/null; then
    die "Apify CLI not found. Please install it first: https://docs.apify.com/cli/docs/installation"
fi

# Source environment variables from .env file
if [ -f .env ]; then
    log "Loading environment variables from .env file"
    export $(grep -v '^#' .env | xargs)
else
    die ".env file not found. Please create one with the necessary environment variables."
fi

# Check if the user is logged in to Apify, or log in with a token
if ! apify whoami &> /dev/null; then
    if [ -n "${APIFY_API_TOKEN:-}" ]; then
        log "Not logged in. Logging in with API token..."
        apify login --token "$APIFY_API_TOKEN" || die "Apify login failed."
    else
        log "You are not logged in to Apify and no API token is available."
        log "Please run 'apify login' interactively first."
        die "Cannot proceed without login."
    fi
fi

log "Running the actor on the Apify platform..."

# Call the actor and wait for it to finish
apify call --wait-for-finish || die "Failed to run actor."

log "Actor run finished successfully!"
