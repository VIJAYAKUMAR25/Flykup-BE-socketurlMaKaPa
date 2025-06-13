import Express from 'express';
import { createInventory, createProduct, createSeller, deleteInventoryById, deleteProductById, deleteSeller, editProduct, getAllApprovedSellers, getAllInventories, getAllPendingRequests, getAllProducts, getAllSellers, getInventoriesBySellerId, getInventoryById, getProductById, getProductBySellerId, getSellerById, reviewBecomeSellerRequest, toggleInventoryStatus, toggleProductStatus, toggleSellerAccessAdmin, updateInventoryById, updateSeller } from '../controllers/seller.controller.js';

const sellerRouter = Express.Router();

sellerRouter.get("/all",getAllSellers);
sellerRouter.get("/pending-requests", getAllPendingRequests);
sellerRouter.post("/review-request", reviewBecomeSellerRequest);


// inventory
sellerRouter.post("/inventory/add", createInventory);
sellerRouter.put("/inventory/edit/:inventoryId", updateInventoryById);
sellerRouter.get("/inventory/all", getAllInventories);
sellerRouter.get("/inventory/by-id/:inventoryId", getInventoryById);
sellerRouter.get("/inventory/by-seller/:sellerId", getInventoriesBySellerId);
sellerRouter.delete("/inventory/delete/:inventoryId", deleteInventoryById);
sellerRouter.patch("/inventory/:inventoryId/toggle", toggleInventoryStatus);

/**
 * better naming (RESTful standards) 
// Product Routes
sellerRouter.post("/product", addProduct);
sellerRouter.put("/product/:productId", editProduct);
sellerRouter.get("/product", getAllProducts);
sellerRouter.get("/product/:productId", getProductById);
sellerRouter.get("/product/by-seller/:sellerId", getProductBySellerId);
sellerRouter.delete("/product/:productId", deleteProductById);

// Inventory Routes
sellerRouter.post("/inventory", addInventory);
sellerRouter.put("/inventory/:inventoryId", editInventoryById);
sellerRouter.get("/inventory", getAllInventories);
sellerRouter.get("/inventory/:inventoryId", getInventoryById);
sellerRouter.get("/inventory/by-seller/:sellerId", getInventoriesBySellerId);
sellerRouter.delete("/inventory/:inventoryId", deleteInventoryById);
sellerRouter.patch("/inventory/:inventoryId/toggle", toggleInventoryStatus);

 */


// products
sellerRouter.post("/product/add", createProduct);
sellerRouter.put("/product/edit/:productId", editProduct);
sellerRouter.get("/product/all", getAllProducts);
sellerRouter.get("/product/by-id/:productId", getProductById);
sellerRouter.get("/product/by-seller/:sellerId", getProductBySellerId);
sellerRouter.delete("/product/delete/:productId", deleteProductById);
sellerRouter.patch("/product/:productId/toggle", toggleProductStatus);



// admin panel

// Create a new seller
sellerRouter.post("/create", createSeller);

// Get a single seller by ID
sellerRouter.get("/get/:id", getSellerById);

// get all approved sellers
sellerRouter.get("/all-approved", getAllApprovedSellers);

// Update a seller by ID
sellerRouter.put("/update/:id", updateSeller);

// Delete a seller by ID
sellerRouter.delete("/delete/:id", deleteSeller);

// allow or restrict seller access 
sellerRouter.put("/access/:sellerId", toggleSellerAccessAdmin);



export default sellerRouter;