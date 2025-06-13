import mongoose from "mongoose";
import Order from "../models/orders.models.js";
import ProductListing from "../models/productListing.model.js";
import User from "../models/user.model.js";
import Seller from "../models/seller.model.js";

// Create a new order in the database
export const createOrder = async (req, res) => {
    try {
        const { selectedAddress, products, customer, amount } = req.body;

        // Validate request body
        if (!selectedAddress || !products || !customer || !amount) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Calculate total amount dynamically
        let total = 0;
        const dbProducts = [];

        for (const item of products) {
            const dbProduct = await ProductListing.findById(item.product._id);
            if (!dbProduct) {
                return res.status(404).json({ error: `Product not found: ${item.product._id}` });
            }
            dbProducts.push({ product: dbProduct._id, quantity: item.quantity });
            total += dbProduct.productPrice * item.quantity;
        }

        const shippingFee = total > 999 ? 0 : 49;
        const tax = Math.round(total * 0.18);
        const finalAmount = parseFloat((total + shippingFee + tax).toFixed(2));

        // Ensure frontend amount matches backend calculation
        if (parseFloat(amount) !== finalAmount) {
            return res.status(400).json({
                error: "Amount mismatch. Please refresh the page and try again.",
                serverCalculatedAmount: finalAmount,
                frontendAmount: amount,
            });
        }

        // Create the order in the database
        const newOrder = new Order({
            userId: customer._id,
            // products: products,
            products: dbProducts.map((item) => ({
                product: item.product,
                quantity: item.quantity,
                productOrderStatus: "CREATED", // Default status for each product
            })),
            shippingAddress: {
                name: selectedAddress.name,
                mobile: selectedAddress.mobile,
                line1: selectedAddress.line1,
                line2: selectedAddress.line2,
                city: selectedAddress.city,
                state: selectedAddress.state,
                pincode: selectedAddress.pincode,
            },
            paymentDetails: {
                orderId: req.body.orderId, // From Cashfree response
                paymentSessionId: req.body.paymentSessionId,
                paymentStatus: "PENDING",
            },
            totalAmount: finalAmount,
            shippingFee,
            tax,
        });

        await newOrder.save();

        res.status(201).json({ message: "Order created successfully", order: newOrder });
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};

// Update order status after payment verification
export const updateOrderPlaced = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Find the order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        // Update all products to "PLACED"
        order.products.forEach(product => {
            product.productOrderStatus = "PLACED";
        });

        // Since all products are placed, update the overall order status
        order.orderStatus = "PLACED";
        order.paymentDetails.paymentStatus = "PAID"; // Mark payment as completed

        // Save the updated order
        await order.save();

        res.json({ message: "All products and order status updated successfully", order });
    } catch (error) {
        console.error("Error updating order:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};

// Get all orders for a specific user
export const getUserOrders = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }
        // Find all orders for the given user ID
        const orders = await Order.find({ userId })
            .populate("products.product", "title productPrice description images sellerId")
            .sort({ createdAt: -1 }); // Sort by most recent orders

        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: "No orders found for this user" });
        }

        res.json({ message: "User orders fetched successfully", orders });
    } catch (error) {
        console.error("Error fetching user orders:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};

// Get all orders for a specific seller
export const getSellerOrders = async (req, res) => {
    try {
        const { sellerId } = req.params;

        if (!sellerId) {
            return res.status(400).json({ error: "Seller ID is required" });
        }

        // Aggregation pipeline to filter orders based on product.sellerId
        const orders = await Order.aggregate([
            {
                $unwind: "$products", // Unwind the products array to process each product individually
            },
            {
                $lookup: {
                    from: "productlistings", // Reference the ProductListing collection
                    localField: "products.product",
                    foreignField: "_id",
                    as: "productDetails", // Populate product details
                },
            },
            {
                $match: {
                    "productDetails.sellerId": new mongoose.Types.ObjectId(sellerId), // Match products with the seller's ID
                },
            },
            {
                $group: {
                    _id: "$_id", // Group back by the original order ID
                    userId: { $first: "$userId" },
                    shippingAddress: { $first: "$shippingAddress" },
                    paymentDetails: { $first: "$paymentDetails" },
                    totalAmount: { $first: "$totalAmount" },
                    shippingFee: { $first: "$shippingFee" },
                    tax: { $first: "$tax" },
                    orderStatus: { $first: "$orderStatus" },
                    products: {
                        $push: {
                            product: "$products.product",
                            quantity: "$products.quantity",
                            productOrderStatus: "$products.productOrderStatus",
                            productDetails: { $arrayElemAt: ["$productDetails", 0] }, // Extract the first element of productDetails array
                        },
                    },
                },
            },
            {
                $project: {
                    _id: 1,
                    userId: 1,
                    shippingAddress: 1,
                    paymentDetails: 1,
                    totalAmount: 1,
                    shippingFee: 1,
                    tax: 1,
                    orderStatus: 1,
                    products: {
                        $map: {
                            input: "$products",
                            as: "prod",
                            in: {
                                product: "$$prod.product",
                                quantity: "$$prod.quantity",
                                productOrderStatus: "$$prod.productOrderStatus",
                                productName: "$$prod.productDetails.title", // Use actual field names from schema
                                productPrice: "$$prod.productDetails.productPrice",
                                productImage: { $arrayElemAt: ["$$prod.productDetails.images", 0] }, // Extract the first image
                            },
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: "productlistings", // Reference the ProductListing collection again
                    localField: "products.product",
                    foreignField: "_id",
                    as: "populatedProducts", // Populate products.product details
                },
            },
            {
                $addFields: {
                    products: {
                        $map: {
                            input: "$products",
                            as: "prod",
                            in: {
                                product: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: "$populatedProducts",
                                                as: "pp",
                                                cond: { $eq: ["$$pp._id", "$$prod.product"] },
                                            },
                                        },
                                        0,
                                    ],
                                },
                                quantity: "$$prod.quantity",
                                productOrderStatus: "$$prod.productOrderStatus",
                            },
                        },
                    },
                },
            },
            {
                $project: {
                    populatedProducts: 0, // Remove the temporary populatedProducts field
                },
            },
        ]);

        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: "No orders found for this seller" });
        }

        res.json({ message: "Seller orders fetched successfully", orders });
    } catch (error) {
        console.error("Error fetching seller orders:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};

// Get single Order
export const getSingleOrder = async (req, res) => {
    try {
        const { id } = req.params; // This can be either userId or sellerId
        const { orderId } = req.query; // The ID of the order to fetch

        if (!id || !orderId) {
            return res.status(400).json({ error: "User/Seller ID and Order ID are required" });
        }

        // Validate IDs
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid User/Seller ID format" });
        }
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ error: "Invalid Order ID format" });
        }

        // Check if the ID belongs to a user or seller
        const user = await User.findById(id);
        const seller = await Seller.findById(id);

        if (!user && !seller) {
            return res.status(404).json({ error: "Invalid User/Seller ID" });
        }

        // Fetch the order
        const order = await Order.aggregate([
            {
                $match: { _id: new mongoose.Types.ObjectId(orderId) }, // Match the specific order
            },
            {
                $unwind: "$products", // Unwind the products array to process each product individually
            },
            {
                $lookup: {
                    from: "productlistings", // Reference the ProductListing collection
                    localField: "products.product",
                    foreignField: "_id",
                    as: "productDetails", // Populate product details
                },
            },
            {
                $addFields: {
                    productDetails: { $arrayElemAt: ["$productDetails", 0] }, // Extract the first element of productDetails array
                },
            },
            {
                $group: {
                    _id: "$_id", // Group back by the original order ID
                    userId: { $first: "$userId" },
                    shippingAddress: { $first: "$shippingAddress" },
                    paymentDetails: { $first: "$paymentDetails" },
                    totalAmount: { $first: "$totalAmount" },
                    shippingFee: { $first: "$shippingFee" },
                    tax: { $first: "$tax" },
                    orderStatus: { $first: "$orderStatus" },
                    products: {
                        $push: {
                            product: "$products.product",
                            quantity: "$products.quantity",
                            productOrderStatus: "$products.productOrderStatus",
                            productDetails: "$productDetails",
                        },
                    },
                },
            },
            {
                $project: {
                    _id: 1,
                    userId: 1,
                    shippingAddress: 1,
                    paymentDetails: 1,
                    totalAmount: 1,
                    shippingFee: 1,
                    tax: 1,
                    orderStatus: 1,
                    products: {
                        $map: {
                            input: "$products",
                            as: "prod",
                            in: {
                                product: "$$prod.product",
                                quantity: "$$prod.quantity",
                                productName: "$$prod.productDetails.title",
                                productPrice: "$$prod.productDetails.productPrice",
                                productImage: { $arrayElemAt: ["$$prod.productDetails.images", 0] },
                                sellerId: "$$prod.productDetails.sellerId",
                            },
                        },
                    },
                },
            },
        ]);

        if (!order || order.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        const [finalOrder] = order; // Extract the first (and only) order from the result

        // Authorization check
        let isAuthorized = false;

        if (user) {
            // For users, check if the userId matches the order's userId
            isAuthorized = finalOrder.userId.equals(new mongoose.Types.ObjectId(id));
        } else if (seller) {
            // For sellers, check if any product in the order belongs to the seller
            isAuthorized = finalOrder.products.some((product) =>
                product.sellerId.equals(new mongoose.Types.ObjectId(id))
            );
        }

        if (!isAuthorized) {
            return res.status(403).json({ error: "Unauthorized: You do not have access to this order" });
        }

        // Filter products for sellers
        if (seller) {
            finalOrder.products = finalOrder.products.filter((product) =>
                product.sellerId.equals(new mongoose.Types.ObjectId(id))
            );
        }

        res.json({ message: "Order fetched successfully", order: finalOrder });
    } catch (error) {
        console.error("Error fetching order:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};