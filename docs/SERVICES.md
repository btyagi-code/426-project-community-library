# Services List

* Team target: at least 4 custom services (3 members + 1 additional/shared service)

**catalog-service (shared):** Manages inventory and handles book and digital resource search and availability information across branches. This is what a patron uses when browsing or checking whether an item is available and where.

**holds-service (Grace):** Manages hold requests and queue position for patrons waiting on an item that is currently checked out. After a hold is saved, this service publishes a message to the `hold-notifications` RabbitMQ work queue.

**lending-service (Erik):** Coordinates resource check-outs and handles information about active loans, due dates, and returns.

**gateway-service (Bhawna):** Routes incoming patron requests to the appropriate service and aggregates availability information across branches into one response.

**notification-worker (shared, Sprint 4):** Standalone consumer of the `hold-notifications` RabbitMQ work queue. It picks up each hold notification created by `holds-service`, simulates sending a confirmation to the patron, and acknowledges the message after processing. It exposes `/health` and an admin `/fault/:mode` endpoint with `none`, `crash`, and `slow` modes for the Sprint 4 failure scenario.

---

This is our current service structure based on the library domain, including catalog browsing, holds, digital lending, cross-branch coordination, caching, and asynchronous notification processing.

# Diagram

```mermaid
flowchart LR
    Patron([Patron / curl / k6])

    subgraph Compose[Docker Compose network]

        Caddy[caddy<br/>load balancer, round robin<br/>/health via gateway<br/>host port 3000]

        subgraph GatewayReplicas[gateway-service replicas]
            Gateway1[gateway-service-1<br/>container port 3000<br/>/health]
            Gateway2[gateway-service-2<br/>container port 3000<br/>/health]
            Gateway3[gateway-service-3<br/>container port 3000<br/>/health]
        end

        Redis[(redis<br/>availability cache<br/>TTL 5s<br/>healthcheck enabled)]

        Ambassador[catalog-ambassador<br/>ambassador pattern<br/>container port 3000<br/>host port 3002<br/>/health]

        Catalog[catalog-service<br/>container port 3000<br/>host port 3001<br/>/health]

        Holds[holds-service<br/>Grace<br/>/health, /holds<br/>container port 3002<br/>host port 3004]

        Lending[lending-service<br/>Erik<br/>/health, /loan<br/>container port 3003<br/>host port 3003]

        RabbitMQ{{rabbitmq<br/>AMQP port 5672<br/>hold-notifications work queue<br/>healthcheck enabled<br/>management UI host port 15672}}

        Worker[notification-worker<br/>Sprint 4 async consumer<br/>/health, /fault/:mode<br/>container port 3000<br/>host port 3005]
    end

    Patron -- "GET /availability?title=..." --> Caddy

    Caddy -- "round robin<br/>gateway health checked via /health" --> Gateway1
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

    Ambassador -. "logs method, path,<br/>status, and latency" .-> Ambassador

    Ambassador -- "relays response" --> Gateway1
    Ambassador -- "relays response" --> Gateway2
    Ambassador -- "relays response" --> Gateway3

    Gateway1 -- "aggregated branch availability<br/>+ instance id + cache HIT/MISS" --> Caddy
    Gateway2 --> Caddy
    Gateway3 --> Caddy

    Caddy --> Patron

    Patron -- "POST /holds<br/>{patronName, bookTitle, branch}" --> Holds

    Holds -- "201 + hold record<br/>does not wait for worker" --> Patron

    Holds -- "publish message<br/>logs enqueue" --> RabbitMQ

    RabbitMQ -- "deliver one message<br/>to one worker" --> Worker

    Worker -. "logs PICKED UP<br/>processes notification<br/>logs PROCESSED<br/>acks message" .-> Worker

    Patron -- "POST /fault/:mode<br/>none / crash / slow" --> Worker

    Patron -- "POST /loan" --> Lending

    Lending -- "loan confirmation" --> Patron
```
