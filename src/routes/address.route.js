import Express from 'express';
import { addAddress, deleteAddress, editAddress, getAddressByUserId, getSingleAddressById, testAmazonSes } from '../controllers/address.controller.js';

const addressRouter = Express.Router();

// testing amazon ses 
addressRouter.post("/ses", testAmazonSes);

// Add a new address
addressRouter.post("/:userId", addAddress);

// Get a single address by addressId (more specific route)
addressRouter.get("/:userId/:addressId", getSingleAddressById);

// Get all addresses for a user (less specific route)
addressRouter.get("/:userId", getAddressByUserId);

// Update a specific address
addressRouter.put("/:userId/:addressId", editAddress);

// Delete a specific address
addressRouter.delete("/:userId/:addressId", deleteAddress);




export default addressRouter;