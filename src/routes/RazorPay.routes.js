import { createOrder } from "../controllers/RazorPay.controller.js";
import Express from "express";

const razorpayRouter = Express.Router();


razorpayRouter.post("/create-order", createOrder);


export default razorpayRouter;