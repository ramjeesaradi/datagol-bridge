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

# Source credentials if available
CRED_FILE=".apify_credentials"
if [ -f "$CRED_FILE" ]; then
    log "Loading credentials from $CRED_FILE"
    # Use 'export' to make the variable available to subprocesses
    export "$(grep -E 'APIFY_API_TOKEN' "$CRED_FILE")"
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

log "Deploying actor to Apify platform..."

# Push the actor. This will upload the source code and build the Docker image on Apify cloud.
apify push || die "Failed to push actor to Apify."

log "Actor deployed successfully!"

log "Running the actor on the Apify platform..."
apify call "$ACTOR_NAME" || die "Failed to run actor."

log "Actor run finished successfully!"