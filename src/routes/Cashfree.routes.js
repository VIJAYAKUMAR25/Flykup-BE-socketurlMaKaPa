import { createOrder, verifyOrder } from "../controllers/CashfreePayment.controller.js";
import express from "express";

const router = express.Router();

router.post("/create-order", createOrder);
router.post("/verify-order", verifyOrder);

export default router;
