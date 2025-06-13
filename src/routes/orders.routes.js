import express from "express";
import { createOrder, updateOrderPlaced, getUserOrders, getSellerOrders, getSingleOrder } from "../controllers/orders.controller.js";

const router = express.Router();

// Route to create a new order
router.post("/create-order", createOrder);

// Route to update order status after payment verification
router.post("/update-placed", updateOrderPlaced);

router.get("/user/:userId", getUserOrders)

router.get("/seller/:sellerId", getSellerOrders)

router.get("/:id", getSingleOrder)

export default router;