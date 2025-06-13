import Cart from '../models/cart.model.js';
import Product from '../models/productListing.model.js'; // Assuming you have a Product model

// Get or create a cart for the user provided in the request bod
export const getOrCreateCart = async (req, res) => {
    try {
        // For GET requests, extract userId from query parameters
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required as a query parameter.' });
        }

        // Find the cart by userId
        let cart = await Cart.findOne({ user: userId })
            .populate('products.product') // Populate the 'product' field with product details
        // .populate('user'); // Populate the 'user' field with user details

        if (!cart) {
            // If no cart exists, create a new one
            cart = new Cart({ user: userId, products: [] });
            await cart.save();
        }

        // Return the populated cart
        res.status(200).json(cart);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error while fetching cart.' });
    }
};


// Add a product to the cart using the userId from the request body
export const addProductToCart = async (req, res) => {
    try {
        const { userId, productId, quantity } = req.body;
        if (!userId || !productId) {
            return res.status(400).json({ error: 'User ID and Product ID are required in the request body.' });
        }

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, products: [] });
        }

        // Check if product already exists in the cart
        const productIndex = cart.products.findIndex(
            (item) => item.product.toString() === productId
        );
        if (productIndex > -1) {
            // Update quantity if the product is already in the cart
            cart.products[productIndex].quantity += quantity || 1;
        } else {
            // Add new product to the cart
            cart.products.push({ product: productId, quantity: quantity || 1 });
        }
        await cart.save();
        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json({ error: 'Error adding product to cart.' });
    }
};

// Update product quantity in the cart using the userId from the request body
export const updateProductQuantity = async (req, res) => {
    try {
        const { userId, productId, quantity } = req.body;
        if (!userId || !productId) {
            return res.status(400).json({ error: 'User ID and Product ID are required in the request body.' });
        }
        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found.' });
        }
        const productIndex = cart.products.findIndex(
            (item) => item.product.toString() === productId
        );
        if (productIndex === -1) {
            return res.status(404).json({ error: 'Product not found in cart.' });
        }
        // If quantity is 0 or less, remove the product from the cart
        if (quantity <= 0) {
            cart.products.splice(productIndex, 1);
        } else {
            cart.products[productIndex].quantity = quantity;
        }
        await cart.save();
        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json({ error: 'Error updating product quantity.' });
    }
};

// Remove a product from the cart using the userId from the request body
export const removeProductFromCart = async (req, res) => {
    try {
        // Expect userId to be passed in the body and productId in the URL params
        const { userId } = req.body;
        const { productId } = req.params;
        if (!userId || !productId) {
            return res.status(400).json({ error: 'User ID and Product ID are required.' });
        }
        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found.' });
        }
        cart.products = cart.products.filter(
            (item) => item.product.toString() !== productId
        );
        await cart.save();
        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json({ error: 'Error removing product from cart.' });
    }
};

// Clear the entire cart for the user provided in the request body
export const clearCart = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required in the request body.' });
        }
        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found.' });
        }
        cart.products = [];
        await cart.save();
        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json({ error: 'Error clearing cart.' });
    }
};

export const updateCart = async (req, res) => {
    try {
        const { userId, cart } = req.body; // Expecting userId and cart data in the request body
        if (!userId || !cart) {
            return res.status(400).json({ error: 'User ID and cart data are required in the request body.' });
        }

        // Find the cart for the user
        let existingCart = await Cart.findOne({ user: userId });
        if (!existingCart) {
            return res.status(404).json({ error: 'Cart not found for the user.' });
        }

        // Update the cart's products array with product._id and quantity
        existingCart.products = cart.products.map((item) => ({
            product: item.product, // Use only product._id
            quantity: item.quantity,
        }));

        // Save the updated cart
        await existingCart.save();

        // Populate the products.product field to include full product details
        existingCart = await existingCart.populate('products.product');

        res.status(200).json(existingCart); // Respond with the populated, updated cart
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error updating the cart.' });
    }
};
