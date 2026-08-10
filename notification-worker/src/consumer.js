import amqp from "amqplib";
import { log } from "./observability.js";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";

const QUEUE_NAME = "hold-notifications";

const SLOW_MODE_DELAY_MS = 5000;

// Shared mutable state, flipped at runtime by the /fault admin endpoint.
// Valid values:
// "none"  = normal processing
// "crash" = stop consuming so messages remain queued
// "slow"  = process messages with an artificial delay
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
    log("error", "received malformed message, discarding", {
      service: "notification-worker",
      error: error.message,
    });

    channel.ack(msg);
    return;
  }

  log("info", "picked up hold notification", {
    service: "notification-worker",
    holdId: payload.holdId,
    patronName: payload.patronName,
    bookTitle: payload.bookTitle,
    branch: payload.branch,
  });

  if (state.faultMode === "slow") {
    log("warn", "slow fault mode delaying notification", {
      service: "notification-worker",
      holdId: payload.holdId,
      delayMs: SLOW_MODE_DELAY_MS,
    });

    await delay(SLOW_MODE_DELAY_MS);
  }

  // Simulated notification delivery.
  // In production this could call an email or SMS provider.
  log("info", "processed hold notification", {
    service: "notification-worker",
    holdId: payload.holdId,
    patronName: payload.patronName,
    bookTitle: payload.bookTitle,
    branch: payload.branch,
  });

  channel.ack(msg);
};

/*
 * Begin or resume consuming messages.
 * If already subscribed, this does nothing.
 */
export const subscribe = async () => {
  if (!channelRef || consumerTag) {
    return;
  }

  const { consumerTag: tag } = await channelRef.consume(
    QUEUE_NAME,
    (msg) => {
      handleMessage(channelRef, msg).catch((error) => {
        log("error", "unexpected error handling message", {
          service: "notification-worker",
          error: error.message,
        });

        if (msg) {
          channelRef.nack(msg, false, true);
        }
      });
    }
  );

  consumerTag = tag;

  log("info", "subscribed to RabbitMQ queue", {
    service: "notification-worker",
    queue: QUEUE_NAME,
    consumerTag: tag,
  });
};

export const unsubscribe = async () => {
  if (!channelRef || !consumerTag) {
    return;
  }

  const tag = consumerTag;
  consumerTag = null;

  await channelRef.cancel(tag);

  log("warn", "unsubscribed from RabbitMQ queue", {
    service: "notification-worker",
    queue: QUEUE_NAME,
    consumerTag: tag,
    messageBehavior: "new messages will remain queued",
  });
};

export const startConsumer = async () => {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, {
    durable: true,
  });

  channel.prefetch(1);

  channelRef = channel;

  log("info", "connected to RabbitMQ", {
    service: "notification-worker",
    queue: QUEUE_NAME,
  });

  if (state.faultMode !== "crash") {
    await subscribe();
  } else {
    log("warn", "starting in crash fault mode", {
      service: "notification-worker",
      queue: QUEUE_NAME,
      faultMode: state.faultMode,
      messageBehavior: "messages will remain queued",
    });
  }

  return channel;
};