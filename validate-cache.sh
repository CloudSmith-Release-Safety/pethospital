#!/bin/bash

# Cache validation script
# This script validates the cache layer health before deployment

set -e

# Configuration
CACHE_ENDPOINT="${1:-$CACHE_ENDPOINT}"
TIMEOUT="${2:-5}"
RETRIES="${3:-3}"
MIN_HIT_RATE="${4:-70}"
MAX_LATENCY="${5:-50}"

if [ -z "$CACHE_ENDPOINT" ]; then
  echo "Error: Cache endpoint not provided"
  echo "Usage: $0 <cache_endpoint> [timeout] [retries] [min_hit_rate] [max_latency]"
  exit 1
fi

echo "Validating cache layer at $CACHE_ENDPOINT"
echo "Timeout: ${TIMEOUT}s, Retries: $RETRIES, Min Hit Rate: $MIN_HIT_RATE%, Max Latency: ${MAX_LATENCY}ms"

# Check cache health endpoint
echo "Checking cache health endpoint..."
for i in $(seq 1 $RETRIES); do
  echo "Attempt $i of $RETRIES"
  HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -m $TIMEOUT "$CACHE_ENDPOINT/health")
  
  if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Cache health check passed"
    break
  else
    echo "❌ Cache health check failed with status $HEALTH_STATUS"
    if [ "$i" -eq "$RETRIES" ]; then
      echo "Error: Cache health check failed after $RETRIES attempts"
      exit 1
    fi
    sleep 2
  fi
done

# Check cache hit rate
echo "Checking cache hit rate..."
HIT_RATE=$(curl -s -m $TIMEOUT "$CACHE_ENDPOINT/metrics" | grep -oP 'hit_rate=\K[0-9]+(\.[0-9]+)?')

if [ -z "$HIT_RATE" ]; then
  echo "Error: Could not retrieve hit rate metric"
  exit 1
fi

if (( $(echo "$HIT_RATE < $MIN_HIT_RATE" | bc -l) )); then
  echo "❌ Cache hit rate too low: $HIT_RATE% (minimum: $MIN_HIT_RATE%)"
  exit 1
else
  echo "✅ Cache hit rate acceptable: $HIT_RATE%"
fi

# Check cache latency
echo "Checking cache latency..."
LATENCY=$(curl -s -m $TIMEOUT "$CACHE_ENDPOINT/metrics" | grep -oP 'latency_ms=\K[0-9]+(\.[0-9]+)?')

if [ -z "$LATENCY" ]; then
  echo "Error: Could not retrieve latency metric"
  exit 1
fi

if (( $(echo "$LATENCY > $MAX_LATENCY" | bc -l) )); then
  echo "❌ Cache latency too high: ${LATENCY}ms (maximum: ${MAX_LATENCY}ms)"
  exit 1
else
  echo "✅ Cache latency acceptable: ${LATENCY}ms"
fi

# Check cache eviction rate
echo "Checking cache eviction rate..."
EVICTION_RATE=$(curl -s -m $TIMEOUT "$CACHE_ENDPOINT/metrics" | grep -oP 'eviction_rate=\K[0-9]+(\.[0-9]+)?')

if [ -z "$EVICTION_RATE" ]; then
  echo "Error: Could not retrieve eviction rate metric"
  exit 1
fi

if (( $(echo "$EVICTION_RATE > 100" | bc -l) )); then
  echo "❌ Cache eviction rate too high: $EVICTION_RATE/min (maximum: 100/min)"
  exit 1
else
  echo "✅ Cache eviction rate acceptable: $EVICTION_RATE/min"
fi

# Check fallback mechanism
echo "Testing cache fallback mechanism..."
FALLBACK_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -m $TIMEOUT "$CACHE_ENDPOINT/fallback/test")

if [ "$FALLBACK_STATUS" = "200" ]; then
  echo "✅ Cache fallback mechanism working correctly"
else
  echo "❌ Cache fallback mechanism failed with status $FALLBACK_STATUS"
  exit 1
fi

echo "✅ All cache validation checks passed"
exit 0