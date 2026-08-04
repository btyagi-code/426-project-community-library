# Sprint 3 Load Test Results

## Test setup

- Endpoint: `GET /availability?title=...`
- Entry point: Caddy load balancer
- Load: 10 looping virtual users for 30 seconds
- Gateway replicas: 3
- Cache: Redis
- Latency SLO: p95 below 700 ms
- Reliability SLO: at least 99% successful responses

## Results

| Metric | Result |
|---|---:|
| p50 latency | 5.96 ms |
| p95 latency | 293.03 ms |
| p99 latency | 413.16 ms |
| Request rate | 9.09 requests/second |
| HTTP success rate | 100.00% |
| HTTP error rate | 0.00% |
| Gateway usable-response rate | 100.00% |
| Check success rate | 100.00% | 
| Cache hit rate | 68.42% |
| Cache hits | 195 |
| Cache misses | 90 |
| Partial responses observed | 0 |

## SLO comparison

The `gateway-service` SLO defines two Sprint 3 commitments.

### Latency

The cross-branch availability endpoint must respond within 700 ms at p95.

- **Result:** 293.03 ms
- **Target:** Below 700 ms
- **Status:** MET

### Reliability

The endpoint must succeed at least 99% of the time. When one branch is unavailable, the gateway should return results from the remaining branches instead of failing the entire request.

- **HTTP success rate:** 100.00%
- **Usable gateway-response rate:** 100.00%
- **Target:** At least 99%
- **Status:** MET

No partial responses were observed during this run. The normal load test validates the numerical reliability target, but branch-failure behavior should also be tested separately by making one branch unavailable and confirming that the gateway still returns results from the remaining branches.

## Interpretation

The gateway met both Sprint 3 SLO commitments during this baseline run. The p95 latency remained below 700 ms, and at least 99% of requests returned usable responses. Redis reduced repeated work for frequently requested titles, while Caddy distributed requests across the gateway replicas. The slower requests are likely entirely from cache misses because those requests must call multiple branch catalogs and combine their responses. The Redis cache provides a significant benefit in our system's performance. The response duration for a cache hit is 7.01ms on average, whereas for a cache miss, the resulting response duration is an average of 220.86ms. Regardless, the average latencies along with the percentiles of requests experiencing cache hits or misses are well under our system's processing latency threshold of 700ms.


## Bottleneck and next steps

The overall system performance is great, with high performance, responsiveness, and low or none failed responses to incoming requests.
A possible bottleneck in the system is the cache-miss path. A cache miss requires the gateway to contact multiple branch catalogs and combine their responses. Cache hits avoid this work and should be faster.

Possible improvements:
- concurrent branch calls, branch-level timeouts, per-branch latency metrics
- retries with backoff, improved cache effectiveness
- cache-hit/miss counters (in Redis) by `INCR`ing a cache hit or miss key per request; gives a live hit-rate metric 
- a longer or popularity-weighted TTL
  - perhaps the current 5s TTL makes even popular titles re-pay the full miss cost frequently under sustained load; a longer TTL          for more popular titles (tracked via aforementioned `INCR` counters) can raise the hit rate without stalling out
    rarely-requested titles
