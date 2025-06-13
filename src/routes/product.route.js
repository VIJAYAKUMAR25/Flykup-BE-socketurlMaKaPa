import Express from 'express';
import { getSellerDetailsByProductId } from '../controllers/product.controller.js';

const productRouter = Express.Router();

productRouter.post("/seller/:productId", getSellerDetailsByProductId);


export default productRouter;