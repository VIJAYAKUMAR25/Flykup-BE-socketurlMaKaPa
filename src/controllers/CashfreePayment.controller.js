import axios from "axios";
import ProductListing from "../models/productListing.model.js";
import Order from "../models/orders.models.js";


const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_MODE = process.env.CASHFREE_MODE;

export const createOrder = async (req, res) => {
  const { selectedAddress, products, customer, amount: frontendAmount, backendOrderId } = req.body;

  try {
    let total = 0;

    for (const item of products) {
      const dbProduct = await ProductListing.findById(item.product._id);

      if (!dbProduct) {
        return res.status(404).json({ error: "Product not found" });
      }

      total += dbProduct.productPrice * item.quantity;
    }

    // Static Shipping and  tax
    const shippingFee = total > 999 ? 0 : 49;
    const tax = Math.round(total * 0.18);
    const finalAmount = parseFloat((total + shippingFee + tax).toFixed(2));

    console.log("Final Amount", finalAmount);
    console.log("FE Amount", frontendAmount);

    // ✅ Compare frontend vs backend amount
    if (parseFloat(frontendAmount) !== finalAmount) {
      return res.status(400).json({
        error: "Amount mismatch. Please refresh the page and try again.",
        serverCalculatedAmount: finalAmount,
        frontendAmount,
      });
    }

    // ✅ Proceed with payment request to Cashfree
    const response = await axios.post(
      `https://${CASHFREE_MODE === "TEST" ? "test" : "api"}.cashfree.com/pg/orders`,
      {
        order_id: `order_${Date.now()}`,
        order_amount: finalAmount,
        order_currency: "INR",
        order_note: "Flykup order",
        customer_details: {
          customer_id: customer._id || `cust_${Date.now()}`,
          customer_name: customer.name,
          customer_email: customer.emailId,
          customer_phone: selectedAddress.mobile,
          customer_address: {
            line1: selectedAddress.line1,
            line2: selectedAddress.line2,
            city: selectedAddress.city,
            state: selectedAddress.state,
            pincode: selectedAddress.pincode,
          },
        },
      },
      {
        headers: {
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
          "x-api-version": "2022-09-01",
          "Content-Type": "application/json",
        },
      }
    );

    const { order_id, payment_session_id } = response.data;

    // UPDATE PAYMENT DETAILS IN BE ORDER
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: backendOrderId },
      {
        $set: {
          "paymentDetails.paymentStatus": "PENDING",
          "paymentDetails.orderId": order_id,
          "paymentDetails.paymentSessionId": payment_session_id,
        },
      },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      cashfree_orderId: order_id,
      paymentSessionId: payment_session_id,
      amount: finalAmount,
      products,
      customer,
    });
  } catch (error) {
    console.error("Error creating Cashfree order:", error.response?.data || error.message);
    res.status(500).json({
      error: "Error creating Cashfree order",
      details: error.response?.data || error.message,
    });
  }
};


export const verifyOrder = async (req, res) => {
  const { cashfree_orderId } = req.body;  // received from frontend request

  if (!cashfree_orderId) {
    return res.status(400).json({ error: "Order ID is required" });
  }

  try {
    const response = await axios.get(
      `https://${CASHFREE_MODE === "TEST" ? "test" : "api"}.cashfree.com/pg/orders/${cashfree_orderId}`,
      {
        headers: {
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
          "x-api-version": "2022-09-01",
          "Content-Type": "application/json",
        },
      }
    );

    // FIXED: use exact property names as returned by Cashfree API
    const {
      order_id: cashfreeOrderId,
      order_status: orderStatus,
      payment_link: paymentLink,
    } = response.data;

    res.json({
      cashfree_orderId: cashfreeOrderId,  // clear distinction now
      orderStatus,
      paymentLink,
    });
  } catch (error) {
    console.error("Error verifying Cashfree order:", error.response?.data || error.message);
    res.status(500).json({
      error: "Error verifying Cashfree order",
      details: error.response?.data || error.message,
    });
  }
};

