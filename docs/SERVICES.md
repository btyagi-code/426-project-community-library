# Services List

* Team target: at least 4 custom services (3 members + 1 additional/shared service)

**catalog-service (shared):** Manages inventory and handles book and digital resource search and availability information across branches.

**holds-service (Grace):** Manages hold requests and queue position for patrons. After a hold is saved, this service publishes a message to the `hold-notifications` RabbitMQ work queue.

**lending-service (Erik):** Coordinates resource check-outs and handles active loans, due dates, and returns.

**gateway-service (Bhawna):** Routes incoming patron requests and aggregates availability information across branches.

**notification-worker (shared, Sprint 4):** Consumes messages from the `hold-notifications` RabbitMQ work queue and processes hold notifications asynchronously.

# Diagram

```mermaid
flowchart LR
    Patron([Patron / curl / k6])

    subgraph Compose[Docker Compose network]

        Caddy[caddy<br/>load balancer<br/>host port 3000]

        subgraph GatewayReplicas[gateway-service replicas]
            Gateway1[gateway-service-1<br/>/health /metrics]
            Gateway2[gateway-service-2<br/>/health /metrics]
            Gateway3[gateway-service-3<br/>/health /metrics]
        end

        Redis[(redis<br/>availability cache<br/>TTL 5s)]

        Ambassador[catalog-ambassador<br/>/health /metrics<br/>host port 3002]

        Catalog[catalog-service<br/>/health /metrics<br/>host port 3001]

        Holds[holds-service<br/>/health /metrics /holds<br/>host port 3004]

        Lending[lending-service<br/>/health /metrics /loan<br/>host port 3003]

        RabbitMQ{{rabbitmq<br/>hold-notifications work queue<br/>AMQP port 5672}}

        Worker[notification-worker<br/>/health /metrics<br/>host port 3005]

        Prometheus[(Prometheus<br/>scrapes /metrics<br/>host port 9090)]

        Grafana[Grafana<br/>request rate<br/>error rate<br/>p95 latency<br/>host port 3006]
    end

    Patron -- "GET /availability?title=..." --> Caddy

    Caddy --> Gateway1
    Caddy --> Gateway2
    Caddy --> Gateway3

    Gateway1 -. "cache" .-> Redis
    Gateway2 -. "cache" .-> Redis
    Gateway3 -. "cache" .-> Redis

    Gateway1 --> Ambassador
    Gateway2 --> Ambassador
    Gateway3 --> Ambassador

    Ambassador --> Catalog
    Catalog --> Ambassador

    Ambassador --> Gateway1
    Ambassador --> Gateway2
    Ambassador --> Gateway3

    Gateway1 --> Caddy
    Gateway2 --> Caddy
    Gateway3 --> Caddy

    Caddy --> Patron

    Patron -- "POST /holds" --> Holds
    Holds --> Patron

    Holds -- "publish message" --> RabbitMQ
    RabbitMQ -- "deliver message" --> Worker

    Patron -- "POST /loan" --> Lending
    Lending --> Patron

    Prometheus -. "scrape /metrics" .-> Gateway1
    Prometheus -. "scrape /metrics" .-> Gateway2
    Prometheus -. "scrape /metrics" .-> Gateway3
    Prometheus -. "scrape /metrics" .-> Ambassador
    Prometheus -. "scrape /metrics" .-> Catalog
    Prometheus -. "scrape /metrics" .-> Holds
    Prometheus -. "scrape /metrics" .-> Lending
    Prometheus -. "scrape /metrics" .-> Worker

    Grafana --> Prometheus
```

