# Sprint 4 Failure Scenario

For Sprint 4, our failure scenario fault injects unavailability for `notification-worker` while the rest of the system remains completely functional. Normally, when a user creates a hold, the `holds-service` first processes and saves the hold, then forwards a hold notification job to the RabbitMQ brokering queue. The available `notification-worker` handles the notification job from the queue, processes the notification in the background, and upon completion, signals job completion so RabbitMQ can officially remove the job from the queue.

The failed worker event and subsequent system response is as follows. Please see sprint-4-failure.sh script for the entire failure script and to reproduce the scenario in bash. 

Once the system is up, the failure triggers by cancelling `notification-worker`'s consumer status with RabbitMQ (switch fault state to crash via `notification-worker` `/fault/:mode` endpoint), thus disabling its ability to handle a queued job: 

```bash
curl -fsS -X POST "http://localhost:3005/fault/crash"
```
logs: `{...,"message":"fault mode changed","service":"notification-worker","previousMode":"crash","faultMode":"none"}`

The worker process itself remains running, as do RabbitMQ and the other system services; each continues passing health checks. 

Despite the unavailable `notification-worker`, a user can successfully make a hold because a notification processes asynchronously and initiates after a hold request completes. The notification job is still sent to RabbitMQ, but stays in the `hold-notifications` queue because `notification-worker` is unavailable. Although notification processing is suspended, the system degrades gracefully and upholds its core functionality (e.g. process user requests, queue up jobs) instead of failing outright.

`notification-worker` resumes its job handling by re-registering as a consumer with RabbitMQ (switch fault state to none via `notification-worker` `/fault/:mode` endpoint):

```bash
curl -fsS -X POST "http://localhost:3005/fault/none"
```
logs: `{...,"message":"fault mode changed","service":"notification-worker","previousMode":"crash","faultMode":"none"}`

Once reconnected to RabbitMQ, the worker picks up the enqueued notification job from the previously-made hold, processes the notification, then acknowledges job completion. The failure scenario demonstrates the critical role asynchronous processing plays in our system. A temporary problem with the notification service does not stop users from creating holds, and the work is not immediately lost because RabbitMQ retains the messages in queue for a resumed worker to process later on.

In a real production system, we would add more protection around this failure. For example, we could run multiple notification workers so another worker could continue if one fails. We would also add automatic restarts, retry handling, monitoring and alerts for growing queue size, and a dead-letter queue for messages that repeatedly fail. More detailed logs and metrics would also help us quickly detect when notifications are delayed.
