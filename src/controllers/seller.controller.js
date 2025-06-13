import Inventory from "../models/inventory.model.js";
import Seller from "../models/seller.model.js";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import {
  sendApplicationAccepted,
  sendApplicationRejected,
} from "../email/send.js";
import InventoryHistory from "../models/inventoryHistory.model.js";

export const getAllPendingRequests = async (req, res) => {
  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || 50;
  limit = limit > 50 ? 50 : limit;
  let skip = (page - 1) * limit;

  // search query 
  const searchQuery = req.query.search || "";
  let searchFilter = {};

  if(searchQuery){
    searchFilter = {
      $or: [
        { "basicInfo.name": { $regex: searchQuery, $options: "i"}},
        { "basicInfo.phone": { $regex: searchQuery, $options: "i"}},
        { "basicInfo.email": { $regex: searchQuery, $options: "i"}},
        { "basicInfo.gstNumber": { $regex: searchQuery, $options: "i"}},
        { "aadharInfo.aadharNumber": { $regex: searchQuery, $options: "i"}}
      ]
    }
  }
  try {

    const filter = {
      approvalStatus: 'pending',
      ...searchFilter
    }

    // seller type filtering

    const sellerType = req.query.filterSellerType || 'all';
    if(sellerType !== 'all'){
      filter["basicInfo.businessType"] = sellerType;
    }

    const totalCount = await Seller.countDocuments(filter);

    const pendingSellerRequests = await Seller.find(filter)
    .populate("userInfo", "name emailId userName")
    .sort({createdAt: -1})
    .skip(skip)
    .limit(limit)
    .lean();


    res.status(200).json({
      status: true,
      message: 'pending seller requests fetched successfully!',
      data: pendingSellerRequests || [],
      totalCount
    });
  } catch (error) {
    console.error("Error fetching pending sellers:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const getAllSellers = async (req, res) => {
  try {
    const sellers = await Seller.find();
    res.status(200).json({
      status: true,
      data: sellers,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      data: "Internal Server Error",
    });
  }
};

export const reviewBecomeSellerRequest = async (req, res) => {
  const { sellerId, approvalStatus, rejectedReason } = req.body;

  try {
    const seller = await Seller.findById(sellerId);

    if (!seller) {
      return res.status(404).json({
        status: false,
        message: "seller request not found.",
      });
    }

    const user = await User.findById(seller.userInfo);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "user data not found.",
      });
    }

    if (approvalStatus === "approved" || approvalStatus === "rejected") {
      seller.approvalStatus = approvalStatus;

      if (approvalStatus === "rejected" && rejectedReason) {
        seller.rejectedReason = rejectedReason;

        // application rejected email
        sendApplicationRejected(
          user.emailId,
          user.userName,
          rejectedReason
        ).catch((error) =>
          console.error("Error sending welcome email:", error.message)
        );
      } else if (approvalStatus === "approved") {
        seller.rejectedReason = null;

        user.role = "seller";
        await user.save();

        // application approved email
        sendApplicationAccepted(user.emailId, user.userName).catch((error) =>
          console.error("Error sending welcome email:", error.message)
        );
      }

      await seller.save();

      return res.status(200).json({
        status: true,
        message: `Seller request has been ${approvalStatus}.`,
      });
    } else {
      return res.status(400).json({
        status: false,
        message: "Invalid approval status. Use 'approved' or 'rejected'.",
      });
    }
  } catch (error) {
    console.error("Error in reviewBecomeSellerRequest:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

// inventory related

export const createInventory = async (req, res) => {
  const {
    sellerId,
    inventoryName,
    description,
    expiryDate,
    totalQuantity,
    lowLevelThreshold,
    inventoryType,
    inventory,
  } = req.body;

  try {
    const seller = await Seller.findById(sellerId).populate("userInfo");
    if (!seller) {
      return res.status(404).json({
        status: false,
        message: "Seller not found.",
      });
    }

    if (seller.userInfo.role !== "seller") {
      return res.status(403).json({
        status: false,
        message: "Can't add inventory. You're not a seller.",
      });
    }

    if (
      ![
        "quantity",
        "colorQuantity",
        "sizeQuantity",
        "sizeColorQuantity",
      ].includes(inventoryType)
    ) {
      return res.status(400).json({
        status: false,
        message: "Invalid inventory type provided.",
      });
    }

    let calculatedTotalQuantity = 0;

    if (inventoryType === "quantity") {
      calculatedTotalQuantity = Number(totalQuantity);

      if (inventory && inventory.length > 0) {
        return res.status(400).json({
          status: false,
          message:
            "No inventory details should be provided for 'quantity' type.",
        });
      }
    } else {
      if (!Array.isArray(inventory) || inventory.length === 0) {
        return res.status(400).json({
          status: false,
          message: `Inventory data is required for inventory type '${inventoryType}'.`,
        });
      }

      for (const item of inventory) {
        if (inventoryType === "sizeColorQuantity") {
          if (!item.color || !Array.isArray(item.sizes)) {
            return res.status(400).json({
              status: false,
              message:
                "Color and sizes are required for inventory type 'sizeColorQuantity'.",
            });
          }
          for (const sizeItem of item.sizes) {
            sizeItem.quantity = Number(sizeItem.quantity);
            calculatedTotalQuantity += sizeItem.quantity;
          }
        } else {
          item.quantity = Number(item.quantity);
          if (inventoryType === "colorQuantity" && !item.color) {
            return res.status(400).json({
              status: false,
              message: "Color is required for inventory type 'colorQuantity'.",
            });
          }
          if (inventoryType === "sizeQuantity" && !item.size) {
            return res.status(400).json({
              status: false,
              message: "Size is required for inventory type 'sizeQuantity'.",
            });
          }
          calculatedTotalQuantity += item.quantity;
        }
      }
    }

    const newInventory = new Inventory({
      sellerInfo: sellerId,
      inventoryName,
      description,
      expiryDate,
      totalQuantity: calculatedTotalQuantity,
      lowLevelThreshold,
      inventoryType,
      inventory: inventoryType === "quantity" ? [] : inventory,
    });

    await newInventory.save();

    const now = new Date();
    let historyEntries = [];

    switch (newInventory.inventoryType) {
      case "quantity":
        historyEntries.push({
          date: now,
          quantity: newInventory.totalQuantity,
        });
        break;
      case "sizeQuantity":
        newInventory.inventory.forEach((item) => {
          historyEntries.push({
            date: now,
            size: item.size,
            quantity: item.quantity,
          });
        });
        break;
      case "colorQuantity":
        newInventory.inventory.forEach((item) => {
          historyEntries.push({
            date: now,
            color: item.color,
            quantity: item.quantity,
          });
        });
        break;
      case "sizeColorQuantity":
        newInventory.inventory.forEach((colorItem) => {
          colorItem.sizes.forEach((sizeItem) => {
            historyEntries.push({
              date: now,
              color: colorItem.color,
              size: sizeItem.size,
              quantity: sizeItem.quantity,
            });
          });
        });
        break;
      default:
        return res.status(400).json({
          status: false,
          message: "Invalid inventory type.",
        });
    }

    const inventoryHistory = new InventoryHistory({
      inventoryInfo: newInventory._id,
      totalQuantity: newInventory.totalQuantity,
      availableQuantity: newInventory.totalQuantity,
      history: historyEntries,
    });

    await inventoryHistory.save();

    return res.status(201).json({
      status: true,
      message: "Inventory created successfully.",
      data: newInventory,
    });
  } catch (error) {
    console.error("Error in Add Inventory:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const getAllInventories = async (req, res) => {
  try {
    const inventories = await Inventory.find().sort({ createdAt: -1 });
    return res.status(200).json({
      status: true,
      message: "Inventories fetched successfully.",
      data: inventories,
    });
  } catch (error) {
    console.error("Error in Get All Inventories:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const getInventoryById = async (req, res) => {
  const { inventoryId } = req.params;

  try {
    const inventory = await Inventory.findById(inventoryId);

    if (!inventory) {
      return res.status(404).json({
        status: false,
        message: "Inventory not found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Inventory fetched successfully.",
      data: inventory,
    });
  } catch (error) {
    console.error("Error in Get Inventory by ID:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const getInventoriesBySellerId = async (req, res) => {
  const { sellerId } = req.params;

  try {
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({
        status: false,
        message: "Seller not found.",
      });
    }

    const inventories = await Inventory.find({ sellerInfo: sellerId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      status: true,
      message: "Inventories fetched successfully.",
      data: inventories || [],
    });
  } catch (error) {
    console.error("Error in Get Inventories by Seller ID:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const deleteInventoryById = async (req, res) => {
  const { inventoryId } = req.params;

  try {
    const inventory = await Inventory.findByIdAndDelete(inventoryId);
    if (!inventory) {
      return res.status(404).json({
        status: false,
        message: "Inventory not found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Inventory deleted successfully.",
      data: inventory,
    });
  } catch (error) {
    console.error("Error in Delete Inventory by ID:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const updateInventoryById = async (req, res) => {
  const { inventoryId } = req.params;
  const {
    inventoryName,
    description,
    expiryDate,
    addMoreQuantity,
    lowLevelThreshold,
    inventory: updatedInventory,
  } = req.body;

  try {
    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) {
      return res.status(404).json({
        status: false,
        message: "Inventory not found.",
      });
    }

    // Update top-level fields
    if (inventoryName) inventory.inventoryName = inventoryName;
    if (description) inventory.description = description;
    if (expiryDate) inventory.expiryDate = expiryDate;
    if (lowLevelThreshold !== undefined)
      inventory.lowLevelThreshold = lowLevelThreshold;
    if(addMoreQuantity) inventory.addMoreQuantity = addMoreQuantity;

    // Merge updatedInventory into existing inventory based on type
    if (updatedInventory !== undefined) {
      switch (inventory.inventoryType) {
        case "colorQuantity":
          for (const reqItem of updatedInventory) {
            const existingItem = inventory.inventory.find(
              (item) => item.color === reqItem.color
            );
            if (existingItem) {
              existingItem.addMoreQuantity = reqItem.addMoreQuantity || 0;
            }
          }
          break;

        case "sizeQuantity":
          for (const reqItem of updatedInventory) {
            const existingItem = inventory.inventory.find(
              (item) => item.size === reqItem.size
            );
            if (existingItem) {
              existingItem.addMoreQuantity = reqItem.addMoreQuantity || 0;
            }
          }
          break;

        case "sizeColorQuantity":
          for (const reqColorItem of updatedInventory) {
            const existingColorItem = inventory.inventory.find(
              (item) => item.color === reqColorItem.color
            );
            if (existingColorItem) {
              for (const reqSizeItem of reqColorItem.sizes) {
                const existingSizeItem = existingColorItem.sizes.find(
                  (size) => size.size === reqSizeItem.size
                );
                existingSizeItem.addMoreQuantity =
                  reqSizeItem.addMoreQuantity || 0;
              }
            }
          }
          break;

        case "quantity":
          break;

        default:
          return res.status(400).json({
            status: false,
            message: "Invalid inventory type.",
          });
      }
    }

    let newTotalQuantity = 0;
    let historyEntries = [];
    let totalAddedQty = 0;
    const now = new Date();

    // Handle quantity updates based on inventory type
    switch (inventory.inventoryType) {
      case "quantity": {
        const addedQty = Number(inventory.addMoreQuantity || 0);

        inventory.totalQuantity = Number(inventory.totalQuantity) + addedQty;
        inventory.addMoreQuantity = 0;

        // Only create history if addedQty is non-zero
        if (addedQty !== 0) {
          historyEntries.push({
            date: now,
            quantity: addedQty,
          });
          totalAddedQty += addedQty;
        }
        break;
      }

      case "colorQuantity":
        for (const item of inventory.inventory) {
          const addedQty = Number(item.addMoreQuantity || 0);

          item.quantity = Number(item.quantity) + addedQty;
          item.addMoreQuantity = 0;
          newTotalQuantity += item.quantity;

          if (addedQty !== 0) {
            historyEntries.push({
              date: now,
              color: item.color,
              quantity: addedQty,
            });
            totalAddedQty += addedQty;
          }
        }
        inventory.totalQuantity = newTotalQuantity;
        break;

      case "sizeQuantity":
        for (const item of inventory.inventory) {
          const addedQty = Number(item.addMoreQuantity || 0);

          item.quantity = Number(item.quantity) + addedQty;
          item.addMoreQuantity = 0;
          newTotalQuantity += item.quantity;

          if (addedQty !== 0) {
            historyEntries.push({
              date: now,
              size: item.size,
              quantity: addedQty,
            });
            totalAddedQty += addedQty;
          }
        }
        inventory.totalQuantity = newTotalQuantity;
        break;

      case "sizeColorQuantity":
        for (const colorItem of inventory.inventory) {
          for (const size of colorItem.sizes) {
            const addedQty = Number(size.addMoreQuantity || 0);

            size.quantity = Number(size.quantity) + addedQty;
            size.addMoreQuantity = 0;
            newTotalQuantity += size.quantity;

            if (addedQty !== 0) {
              historyEntries.push({
                date: now,
                color: colorItem.color,
                size: size.size,
                quantity: addedQty,
              });
              totalAddedQty += addedQty;
            }
          }
        }
        inventory.totalQuantity = newTotalQuantity;
        break;

      default:
        return res.status(400).json({
          status: false,
          message: "Invalid inventory type.",
        });
    }

    await inventory.save();

    // Update inventory history
    if (historyEntries.length > 0) {
      let inventoryHistory = await InventoryHistory.findOne({
        inventoryInfo: inventoryId,
      });

      if (!inventoryHistory) {
        inventoryHistory = new InventoryHistory({
          inventoryInfo: inventoryId,
          totalQuantity: 0,
          history: [],
        });
      }

      inventoryHistory.history.push(...historyEntries);
      inventoryHistory.totalQuantity += totalAddedQty;
      await inventoryHistory.save();
    }

    // Update the associated product
    const product = await Product.findOne({ inventoryInfo: inventory._id });
    if (product) {
      // quantity type
      product.totalQuantity = inventory.totalQuantity;

      switch (inventory.inventoryType) {
        case "colorQuantity":
          for (const item of inventory.inventory) {
            const productItem = product.additionalInfo.find(
              (pItem) => pItem.color === item.color
            );
            if (productItem) {
              productItem.quantity = item.quantity;
            }
          }
          break;

        case "sizeQuantity":
          for (const item of inventory.inventory) {
            const productItem = product.additionalInfo.find(
              (pItem) => pItem.size === item.size
            );
            if (productItem) {
              productItem.quantity = item.quantity;
            }
          }
          break;

        case "sizeColorQuantity":
          for (const colorItem of inventory.inventory) {
            const productColorItem = product.additionalInfo.find(
              (pItem) => pItem.color === colorItem.color
            );
            if (productColorItem) {
              for (const size of colorItem.sizes) {
                const productSize = productColorItem.sizes.find(
                  (pSize) => pSize.size === size.size
                );
                if (productSize) {
                  productSize.quantity = size.quantity;
                }
              }
            }
          }
          break;
      }

      await product.save();
    }

    return res.status(200).json({
      status: true,
      message: "Inventory updated successfully.",
      data: inventory,
    });
  } catch (error) {
    console.error("Error in updateInventoryById:", error.message);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

export const toggleInventoryStatus = async (req, res) => {
  try {
    const { inventoryId } = req.params;

    const inventory = await Inventory.findById(inventoryId);

    if (!inventory) {
      return res
        .status(404)
        .json({ status: false, message: "Inventory not found" });
    }

    inventory.isActive = !inventory.isActive;
    await inventory.save();

    return res.status(200).json({
      status: true,
      message: `Inventory is ${
        inventory.isActive ? "enabled" : "disabled"
      } successfully`,
    });
  } catch (error) {
    console.error("Error from toggleInventoryStatus", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error, Please try again later.",
    });
  }
};

// product related api

export const createProduct = async (req, res) => {
  const {
    sellerInfo,
    inventoryInfo,
    productName,
    description,
    category,
    subCategory,
    totalQuantity,
    actualPrice,
    sellingPrice,
    photoUrl,
    videoUrl,
    additionalInfo,
    productWeight,
  } = req.body;

  try {
    const seller = await Seller.findById(sellerInfo);
    if (!seller) {
      return res
        .status(404)
        .json({ status: false, message: "Seller not found." });
    }

    const inventory = await Inventory.findById(inventoryInfo);
    if (!inventory) {
      return res
        .status(404)
        .json({ status: false, message: "Inventory not found." });
    }

    const existingProduct = await Product.findOne({ inventoryInfo });
    if (existingProduct) {
      return res
        .status(400)
        .json({ status: false, message: "product exists!" });
    }

    // marked product listed in inventory
    inventory.isProductListed = true;
    await inventory.save();

    const productType = inventory.inventoryType;
    let calculatedTotalQuantity = 0;

    if (productType === "quantity") {
      if (additionalInfo && additionalInfo.length > 0) {
        return res.status(400).json({
          status: false,
          message: "No additionalInfo allowed for 'quantity' type",
        });
      }
    } else {
      if (!Array.isArray(additionalInfo) || additionalInfo.length === 0) {
        return res.status(400).json({
          status: false,
          message: `additionalInfo required for product type '${productType}'`,
        });
      }

      for (const item of additionalInfo) {
        if (productType === "sizeColorQuantity") {
          if (!item.color || !Array.isArray(item.sizes)) {
            return res.status(400).json({
              status: false,
              message: "Color and sizes required for sizeColorQuantity type",
            });
          }
          for (const size of item.sizes) {
            size.quantity = Number(size.quantity);
            calculatedTotalQuantity += size.quantity;
          }
        } else {
          item.quantity = Number(item.quantity);
          if (productType === "colorQuantity" && !item.color) {
            return res.status(400).json({
              status: false,
              message: "Color required for colorQuantity type",
            });
          }
          if (productType === "sizeQuantity" && !item.size) {
            return res.status(400).json({
              status: false,
              message: "Size required for sizeQuantity type",
            });
          }
          calculatedTotalQuantity += item.quantity;
        }
      }
    }

    const newProduct = new Product({
      sellerInfo,
      inventoryInfo,
      productName,
      productType,
      description,
      category,
      subCategory,
      totalQuantity:
        productType === "quantity" ? totalQuantity : calculatedTotalQuantity,
      actualPrice,
      sellingPrice,
      photoUrl,
      videoUrl,
      additionalInfo: productType === "quantity" ? [] : additionalInfo,
      productWeight,
    });

    const savedProduct = await newProduct.save();

    return res.status(201).json({
      status: true,
      message: "Product created successfully.",
      data: savedProduct,
    });
  } catch (error) {
    console.error("Error in Add Product:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const toggleProductStatus = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);

    if (!product) {
      return res
        .status(404)
        .json({ status: false, message: "product not found" });
    }

    product.isActive = !product.isActive;
    await product.save();

    return res.status(200).json({
      status: true,
      message: `Product is ${
        product.isActive ? "enabled" : "disabled"
      } successfully`,
    });
  } catch (error) {
    console.error("Error from toggleProductStatus", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error, Please try again later.",
    });
  }
};

export const editProduct = async (req, res) => {
  const { productId } = req.params;
  const {
    productName,
    description,
    category,
    subCategory,
    quantity,
    actualPrice,
    sellingPrice,
    photoUrl,
    videoUrl,
    productWeight,
  } = req.body;

  try {
    const existingProduct = await Product.findById(productId);

    if (!existingProduct) {
      return res.status(404).json({
        status: false,
        message: "Product not found.",
      });
    }

    if (productName) existingProduct.productName = productName;
    if (description) existingProduct.description = description;
    if (category) existingProduct.category = category;
    if (subCategory) existingProduct.subCategory = subCategory;
    if (quantity) existingProduct.quantity = quantity;
    if (actualPrice) existingProduct.actualPrice = actualPrice;
    if (sellingPrice) existingProduct.sellingPrice = sellingPrice;
    if (photoUrl) existingProduct.photoUrl = photoUrl;
    if (videoUrl) existingProduct.videoUrl = videoUrl;
    if (productWeight) existingProduct.productWeight = productWeight;

    const updatedProduct = await existingProduct.save();

    return res.status(200).json({
      status: true,
      message: "Product updated successfully.",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Error in Update Product:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .populate({ path: "sellerInfo", select: "basicInfo" });

    return res.status(200).json({
      status: true,
      message: "All products fetched successfully.",
      data: products || [],
    });
  } catch (error) {
    console.error("Error in Get All Products:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const getProductBySellerId = async (req, res) => {
  const { sellerId } = req.params;

  try {
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({
        status: false,
        message: "Seller not found.",
      });
    }

    const products = await Product.find({ sellerInfo: sellerId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      status: true,
      message: "Products fetched successfully by Seller ID.",
      data: products || [],
    });
  } catch (error) {
    console.error("Error in Get Products by Seller ID:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const getProductById = async (req, res) => {
  const { productId } = req.params;

  try {
    const product = await Product.findById(productId).populate({
      path: "sellerInfo",
      select: "basicInfo",
    });

    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Product fetched successfully.",
      data: product,
    });
  } catch (error) {
    console.error("Error in Get Product by ID:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const deleteProductById = async (req, res) => {
  const { productId } = req.params;

  try {
    const deletedProduct = await Product.findByIdAndDelete(productId);

    if (!deletedProduct) {
      return res.status(404).json({
        status: false,
        message: "Product not found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Product deleted successfully.",
      data: deletedProduct,
    });
  } catch (error) {
    console.error("Error in Delete Product by ID:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

// admin panel related

export const createSeller = async (req, res) => {
  const { userInfo, basicInfo, aadharInfo, addressInfo } = req.body;

  try {
    // Check if the user exists
    const user = await User.findById(userInfo);
    if (!user) {
      return res.status(404).json({
        status: false,
        data: "User not found",
      });
    }

    // Check if the seller request already exists for the user
    const existingDetails = await Seller.findOne({ userInfo: userInfo });
    if (existingDetails) {
      return res.status(400).json({
        status: false,
        data: "Existing! Can't send request again.",
      });
    }

    // If officeAddress is provided and sameAsOffice is true, set homeAddress to officeAddress
    if (addressInfo.officeAddress && addressInfo.sameAsOffice) {
      addressInfo.homeAddress = { ...addressInfo.officeAddress };
    }

    // Create a new seller request
    const newRequest = new Seller({
      userInfo: userInfo,
      basicInfo,
      aadharInfo,
      addressInfo,
      approvalStatus: "approved", // Default status
    });

    await newRequest.save();

    // Update the user's sellerInfo reference
    user.sellerInfo = newRequest._id;
    await user.save();

    return res.status(201).json({
      status: true,
      data: "Seller created successfully",
      seller: newRequest,
    });
  } catch (error) {
    console.error("Error in createSeller:", error.message);
    return res.status(500).json({
      status: false,
      data: "Internal Server Error. Please try again later.",
    });
  }
};

// Get a seller by ID
export const getSellerById = async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id).populate("userInfo");
    if (!seller) {
      return res.status(404).send();
    }
    res.send(seller);
  } catch (error) {
    res.status(500).send(error);
  }
};

// get all approved sellers
export const getAllApprovedSellers = async (req, res) => {
  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || 50;
  limit = limit > 50 ? 50 : limit;
  let skip = (page - 1) * limit;

  // search query
  const searchQuery = req.query.search || "";
  let searchFilter = {};

  if (searchQuery) {
    searchFilter = {
      $or: [
        { "basicInfo.name": { $regex: searchQuery, $options: "i"}},
        { "basicInfo.phone": { $regex: searchQuery, $options: "i"}},
        { "basicInfo.email": { $regex: searchQuery, $options: "i"}},
        { "basicInfo.gstNumber": { $regex: searchQuery, $options: "i"}},
        { "aadharInfo.aadharNumber": { $regex: searchQuery, $options: "i"}}
      ],
    };
  }
  try {
    const filter = {
      approvalStatus: "approved",
      ...searchFilter,
    };

    // seller type filtering
    const sellerType = req.query.filterSellerType || 'all';
    if(sellerType !== 'all'){
      filter["basicInfo.businessType"] = sellerType;
    }

    const totalCount = await Seller.countDocuments(filter);

    const approvedSellers = await Seller.find(filter)
      .populate({path: "userInfo", select: "accessAllowed userName emailId"})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();    

    return res
      .status(200)
      .json({ status: true, message:"all sellers fetched successfully!", data: approvedSellers || [], totalCount });
  } catch (error) {
    console.error("Error in getAllApprovedSellers:", error.message);
    return res
      .status(500)
      .json({
        status: false,
        message: "Internal server error. Please try again later.",
      });
  }
};

// Update a seller by ID
export const updateSeller = async (req, res) => {
  const payload = req.body; // Get the payload from the request body

  try {
    // Find the seller by ID and update it with the payload
    const seller = await Seller.findByIdAndUpdate(req.params.id, payload, {
      new: true, // Return the updated document
      runValidators: true, // Run schema validators on the update
    });

    // If no seller is found, return a 404 error
    if (!seller) {
      return res.status(404).send({ error: "Seller not found" });
    }

    // Send the updated seller as the response
    res.send(seller);
  } catch (error) {
    // Handle any errors (e.g., validation errors)
    res.status(400).send(error);
  }
};

// Delete a seller by ID
export const deleteSeller = async (req, res) => {
  const { id } = req.params;

  try {
    const seller = await Seller.findById(id);

    if (!seller) {
      return res
        .status(404)
        .json({ status: false, message: "Seller not found" });
    }

    const user = await User.findById(seller.userInfo);

    if (user) {
      user.role = "user";
      await user.save();
    }

    await Seller.findByIdAndDelete(id);

    return res
      .status(200)
      .json({ status: true, message: "Seller deleted successfully" });
  } catch (error) {
    console.error("Error in deleteSeller:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

// allow or restrict seller access
export const toggleSellerAccessAdmin = async (req,res) => {
  const { sellerId } = req.params;
  const { accessAllowed } = req.body;
  try {
    const user = await User.findOne({sellerInfo: sellerId});

    if(!user){
      return res.status(404).json({ status: false, message:"user data not found"});
    }

    user.accessAllowed = accessAllowed;
    await user.save();

    return res.status(200).json({
      status: true,
      message:`seller access is ${accessAllowed ? "enabled." : "disabled."}`
    })
  } catch (error) {
    console.error("Error in sellerAccessToggle:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later."
    });
  }
}

