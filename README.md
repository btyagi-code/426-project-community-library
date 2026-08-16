# 426 Project — Community Library

## Team Name

Community Library

## Team Roster

| Name         | GitHub Username | UMass Email                                   |
| ------------ | --------------- | --------------------------------------------- |
| Bhawna Tyagi | btyagi-code     | [btyagi@umass.edu](mailto:btyagi@umass.edu)   |
| Grace Huang  | huang-grace05   | [ghuang@umass.edu](mailto:ghuang@umass.edu)   |
| Erik Liu     | ekliu3          | [erikliu@umass.edu](mailto:erikliu@umass.edu) |

## Domain Description

Our system simulates a community library network that manages book availability, digital resource lending, holds, and borrowing activity across multiple library branches. A single server could become insufficient during periods of high demand, such as after-school hours, summer reading programs, registration periods, or the release of popular books, when many patrons search the catalog, place holds, and borrow digital materials at the same time.

The system supports students, low-income families, older adults, and residents without reliable home internet who depend on public libraries for free access to educational materials, technology, and community services. When the system is slow or unavailable, patrons may be unable to locate needed resources, access digital materials, or determine whether an item is available before traveling to a branch, while library staff may struggle to manage accurate lending and inventory information.

The library resource aggregator requires multiple server systems in order to support all community members with varying needs, for instance, in processing many student requests during the school year when projects and readings are frequently assigned. Our system's ability to coordinate simultaneous background services helps ensure items and their details remain up-to-date across user sessions.

## Documentation

* [Project Description](docs/PROJECT.md)
* [Services](docs/SERVICES.md)
* [Service Level Objectives](docs/SLO.md)

## Running the System

### Requirements

* Docker Desktop
* Docker Compose

Start the complete system with:

```bash
docker compose up --build
```

Check container status with:

```bash
docker compose ps
```

Stop the system with:

```bash
docker compose down
```

## Main Endpoints

| Service                | URL                                             |
| ---------------------- | ----------------------------------------------- |
| Main availability path | `http://localhost:3000/availability?title=Dune` |
| Catalog service        | `http://localhost:3001`                         |
| Catalog ambassador     | `http://localhost:3002`                         |
| Lending service        | `http://localhost:3003`                         |
| Holds service          | `http://localhost:3004`                         |
| Notification worker    | `http://localhost:3005`                         |
| Grafana                | `http://localhost:3006`                         |
| Prometheus             | `http://localhost:9090`                         |
| RabbitMQ Management    | `http://localhost:15672`                        |

## Health Checks and Metrics

Each custom service exposes:

```text
GET /health
GET /metrics
```

The `/health` endpoint is used by Docker Compose health checks.

The `/metrics` endpoint exposes Prometheus metrics including:

* request count
* response-time histogram

`/metrics` in the cached `gateway-service` also exposes: 
* cache hit/miss count


Prometheus scrapes the metrics endpoints from all custom services. 

Prometheus targets can be viewed at:

```text
http://localhost:9090/targets
```

## Grafana Dashboard

Grafana is available at:

```text
http://localhost:3006
```

The dashboard loads automatically when Grafana starts and displays:

* request rate
* error rate
* p95 latency

## Structured Logging

Custom services produce structured JSON logs.

Request logs include:

* timestamp
* level
* message
* HTTP method
* path
* status code
* response time

Container logs can be viewed with:

```bash
docker compose logs
```

## Environment Variables

| Variable | Development Value | Purpose | If missing/not set in Compose: |
| ---- | ----------------- | ---- | ---------|
| `CATALOG_SERVICE_URL` | gateway-service: `http://catalog-ambassador:3000` <br> catalog-ambassador: `http://catalog-service:3000` | Gateway URL for catalog requests                            | assumes default hostname (development value)       |
| `REDIS_URL`           | `redis://redis:6379`             | Redis connection used by gateway service | assumes default connection string (development value) |
| `RABBITMQ_URL`        | `amqp://rabbitmq:5672`           | RabbitMQ connection used by holds and notification services | assumes default connection string (development value) |
| `FAULT_MODE`          | `none`                           | Controls notification-worker failure mode | assumes default value (development value) |

Default development values are provided in `docker-compose.yml`.

## Final Load Test

The final k6 test is located at:

```text
load-tests/sprint-5-load.js
```

It runs the primary availability request path with 10 virtual users for 60 seconds.

Run it while the Docker Compose system is running:

```bash
k6 run load-tests/sprint-5-load.js
```

The final results and interpretation are documented in:

```text
results/sprint-5-load-test.md
```
