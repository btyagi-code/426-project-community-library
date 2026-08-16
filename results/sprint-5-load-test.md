# Sprint 5 Load Test Results

## Test setup

The final Sprint 5 load test ran the main `gateway-service` `GET /availability?title=...` endpoint distributed by the Caddy load balancer. The test used 10 looping virtual users for 60 seconds across the three gateway replicas with Redis caching. The documented gateway SLO requires p95 latency below 700 ms and at least 99% successful responses. The k6 test used a stricter threshold of p95 below 500 ms and an HTTP error rate below 1%.

## Results

| Metric                 |               Result |
| ---------------------- | -------------------: |
| Average latency        |             30.55 ms |
| Median latency         |              4.99 ms |
| p90 latency            |            155.04 ms |
| p95 latency            |            192.87 ms |
| Maximum latency        |            446.95 ms |
| Request rate           | 9.63 requests/second |
| Total requests         |                  587 |
| HTTP success rate      |              100.00% |
| HTTP error rate        |                0.00% |
| Check success rate     |              100.00% |
| Cache hit rate         |                  86.54% |
| Cache hits             |                  508 |
| Cache misses           |                   79 |
| Completed iterations   |                  587 |
| Interrupted iterations |                    0 |

## Full k6 Summary

```text id="pcns0v"
THRESHOLDS

http_req_duration
✓ 'p(95)<500' p(95)=192.87ms

http_req_failed
✓ 'rate<0.01' rate=0.00%

TOTAL RESULTS

checks_total.......: 1174    19.252287/s
checks_succeeded...: 100.00% 1174 out of 1174
checks_failed......: 0.00%   0 out of 1174

✓ status is 200
✓ response has body

HTTP
http_req_duration..............: avg=30.55ms min=1.57ms med=4.99ms max=446.95ms p(90)=155.04ms p(95)=192.87ms
  { expected_response:true }...: avg=30.55ms min=1.57ms med=4.99ms max=446.95ms p(90)=155.04ms p(95)=192.87ms
http_req_failed................: 0.00%  0 out of 587
http_reqs......................: 587    9.626143/s

EXECUTION
iteration_duration.............: avg=1.03s min=1s med=1s max=1.44s p(90)=1.15s p(95)=1.19s
iterations.....................: 587    9.626143/s
vus............................: 10 min=10 max=10
vus_max........................: 10 min=10 max=10

NETWORK
data_received..................: 341 kB 5.6 kB/s
data_sent......................: 60 kB 978 B/s

587 complete and 0 interrupted iterations
```

## SLO comparison

The Sprint 5 test met both `gateway-service` SLO commitments. The p95 latency was **192.87 ms**, which well satisfies our system's documented **700 ms** latency target along with the Sprint 5 test's strict 500 ms threshold. The HTTP success rate was **100%** with a **0% error rate**, exceeding the required reliability target of at least 99%. All 587 HTTP requests completed successfully and all 1,174 k6 checks passed.

## Comparison with Sprint 3 Load Test

| Metric            |   Sprint 3 |   Sprint 5 |
| ----------------- | ---------: | ---------: |
| p95 latency       |  293.03 ms |  192.87 ms |
| Request rate      | 9.09 req/s | 9.63 req/s |
| HTTP success rate |    100.00% |    100.00% |
| HTTP error rate   |      0.00% |      0.00% |
| Test duration     | 30 seconds | 60 seconds |
| Virtual users     |         10 |         10 |

Compared to Sprint 3, Sprint 5 maintained the same 100% HTTP success rate while improving p95 latency from **293.03 ms to 192.87 ms**, an improvement of about 100 ms or 34%. The request rate also increased slightly from 9.09 requests per second to 9.63 requests per second. Sprint 5 ran for twice as long as Sprint 3, while continuing to meet the `gateway-service` latency and reliability SLOs.

## Interpretation

The `gateway-service` `/availability?title=...` endpoint continued to meet both documented SLO commitments under the final load test. The median latency was only **4.99 ms**, with a p95 latency of **192.87 ms**, which is consistent with Redis caching behavior on a hit vs. a miss (similarly visible in Sprint 3 test results). Sprint 5 testing indicated that a request cache hit duration is a **median of 5.69 ms** and a **p95 of 11.91 ms**. Redis caching avoids downstream catalog calls by quickly returning previously-computed responses. In contrast, cache misses entail higher cost as the gateway must retrieve availability information downstream through the catalog ambassador and catalog service. As such, a cache miss results in request durations with a **median of 193.11 ms** and a **p95 of 363.32 ms**. With about **500 requests** resulting in cache hits and roughly **80 requests** being misses, caching signficantly benefitted our system and its ability to process many requests efficiently. Overall, our system in Sprint 5 achieved low p95 latency and slightly higher throughput while maintaining a 0% HTTP error rate, beating out both the Sprint 3 and SLO benchmarks.

## Bottleneck and Next Steps

The main system bottleneck is requests experiencing a cache-miss, where the gateway must proceed to contact the catalog path for multiple branches, aggregate the responses, and returning the combined result. The maximum response time during Sprint 5 is **446.95 ms** and very close to the maximum duration for handling a request cache miss, which indicates a heavy time cost linked to request processing following a cache miss. 

And, although the maximum request duration is under the 700 ms SLO, a future sprint would be well-spent looking into this noticeable disparity which is much higher than the **4.99 ms** median and the **192.87 ms** p95 latency. With one more sprint, we can focus on further improving cache effectiveness, adding per-service and per-branch latency metrics linked to any given request, optimizing concurrent requests directed across all branches, and using Grafana to identify the specific downstream service(s) that contributes most to higher-latency requests. 

Ultimately, the final Sprint 5 load test satisfied the documented `gateway-service` latency and reliability SLOs, and made gains in performance compared to the Sprint 3 baseline.
