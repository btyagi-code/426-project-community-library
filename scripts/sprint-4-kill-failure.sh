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

echo "Preparing to kill worker during job processing:"
curl -fsS -X POST "$WORKER_URL/fault/kill"
echo

echo
echo "Making a hold request:"
curl -X POST "$HOLDS_URL/holds" \
  -H "Content-Type: application/json" \
  -d "{
      \"patronName\":\"Kill Test [run id: $RUN_ID]\",
      \"bookTitle\":\"1984 [run id: $RUN_ID]\",
      \"branch\":\"North\"
  }"
echo

# sleep 

echo
# record duration of rabbitmqctl queue data retrieval
date +%s.%3N 
echo "RabbitMQ queue state (worker is killed mid-job and is restarted -> job remains enqueued):"
docker compose exec -T rabbitmq rabbitmqctl list_queues \
  name messages_ready messages_unacknowledged
date +%s.%3N
echo

sleep 2

echo
# record duration of rabbitmqctl queue data retrieval
date +%s.%3N
echo "RabbitMQ queue state (worker re-connected & re-signed to RabbitMQ as consumer -> worker processed job):"
docker compose exec -T rabbitmq rabbitmqctl list_queues \
  name messages_ready messages_unacknowledged
date +%s.%3N
echo

echo
echo "Producer and worker logs:"
docker compose logs --tail=30 \
  holds-service notification-worker