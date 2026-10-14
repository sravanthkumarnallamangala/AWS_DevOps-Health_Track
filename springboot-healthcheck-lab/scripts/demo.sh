#!/usr/bin/env bash
# Walks through the health check scenario end to end.
# Usage: ./scripts/demo.sh   (run from the project root, Docker must be running)
set -euo pipefail

app_port=${APP_PORT:-8080}
base_url="http://localhost:${app_port}"

show() { docker ps --filter name=healthlab --format 'table {{.Names}}\t{{.Status}}'; }

wait_for_health() {
  expected=$1
  timeout=$2
  elapsed=0

  while [ "$elapsed" -lt "$timeout" ]; do
    state=$(docker inspect --format '{{.State.Health.Status}}' healthlab_app 2>/dev/null || echo starting)
    [ "$state" = "$expected" ] && return 0
    sleep 5
    elapsed=$((elapsed + 5))
  done

  echo "Timed out waiting for health status '$expected' (last status: $state)." >&2
  docker compose logs --no-color app db >&2
  return 1
}

echo "==> Starting stack"
docker compose up -d --build

echo "==> Waiting for app to become healthy (up to 2 min)"
wait_for_health healthy 120
show

echo; echo "==> Actuator health"
curl -fsS "${base_url}/actuator/health"; echo

echo; echo "==> Create and list a task"
curl -fsS -X POST "${base_url}/api/tasks" -H 'Content-Type: application/json' -d '{"title":"verify healthcheck"}'; echo
curl -fsS "${base_url}/api/tasks"; echo

echo; echo "==> Injecting fault (app keeps running but reports DOWN)"
curl -fsS -X POST "${base_url}/lab/fault"; echo
echo "==> Waiting for Docker to mark the app unhealthy (up to 75s)"
wait_for_health unhealthy 75
show
echo "Last probe output:"
docker inspect --format '{{range .State.Health.Log}}{{.ExitCode}} {{end}}' healthlab_app; echo

echo; echo "==> Clearing fault"
curl -fsS -X DELETE "${base_url}/lab/fault"; echo
echo "==> Waiting for Docker to mark the app healthy again (up to 60s)"
wait_for_health healthy 60
show
