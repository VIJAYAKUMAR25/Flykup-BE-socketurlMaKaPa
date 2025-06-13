import Express from 'express';
import { editOrderByOrderId, getAllOrders, getOrdersBySellerId, getOrdersByUserId, placeOrder } from '../controllers/order.controller.js';

const orderRouter = Express.Router();

// to place new order
orderRouter.post("/", placeOrder);

// to get all orders
orderRouter.get("/",getAllOrders);

// to get received orders by seller id
orderRouter.get("/received/:sellerId", getOrdersBySellerId);

// to get placed orders by user id
orderRouter.get("/placed/:userId", getOrdersByUserId);


// edit order details from admin panel
orderRouter.put("/:orderId", editOrderByOrderId);


export default orderRouter;