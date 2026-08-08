import amqp from "amqplib";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";

const QUEUE_NAME = "hold-notifications";

let channelPromise = null;

/*
 * Lazily connect and cache the channel so we don't reopen a connection
 * on every publish. If the connection ever drops, the promise is reset
 * so the next publish attempt reconnects instead of reusing a dead channel.
 */
const getChannel = async () => {
  if (!channelPromise) {
    channelPromise = (async () => {
      const connection = await amqp.connect(RABBITMQ_URL);

      connection.on("error", (error) => {
        console.error(
          `[holds-service] rabbitmq connection error: ${error.message}`
        );
        channelPromise = null;
      });

      connection.on("close", () => {
        console.error("[holds-service] rabbitmq connection closed");
        channelPromise = null;
      });

      const channel = await connection.createChannel();
      await channel.assertQueue(QUEUE_NAME, { durable: true });

      return channel;
    })();
  }

  return channelPromise;
};

/*
 * Enqueue a notification job for a newly placed hold. This is fire-and-forget
 * from the caller's perspective: the patron's hold is already saved by the
 * time this runs, so a queue publish failure is logged but does not fail
 * the hold request itself.
 */
export const publishHoldNotification = async (hold) => {
  try {
    const channel = await getChannel();

    const message = {
      holdId: hold.id,
      patronName: hold.patronName,
      bookTitle: hold.bookTitle,
      branch: hold.branch,
      createdAt: hold.createdAt,
    };

    channel.sendToQueue(
      QUEUE_NAME,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );

    console.log(
      `[holds-service] enqueued hold-notifications message ` +
        `for hold ${hold.id} (${hold.patronName} / "${hold.bookTitle}")`
    );
  } catch (error) {
    console.error(
      `[holds-service] failed to enqueue notification for hold ` +
        `${hold.id}: ${error.message}`
    );
  }
};