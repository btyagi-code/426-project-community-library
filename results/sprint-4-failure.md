# Sprint 4 Failure Scenario

For Sprint 4, our failure scenario fault injects unavailability for `notification-worker`, while the rest of the system remains completely functional. Normally, when a user creates a hold, the `holds-service` first processes and saves the hold, then forwards a hold notification job to the RabbitMQ brokering queue. The available `notification-worker` handles the job from the queue, processes the notification in the background, and upon completion, signals job completion so RabbitMQ can officially remove the job from the queue.

The failed worker event and subsequent system response is as follows. Please see the sprint-4-failure.sh script for the entire process and to conveniently observe the scenario.
Once the system is up, the failure triggers by terminating the `notification-worker` connection to RabbitMQ, thus disabling its ability to handle a queued job: 

```bash
curl -fsS -X POST "$WORKER_URL/fault/crash"
```
The worker process itself remains running, as do RabbitMQ and the other system services. 

Despite the unavailable `notification-worker`, the user can make a hold that processes successfully because the notification is handled asynchronously and occurs after the hold request completes. The notification message is still sent to RabbitMQ, but it stays in the `hold-notifications` queue because  worker available to process it. 
Although there is no worker available, the system can degrade gracefully and uphold its core functionality (e.g. process user requests, queue up jobs) instead of failing outright.

The hold functionality executes fully, just with a caveat that subsequent notification processing is suspended. `notification-worker` can resume its notification job handling by re-establishing its RabbitMQ connection (via switching fault state in the `/fault/:mode` endpoint):

```bash
curl -fsS -X POST "$WORKER_URL/fault/none"
```

Once reconnected to RabbitMQ, the worker picks up the notification job waiting in the queue from the previously-made hold, processes the notification, and acknowledges job completion; this occurs immediately upon its reinstated availability as if it never left. The failure scenario demonstrates the critical role asynchronous processing plays in our system. A temporary problem with the notification service does not stop users from creating holds, and the work is not immediately lost because RabbitMQ retains the messages in queue for a resumed worker to process later on.

In a real production system, we would add more protection around this failure. For example, we could run multiple notification workers so another worker could continue if one fails. We would also add automatic restarts, retry handling, monitoring and alerts for growing queue size, and a dead-letter queue for messages that repeatedly fail. More detailed logs and metrics would also help us quickly detect when notifications are delayed.
