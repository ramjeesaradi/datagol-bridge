#!/bin/bash

# This script sets up the necessary secrets for the Apify actor from a local .env file.

# --- Helper Functions ---
log() {
    echo "[$(date +'%Y-%m-%dT%H:%M:%SZ')] $1"
}

die() {
    log "FATAL: $1"
    exit 1
}

# --- Pre-flight Checks ---
# Check if Apify CLI is installed
if ! command -v apify &> /dev/null; then
    die "Apify CLI not found. Please install it first: https://docs.apify.com/cli/docs/installation"
fi




# Check if .env file exists
if [ ! -f .env ]; then
    die ".env file not found. Please create one with DATAGOL_WRITE_TOKEN and DATAGOL_WORKSPACE_ID."
fi

log "Reading secrets from .env file..."

# --- Read Secrets from .env ---
DATAGOL_WRITE_TOKEN=$(grep DATAGOL_WRITE_TOKEN .env | cut -d '=' -f2)
DATAGOL_WORKSPACE_ID=$(grep DATAGOL_WORKSPACE_ID .env | cut -d '=' -f2)
APIFY_TOKEN=$(grep APIFY_TOKEN .env | cut -d '=' -f2)


if [ -z "$DATAGOL_WRITE_TOKEN" ]; then
    die "DATAGOL_WRITE_TOKEN not found in .env file."
fi

if [ -z "$DATAGOL_WORKSPACE_ID" ]; then
    die "DATAGOL_WORKSPACE_ID not found in .env file."
fi

# --- Set Secrets in Apify ---
log "Setting secrets in Apify actor..."

# Remove existing secrets to avoid errors, ignore failures if they don't exist
apify secrets:rm datagolWriteToken >/dev/null 2>&1 || true
apify secrets:rm datagolWorkspaceId >/dev/null 2>&1 || true
apify secrets:rm apifyApiToken >/dev/null 2>&1 || true

log "Adding secrets..."
apify secrets:add datagolWriteToken "$DATAGOL_WRITE_TOKEN" || die "Failed to add datagolWriteToken secret."
apify secrets:add datagolWorkspaceId "$DATAGOL_WORKSPACE_ID" || die "Failed to add datagolWorkspaceId secret."
apify secrets:add apifyApiToken "$APIFY_TOKEN" || die "Failed to add apifyApiToken secret."

log "Secrets have been successfully set for the actor."
