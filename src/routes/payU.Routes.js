import express from "express";
import { createPayUOrder, verifyPayUPayment } from "../controllers/payuController.js";

const router = express.Router();

router.post("/create-order", createPayUOrder);
router.post('/verify-payment', verifyPayUPayment); // Add this new route

export default router;
