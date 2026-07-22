# Service Level Objectives

## catalog-service (Bhawna's)

**Latency**: The GET /catalog/search endpoint must respond within 400ms at p95. If someone's standing at their laptop trying to decide whether to walk to a branch, a slow lookup basically defeats the purpose. They'll just leave without an answer.

**Reliability**: This endpoint must succeed at least 99% of the time, occuring at least once. A failed lookup is annoying but not dangerous, worst case the patron just retries or calls the branch. So this one doesn't need to be super strict, just consistently up.

## holds-service

**Latency**: The place hold endpoint must respond within 500ms at p95, so patrons get an immediate confirmation of their spot in line during a popular release.

**Reliability**: The place hold endpoint must succeed at least 99.5% of the time, and needs to be exactly once. A given hold request corresponding to only one operation on the server is ensured via idempotency keys linked to each client request and re-referenced by the server. A retried request will not create duplicate spots in the hold queue for the same patron, and avoid unexpected consequences like a queue filling up from one user or a misrepresentation of real demand.

## lending-service

**Latency**: The checkout endpoint must respond within 500ms at p95. Patrons will expect a digital loan to process quickly after checking out, and gain assurance that they are officially entitled to a resource.

**Reliability**: The checkout endpoint must succeed at least 99.9% of the time and must occur effectively once. Our library system must ensure any checkout executes at least once. Also, the checkout operation must be idempotent, via client-server idempotency keys, so users can safely repeat a checkout if they don't receive a response back. Thus, any checkout by a user is realistically guaranteed to be done exactly once -- a checkout request will cause a single computation on the server-side and repeated requests simply return the previously-computed result, not duplicate checkouts, for any given resource. 

## gateway-service (shared)

**Latency**: The cross branch availability endpoint must respond within 700ms at p95, since it has to call out to multiple branch catalogs before returning one combined result.

**Reliability**: This endpoint must succeed at least 99% of the time. If one branch is down, the gateway should still return results from the branches that are up instead of failing the whole request, since a full failure blocks patrons from getting any answer at all.
***
These are first pass commitments, not final engineering numbers. They'll shape our design decisions in later sprints and we'll measure against them starting in Sprint 3.
