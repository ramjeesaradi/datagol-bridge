#!/usr/bin/env bash
set -euo pipefail

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
    # Source the file to load the variables
    . "$CRED_FILE"
fi

# The Apify CLI automatically uses the APIFY_TOKEN environment variable for authentication.
# We export it here to ensure it's available to the apify command.
if [ -n "${APIFY_API_TOKEN:-}" ]; then
    export APIFY_TOKEN="$APIFY_API_TOKEN"
fi

log "Deploying actor to Apify platform..."

# Push the actor. This will upload the source code and trigger a build on the Apify platform.
apify push || die "Failed to push actor to Apify."

log "Actor deployed successfully!"