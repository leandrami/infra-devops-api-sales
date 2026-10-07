#!/usr/bin/env bash
# Dispara N exportações pesadas em paralelo para exercitar limites de recurso e HPA.
URL=${1:-http://localhost:3000}
N=${2:-20}
RECORDS=${RECORDS:-500000}
for i in $(seq "$N"); do
  curl -s -o /dev/null -m 120 -w "req $i -> HTTP %{http_code} em %{time_total}s\n" \
    -X POST "$URL/tickets/export" -H "Content-Type: application/json" -d "{\"records\": $RECORDS}" &
done
wait
