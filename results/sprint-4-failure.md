# Sprint 4 Failure Scenario

For Sprint 4, our failure scenario fault injects unavailability for `notification-worker` while the rest of the system remains completely functional. Normally, when a user creates a hold, the `holds-service` first processes and saves the hold, then forwards a hold notification job to the RabbitMQ brokering queue. The available `notification-worker` handles the notification job from the queue, processes the notification in the background, and acknowledges the job upon completion so RabbitMQ can officially remove the job from the queue.

For this failure demonstration, the worker's status as a consumer to the RabbitMQ message broker is rescinded, not its state as a running process. Thus, no notification job can be handled without an eligible consumer. Please see `sprint-4-failure.sh` for the entire failure script and to reproduce the scenario in bash. 

Alternatively, our system's fault injection endpoint can kill a worker by toggling the worker fault mode to 'kill' via the `/fault/:mode` endpoint so the worker process becomes terminated mid-job. Once killed, the worker automatically restarts (per the worker container configuration), reconnects to the RabbitMQ service, and reclaims consumer status so it can process enqueued jobs. Please see `sprint-4-kill-failure.sh` for the associated failure script and to reproduce the scenario in bash. 

The fail event, involving an unavailable consumer, and subsequent system response is as follows. 
Once the system is up, the failure triggers by cancelling `notification-worker`'s consumer status with RabbitMQ (switch fault state to 'crash' via `notification-worker` `/fault/:mode` endpoint), thus disabling its ability to handle a queued job: 

```bash
curl -fsS -X POST "http://localhost:3005/fault/crash"
```
logs: `{...,"message":"fault mode changed","service":"notification-worker","previousMode":"none","faultMode":"crash"}`

The worker process itself remains running, as do RabbitMQ and the other system services; each continues passing health checks. 

Despite the unavailable `notification-worker`, a user can successfully make a hold because a notification processes asynchronously and initiates after a hold request completes. The notification job is still sent to RabbitMQ, but stays in the `hold-notifications` queue because `notification-worker` is unavailable. Although notification processing is suspended, the system degrades gracefully and upholds its core functionality (e.g. process user requests, queue up jobs) instead of failing outright.

`notification-worker` resumes its job handling by re-registering as a consumer with RabbitMQ (switch fault state to 'none' via `notification-worker` `/fault/:mode` endpoint):

```bash
curl -fsS -X POST "http://localhost:3005/fault/none"
```
logs: `{...,"message":"fault mode changed","service":"notification-worker","previousMode":"crash","faultMode":"none"}`

As a valid consumer, the worker picks up the enqueued notification job from the previously-made hold, processes the notification, then acknowledges job once finished. The failure scenario demonstrates the critical role asynchronous processing plays in our system. A temporary problem with the notification service does not stop users from creating holds, and the work is not immediately lost because RabbitMQ retains the messages in queue for a resumed worker to process later on.

In a real production system, we would add more protection around this failure. For example, we could run multiple notification workers so another worker could continue if one fails. We would also add automatic restarts, monitoring and alerts for growing queue size, finite retry handling, and a dead-letter queue to hold messages that repeatedly fail. More detailed logs and metrics would also help us quickly detect when notifications are delayed.