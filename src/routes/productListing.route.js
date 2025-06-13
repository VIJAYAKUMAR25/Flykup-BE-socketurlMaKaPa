import Express from 'express';
import { createProductListing, getAllProductListing, getProductById, getProductBySellerId, updateProductById } from '../controllers/productListing.controller.js';


const productListingRouter = Express.Router();


productListingRouter.get('/seller/:sellerId', getProductBySellerId);
productListingRouter.get('/:id', getProductById);
productListingRouter.get('/', getAllProductListing);
productListingRouter.put('/:id', updateProductById);
productListingRouter.post('/:sellerId', createProductListing);

export default productListingRouter;

