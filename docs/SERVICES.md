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
    Patron([Patron / curl / k6])

    subgraph Compose[Docker Compose network]
        Caddy[caddy<br/>load balancer, round robin<br/>host port 3000]

        subgraph GatewayReplicas[gateway-service replicas]
            Gateway1[gateway-service-1<br/>container port 3000]
            Gateway2[gateway-service-2<br/>container port 3000]
            Gateway3[gateway-service-3<br/>container port 3000]
        end

        Redis[(redis<br/>availability cache<br/>TTL 5s)]

        Ambassador[catalog-ambassador<br/>ambassador pattern<br/>container port 3000<br/>host port 3002]
        Catalog[catalog-service<br/>container port 3000<br/>host port 3001]
    end

    Patron -- "GET /availability?title=..." --> Caddy

    Caddy -- "round robin, health-checked via /health" --> Gateway1
    Caddy --> Gateway2
    Caddy --> Gateway3

    Gateway1 -. "GET/SET availability:&lt;title&gt;<br/>cache hit or miss" .-> Redis
    Gateway2 -. "GET/SET availability:&lt;title&gt;" .-> Redis
    Gateway3 -. "GET/SET availability:&lt;title&gt;" .-> Redis

    Gateway1 -- "on cache miss only:<br/>GET /catalog/search?title=...&branch=...<br/>one request per branch" --> Ambassador
    Gateway2 -- "on cache miss only" --> Ambassador
    Gateway3 -- "on cache miss only" --> Ambassador

    Ambassador -- "forwards request unchanged" --> Catalog

    Catalog -- "branch-specific JSON response" --> Ambassador

    Ambassador -. "logs method, path, status, and latency" .-> Ambassador

    Ambassador -- "relays response" --> Gateway1
    Ambassador -- "relays response" --> Gateway2
    Ambassador -- "relays response" --> Gateway3

    Gateway1 -- "aggregated branch availability<br/>+ instance id + cache HIT/MISS" --> Caddy
    Gateway2 --> Caddy
    Gateway3 --> Caddy

    Caddy --> Patron

    subgraph Standalone[Implemented standalone services, not yet wired into Sprint 3]
        Holds[holds-service<br/>Grace<br/>/health, /holds<br/>container port 3002]
        Lending[lending-service<br/>Erik<br/>/health, /loan<br/>container port 3003]
    end
    