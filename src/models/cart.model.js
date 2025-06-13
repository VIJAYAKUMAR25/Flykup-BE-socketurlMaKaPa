import mongoose from 'mongoose';

const CartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users', // Reference to the User model
    required: true,
    unique: true // Assuming each user has one cart
  },
  products: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'productlistings', // Reference to the Product model
        required: true
      },
      quantity: {
        type: Number,
        default: 1
      }
    }
  ]
}, { timestamps: true });

const Cart = mongoose.model('carts', CartSchema);

export default Cart;
