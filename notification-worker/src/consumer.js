import amqp from "amqplib";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";

const QUEUE_NAME = "hold-notifications";

const SLOW_MODE_DELAY_MS = 5000;

// Shared mutable state, flipped at runtime by the /fault admin endpoint.
// Valid values: "none" (normal processing), "crash" (stop consuming
// entirely, so messages pile up in the queue), "slow" (keep consuming,
// but only after a delay).
export const state = {
  faultMode: process.env.FAULT_MODE || "none",
};

let channelRef = null;
let consumerTag = null;

const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const handleMessage = async (channel, msg) => {
  if (!msg) {
    return;
  }

  let payload;

  try {
    payload = JSON.parse(msg.content.toString());
  } catch (error) {
    console.error(
      `[notification-worker] received malformed message, discarding: ${error.message}`
    );
    channel.ack(msg);
    return;
  }

  console.log(
    `[notification-worker] picked up hold notification ${payload.holdId} ` +
      `for ${payload.patronName}`
  );

  if (state.faultMode === "slow") {
    console.log(
      `[notification-worker] FAULT MODE slow: delaying ${payload.holdId} ` +
        `by ${SLOW_MODE_DELAY_MS}ms before processing`
    );
    await delay(SLOW_MODE_DELAY_MS);
  }

  // Simulated notification delivery. In production this would call an
  // email/SMS provider; here we just log what would have been sent.
  console.log(
    `[notification-worker] notified ${payload.patronName}: your hold on ` +
      `"${payload.bookTitle}" at ${payload.branch} is confirmed`
  );

  channel.ack(msg);
};

/*
 * Begin (or resume) pulling messages off the queue. Safe to call when
 * already subscribed - it no-ops in that case.
 */
export const subscribe = async () => {
  if (!channelRef || consumerTag) {
    return;
  }

  const { consumerTag: tag } = await channelRef.consume(
    QUEUE_NAME,
    (msg) => {
      handleMessage(channelRef, msg).catch((error) => {
        console.error(
          `[notification-worker] unexpected error handling message: ${error.message}`
        );
        channelRef.nack(msg, false, true);
      });
    }
  );

  consumerTag = tag;

  console.log(
    `[notification-worker] subscribed to "${QUEUE_NAME}" (consumer ${tag})`
  );
};


export const unsubscribe = async () => {
  if (!channelRef || !consumerTag) {
    return;
  }

  const tag = consumerTag;
  consumerTag = null;

  await channelRef.cancel(tag);

  console.log(
    `[notification-worker] unsubscribed from "${QUEUE_NAME}" ` +
      `(consumer ${tag}) - messages will now queue up`
  );
};

export const startConsumer = async () => {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, { durable: true });

  
  await channel.prefetch(1);

  channelRef = channel;

  console.log(
    `[notification-worker] connected to rabbitmq, ready on "${QUEUE_NAME}"`
  );

  if (state.faultMode !== "crash") {
    await subscribe();
  } else {
    console.log(
      `[notification-worker] starting in crash mode - not consuming yet`
    );
  }

  return channel;
};