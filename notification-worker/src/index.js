import express from "express";
import amqp from "amqplib";

const app = express();
const PORT = process.env.PORT || 3000;

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";

const QUEUE_NAME = "hold-notifications";

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`notification-worker admin server listening on port ${PORT}`);
});

async function startConsumer() {
  while (true) {
    try {
      console.log("[notification-worker] connecting to RabbitMQ...");

      const connection = await amqp.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();

      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
      });

      channel.prefetch(1);

      console.log(
        `[notification-worker] waiting for messages on ${QUEUE_NAME}`
      );

      channel.consume(QUEUE_NAME, async (message) => {
        if (!message) return;

        try {
          const data = JSON.parse(message.content.toString());

          console.log(
            "[notification-worker] PICKED UP notification:",
            data
          );

          // Simulate async notification processing
          await new Promise((resolve) => setTimeout(resolve, 500));

          console.log(
            "[notification-worker] PROCESSED notification:",
            data
          );

          channel.ack(message);
        } catch (error) {
          console.error(
            "[notification-worker] failed to process message:",
            error.message
          );

          channel.nack(message, false, true);
        }
      });

      connection.on("close", () => {
        console.error(
          "[notification-worker] RabbitMQ connection closed"
        );
        process.exit(1);
      });

      connection.on("error", (error) => {
        console.error(
          "[notification-worker] RabbitMQ connection error:",
          error.message
        );
      });

      break;
    } catch (error) {
      console.error(
        `[notification-worker] RabbitMQ not ready: ${error.message}. Retrying in 3 seconds...`
      );

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

startConsumer();