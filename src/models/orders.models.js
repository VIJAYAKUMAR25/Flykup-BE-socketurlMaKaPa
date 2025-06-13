import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        products: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "productlistings",
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                },
                productOrderStatus: {
                    type: String,
                    enum: ["CREATED", "PLACED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
                    default: "CREATED",
                },
            },
        ],
        shippingAddress: {
            name: String,
            mobile: String,
            line1: String,
            line2: String,
            city: String,
            state: String,
            pincode: String,
        },
        paymentDetails: {
            orderId: String,
            paymentSessionId: String,
            paymentStatus: {
                type: String,
                enum: ["PENDING", "PAID", "FAILED"],
                default: "PENDING",
            },
        },
        totalAmount: {
            type: Number,
            required: true,
        },
        shippingFee: {
            type: Number,
            default: 0,
        },
        tax: {
            type: Number,
            required: true,
        },
        orderStatus: {
            type: String,
            enum: ["CREATED", "PLACED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
            default: "CREATED",
        },
    },
    { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
