import Express from 'express';
import { approvedSellersCount } from '../../controllers/admin/seller.controller.js';

const adminSellerRouter = Express.Router();

adminSellerRouter.get("/count", approvedSellersCount);

export default adminSellerRouter;