import Razorpay from "razorpay";

const razorpayInstance = new Razorpay({
  key_id: "rzp_test_9tcqU5ebtrZSgC",
  key_secret: "p6j7HjeOMpRnO9DJpaOhbTyv",
});

export const createOrder = async (req, res) => {
  const { amount } = req.body; // Amount in rupees

  try {
    const order = await razorpayInstance.orders.create({
      amount: amount * 100, // Convert to paise
      currency: "INR",
    });

    res.json({ orderId: order.id });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).send("Error creating Razorpay order");
  }
};
