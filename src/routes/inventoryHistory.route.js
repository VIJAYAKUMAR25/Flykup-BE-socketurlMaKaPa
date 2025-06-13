import Express from 'express';
import { getAllInventoriesHistory, getHistoryByInventoryId } from "../controllers/inventoryHistory.controller.js";

const inventoryHistoryRouter = Express.Router();

// get all inventories history 
inventoryHistoryRouter.get("/",getAllInventoriesHistory);

// get single inventory history
inventoryHistoryRouter.get("/:inventoryId", getHistoryByInventoryId);

export default inventoryHistoryRouter;
