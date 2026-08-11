import express from "express";
import {
  log,
  metricsHandler,
  requestMetricsMiddleware
} from "./observability.js";
import {
  startConsumer,
  state,
  subscribe,
  unsubscribe
} from "./consumer.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(requestMetricsMiddleware);

app.get("/health", (req, res) => {
  return res.json({ status: "ok" });
});

app.get("/metrics", metricsHandler);

const VALID_FAULT_MODES = ["none", "crash", "slow"];

app.post("/fault/:mode", async (req, res) => {
  const { mode } = req.params;

  if (!VALID_FAULT_MODES.includes(mode)) {
    return res.status(400).json({
      error: `mode must be one of: ${VALID_FAULT_MODES.join(", ")}`
    });
  }

  const previousMode = state.faultMode;
  state.faultMode = mode;

  try {
    if (mode === "crash") {
      await unsubscribe();
    } else if (previousMode === "crash") {
      await subscribe();
    }
  } catch (error) {
    log("error", "failed to change fault mode", {
      service: "notification-worker",
      mode,
      error: error.message
    });

    return res.status(500).json({
      error: "Unable to change fault mode"
    });
  }

  log("warn", "fault mode changed", {
    service: "notification-worker",
    previousMode,
    faultMode: mode
  });

  return res.json({
    ok: true,
    faultMode: mode
  });
});

app.listen(PORT, () => {
  log("info", "notification-worker admin server started", {
    service: "notification-worker",
    port: Number(PORT)
  });
});

startConsumer().catch((error) => {
  log("error", "notification worker failed to start", {
    service: "notification-worker",
    error: error.message
  });

  process.exit(1);
});