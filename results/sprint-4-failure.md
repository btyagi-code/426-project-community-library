# Sprint 4 Failure Scenario

For Sprint 4, our failure scenario tests what happens when the `notification-worker` is unavailable while the rest of the system is still running. Normally, when a user creates a hold, the `holds-service` first saves the hold and then sends a message to RabbitMQ. The `notification-worker` picks up that message and processes the notification in the background.

To trigger the failure, we can stop the notification worker while leaving RabbitMQ and the other services running:

```bash
docker compose stop notification-worker
```

After the worker is stopped, we can create another hold. The hold should still be created successfully because the notification is handled asynchronously and does not need to finish before the hold request completes. The notification message is still sent to RabbitMQ, but it stays in the `hold-notifications` queue because there is no worker available to process it.This allows the system to degrade gracefully instead of completely failing. The main hold functionality still works, but notification processing is delayed. When the notification worker is started again using:

```bash
docker compose start notification-worker
```

the worker reconnects to RabbitMQ, picks up the messages that were waiting in the queue, processes them, and acknowledges them. This failure test shows why asynchronous processing is useful for this part of the system. A temporary problem with the notification service does not stop users from creating holds, and the work is not immediately lost because RabbitMQ keeps the messages until a worker is available again. In a real production system, we would add more protection around this failure. For example, we could run multiple notification workers so another worker could continue if one fails. We would also add automatic restarts, retry handling, monitoring and alerts for growing queue size, and a dead-letter queue for messages that repeatedly fail. More detailed logs and metrics would also help us quickly detect when notifications are delayed.
