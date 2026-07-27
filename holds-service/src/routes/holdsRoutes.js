import express from "express";
import {
  getHolds,
  createHold
} from "../controllers/holdsController.js";

const router = express.Router();

router.get("/", getHolds);
router.post("/", createHold);

export default router;