import express from "express";
import holdsRoutes from "./routes/holdsRoutes.js";
import {
  log,
  metricsHandler,
  requestMetricsMiddleware
} from "./observability.js";

const app = express();
const port = process.env.PORT || 3002;

app.use(express.json());

// Week 6 metrics + structured request logging
app.use(requestMetricsMiddleware);

app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
    service: "holds-service"
  });
});

app.get("/metrics", metricsHandler);

app.use("/holds", holdsRoutes);

app.listen(port, () => {
  log("info", "holds-service started", {
    service: "holds-service",
    port: Number(port)
  });
});