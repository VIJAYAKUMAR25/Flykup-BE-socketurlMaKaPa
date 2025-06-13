import ProductListing from "../models/productListing.model.js";
import Seller from "../models/seller.model.js";
import Stock from "../models/stock.model.js";
import Show from "../models/shows.model.js";
import mongoose from "mongoose";

// create product
export const createProductListing = async (req, res) => {
  const { sellerId } = req.params;
  const data = req.body;

  try {
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res
        .status(404)
        .json({ status: false, message: "Seller not found" });
    }

    // create a new product listing document
    const productData = { ...data, sellerId };
    const newProductListing = new ProductListing(productData);
    const savedProductListing = await newProductListing.save();

    // create corresponding stock document
    const createdStock = new Stock({
      sellerId,
      productListingId: savedProductListing._id,
      title: savedProductListing.title,
      quantity: savedProductListing.quantity,
      images: savedProductListing.images,
    });

    await createdStock.save();

    // update productListing with stockId
    savedProductListing.stockId = createdStock._id;
    await savedProductListing.save();

    // re-fetch the updated product to send in response
    const updatedProductListing = await ProductListing.findById(
      savedProductListing._id
    );

    res.status(201).json({
      status: true,
      message: "Product created successfully !",
      data: updatedProductListing,
    });
  } catch (error) {
    console.error("Error in createProductListing:", error.message);
    res.status(500).json({
      status: false,
      message: "Internal server Error.",
    });
  }
};

// Get Product by id
export const getProductById = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await ProductListing.findById(id);
    if (!product) {
      return res
        .status(404)
        .json({ status: false, message: "product not found" });
    }
    res
      .status(200)
      .json({
        status: true,
        message: "product fetched successfully!",
        data: product,
      });
  } catch (error) {
    console.error("Error in getProductById:", error.message);
    res.status(500).json({ status: false, message: "Internal server Error." });
  }
};

//Get all Products
export const getAllProductListing = async (req, res) => {
  try {
    const allProducts = await ProductListing.find().sort({ createdAt: -1 });
    res
      .status(200)
      .json({
        status: true,
        message: "all products fetched successfully!",
        data: allProducts || [],
      });
  } catch (error) {
    console.error("Error in getAllProductListing:", error.message);
    res.status(500).json({ status: false, message: "Internal server Error." });
  }
};

// Get Product(s) by seller id
export const getProductBySellerId = async (req, res) => {
  const { sellerId } = req.params;
  try {
    const seller = await Seller.findById(sellerId);

    if (!seller) {
      return res
        .status(404)
        .json({ status: false, message: "Seller not found" });
    }

    const sellerProducts = await ProductListing.find({ sellerId }).sort({
      createdAt: -1,
    });
    res
      .status(200)
      .json({
        status: true,
        message: "seller's product's fetched successfully!",
        data: sellerProducts || [],
      });
  } catch (error) {
    console.error("Error in getProductBySellerId:", error.message);
    res.status(500).json({ status: false, message: "Internal server Error." });
  }
};

// Update product by Id
export const updateProductById = async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    // update the product and return the updated document
    const updatedProduct = await ProductListing.findByIdAndUpdate(id, data, {
      new: true,
    });

    if (!updatedProduct) {
      return res
        .status(404)
        .json({ status: false, message: "product not found." });
    }

    // update the title in the stock
    const stock = await Stock.findOne({ productListingId: updatedProduct._id });
    if (stock) {
      stock.title = updatedProduct.title;
      await stock.save();
    }

    res.status(200).json({
      status: true,
      message: "product updated successfully!",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Error in updateProductById:", error.message);
    res.status(500).json({ status: false, message: "Internal server Error." });
  }
};
