#!/usr/bin/env bash
set -euo pipefail
ACTOR_NAME="datagol-bridge"
CRED_FILE=".apify_credentials"
[ -f "$CRED_FILE" ] && eval "$(grep -E 'APIFY_(USERNAME|API_TOKEN)' "$CRED_FILE")"

: "${APIFY_USERNAME:?Need Apify username}"
: "${APIFY_API_TOKEN:?Need Apify API token}"

log(){ printf '[%s] %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*"; }

login(){
  log "Logging in to Apify..."
  echo "$APIFY_API_TOKEN" | docker login registry.apify.com -u "$APIFY_USERNAME" --password-stdin \
    || die "Docker login failed"
}

build(){
  log "Building $ACTOR_NAME..."
  docker build -t "$ACTOR_NAME:$IMAGE_TAG" .
}

tag_and_push(){
  local IMAGE="registry.apify.com/$APIFY_USERNAME/$ACTOR_NAME:$IMAGE_TAG"
  log "Tagging $IMAGE"
  docker tag "$ACTOR_NAME:$IMAGE_TAG" "$IMAGE"
  log "Pushing $IMAGE"
  docker push "$IMAGE"
}

main(){
  IMAGE_TAG="${GITHUB_SHA:-$(date +'%Y%m%d%H%M%S')}"
  login
  build
  tag_and_push
  log "Deployment complete: $IMAGE"
}

main "$@"