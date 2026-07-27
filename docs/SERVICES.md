# Services List
- Team target: 4 services (3 members + 1 shared)


catalog-service (shared): Manages inventory, handles book and digital resource search and availability info across branches.<br>
This is what a patron hits when they're browsing or checking if something is available and where. 

holds-service (Grace): Manages hold requests and queue position for patrons waiting on an item that's currently checked out somewhere else.

lending-service (Erik): Coordinates queries for resource check-outs, as well as updates regarding active loans, due-by dates, and returns.

gateway-service (Bhawna): Routes incoming patron requests to the right branch or service and aggregates availability info across branches into one response.
***
This is our first pass based on the domain (catalog browsing, holds, digital lending, and cross branch coordination). Ownership may shift slightly and scope will get more specific as we learn more patterns in later sprints.


# Diagram 

```mermaid
flowchart LR
    Patron([Patron / curl])

    subgraph Compose[Docker Compose network]
        Gateway[gateway-service<br/>container port 3000<br/>host port 3000]
        Sidecar[catalog-sidecar<br/>container port 3000<br/>host port 3002]
        Catalog[catalog-service<br/>container port 3000<br/>host port 3001]
    end

    Patron -- "GET /availability?title=..." --> Gateway

    Gateway -- "GET /catalog/search?title=...&branch=...<br/>one request per branch" --> Sidecar

    Sidecar -- "forwards request unchanged" --> Catalog

    Catalog -- "branch-specific JSON response" --> Sidecar

    Sidecar -. "logs method, path, status, and latency" .-> Sidecar

    Sidecar -- "relays response" --> Gateway

    Gateway -- "aggregated branch availability" --> Patron


