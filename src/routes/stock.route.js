import Express from 'express';
import { getAllStocks, getStockById, getStockBySellerId, updateStockById } from '../controllers/stock.controller.js';

const stockRouter = Express.Router();

stockRouter.put("/:id", updateStockById);
stockRouter.get("/seller/:sellerId", getStockBySellerId);
stockRouter.get("/:id", getStockById);
stockRouter.get("/", getAllStocks);


export default stockRouter;