import express from "express";
import amqp from "amqplib";
import {
  log,
  metricsHandler,
  requestMetricsMiddleware
} from "./observability.js";

const app = express();
const PORT = process.env.PORT || 3000;

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";

const QUEUE_NAME = "hold-notifications";

app.use(requestMetricsMiddleware);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/metrics", metricsHandler);

app.listen(PORT, () => {
  log("info", "notification-worker admin server started", {
    service: "notification-worker",
    port: Number(PORT)
  });
});

async function startConsumer() {
  while (true) {
    try {
      log("info", "connecting to RabbitMQ", {
        service: "notification-worker"
      });

      const connection = await amqp.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();

      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
      });

      channel.prefetch(1);

      log("info", "waiting for messages", {
        service: "notification-worker",
        queue: QUEUE_NAME
      });

      channel.consume(QUEUE_NAME, async (message) => {
        if (!message) return;

        try {
          const data = JSON.parse(message.content.toString());

          log("info", "picked up notification", {
            service: "notification-worker",
            holdId: data.holdId,
            patronName: data.patronName,
            bookTitle: data.bookTitle,
            branch: data.branch
          });

          // Simulate async notification processing
          await new Promise((resolve) => setTimeout(resolve, 500));

          log("info", "processed notification", {
            service: "notification-worker",
            holdId: data.holdId,
            patronName: data.patronName,
            bookTitle: data.bookTitle,
            branch: data.branch
          });

          channel.ack(message);
        } catch (error) {
          log("error", "failed to process notification", {
            service: "notification-worker",
            error: error.message
          });

          channel.nack(message, false, true);
        }
      });

      connection.on("close", () => {
        log("error", "RabbitMQ connection closed", {
          service: "notification-worker"
        });

        process.exit(1);
      });

      connection.on("error", (error) => {
        log("error", "RabbitMQ connection error", {
          service: "notification-worker",
          error: error.message
        });
      });

      break;
    } catch (error) {
      log("warn", "RabbitMQ not ready, retrying", {
        service: "notification-worker",
        error: error.message,
        retryInSeconds: 3
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

startConsumer();