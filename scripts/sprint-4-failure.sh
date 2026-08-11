#!/usr/bin/env bash

set -euo pipefail

WORKER_URL="${WORKER_URL:-http://localhost:3005}"
HOLDS_URL="${HOLDS_URL:-http://localhost:3004}"
RUN_ID="$(date +%s)"

restore_worker() {
  curl -fsS -X POST \
    "$WORKER_URL/fault/none" >/dev/null || true
}

trap restore_worker EXIT

echo "Stopping notification consumption..."
curl -fsS -X POST "$WORKER_URL/fault/crash"

echo
echo "Creating a hold while the worker is unavailable..."
curl -fsS -X POST "$HOLDS_URL/holds" \
  -H "Content-Type: application/json" \
  -d "{
    \"patronName\": \"Failure Test $RUN_ID\",
    \"bookTitle\": \"Dune $RUN_ID\",
    \"branch\": \"East\"
  }"

sleep 1

echo
echo "RabbitMQ queue state:"
docker compose exec -T rabbitmq \
  rabbitmqctl list_queues \
  name messages_ready messages_unacknowledged

echo
echo "Restoring notification processing..."
curl -fsS -X POST "$WORKER_URL/fault/none"

sleep 2

echo
echo "Producer and worker logs:"
docker compose logs --tail=30 \
  holds-service notification-worker