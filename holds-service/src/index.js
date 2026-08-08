
import express from "express";
import holdsRoutes from "./routes/holdsRoutes.js";
 
const app = express();
const port = process.env.PORT || 3002;
 
app.use(express.json());
 
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "holds-service"
  });
});
 
app.use("/holds", holdsRoutes);
 
app.listen(port, () => {
  console.log(`holds-service running on port ${port}`);
});