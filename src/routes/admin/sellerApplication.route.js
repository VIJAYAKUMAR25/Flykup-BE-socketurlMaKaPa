import Express from 'express';
import { pendingApplicationCount } from '../../controllers/admin/sellerApplication.controller.js';


const adminSellerApplicationRouter = Express.Router();

// pending application count
adminSellerApplicationRouter.get("/count", pendingApplicationCount);

export default adminSellerApplicationRouter;