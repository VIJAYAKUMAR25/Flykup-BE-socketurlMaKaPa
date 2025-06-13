import express from 'express';
import {
    getOrCreateCart,
    addProductToCart,
    updateProductQuantity,
    updateCart,
    removeProductFromCart,
    clearCart
} from '../controllers/cart.controller.js';
import { userAuth } from '../middlewares/auth.js';

// Optionally, import your authentication middleware here
// import requireAuth from '../middlewares/requireAuth.js';

const router = express.Router();

// Uncomment this line if you're protecting the routes
// router.use(requireAuth);

// Get or create a cart for the current user
router.get('/', getOrCreateCart);

// Add a product to the cart
router.post('/add', addProductToCart);

// Updated cart
router.put('/update', updateCart);

// Update the quantity of a product in the cart
router.put('/update-product', updateCart);

// Remove a product from the cart (using productId from URL parameter)
router.delete('/remove/:productId', removeProductFromCart);

// Clear the entire cart for the user
router.delete('/clear', clearCart);

export default router;
