import express from "express";
import { startConsumer, state, subscribe, unsubscribe } from "./consumer.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (req, res) => {
  return res.json({
    status: "ok",
    service: "notification-worker",
    faultMode: state.faultMode,
  });
});

const VALID_FAULT_MODES = ["none", "crash", "slow"];

/*
 * Toggle fault injection on demand, e.g.:
 *   curl -X POST http://localhost:3005/fault/crash
 *   curl -X POST http://localhost:3005/fault/none
 */
app.post("/fault/:mode", async (req, res) => {
  const { mode } = req.params;

  if (!VALID_FAULT_MODES.includes(mode)) {
    return res.status(400).json({
      error: `mode must be one of: ${VALID_FAULT_MODES.join(", ")}`,
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
    console.error(
      `[notification-worker] failed to update subscription for mode "${mode}": ${error.message}`
    );
  }

  console.log(`[notification-worker] fault mode set to "${mode}"`);

  return res.json({
    ok: true,
    faultMode: state.faultMode,
  });
});

app.listen(PORT, () => {
  console.log(
    `notification-worker admin server listening on port ${PORT}`
  );
});

startConsumer().catch((error) => {
  console.error(
    `[notification-worker] failed to start consumer: ${error.message}`
  );
  process.exit(1);
});