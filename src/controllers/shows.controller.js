import mongoose from "mongoose";
import Seller from "../models/seller.model.js";
import Show from "../models/shows.model.js";
import User from "../models/user.model.js";
import Dropshipper from "../models/shipper.model.js";
import { generateStreamName } from "../utils/helper.js";
import streamingApis from "@api/streaming-apis";
import ProductListing from "../models/productListing.model.js";

const MILLICAST_ACCOUNT_ID = process.env.MILLICAST_ACCOUNT_ID;
const TOKEN_SECRET = process.env.MILLICAST_TOKEN_SECRET;

// Create a new show
export const createShow = async (req, res) => {
  try {
    const {
      title,
      date,
      time,
      category,
      subCategory,
      tags,
      sellerId,
      thumbnailImage,
      previewVideo,
      language,
      isLive,
      auctions,
      buyNowProducts,
      auctionProducts,
      giveawayProducts,
    } = req.body;

    // Validate required fields
    if (!title || !date || !time || !category || !language) {
      return res
        .status(400)
        .json({
          status: false,
          message: "Please provide all required fields.",
        });
    }

    const seller = await Seller.findById(sellerId);

    if (!seller) {
      return res
        .status(404)
        .json({ status: false, message: "seller not found" });
    }

    // helper function to generate random stream name
    const streamName = generateStreamName(seller.basicInfo.name);

    const streamUrl = `https://viewer.millicast.com?streamId=${MILLICAST_ACCOUNT_ID}/${streamName}`;

    // Create the show
    const newShow = new Show({
      title,
      date,
      time,
      category,
      subCategory,
      tags,
      sellerId,
      thumbnailImage,
      previewVideo,
      language,
      isLive,
      streamUrl,
      auctions,
      streamName,
      buyNowProducts,
      auctionProducts,
      giveawayProducts,
    });

    // Save the show to the database
    const savedShow = await newShow.save();
    res
      .status(201)
      .json({
        status: true,
        message: "show created successfully!",
        data: savedShow,
      });
  } catch (error) {
    console.error("Error in createShow:", error.message);
    res.status(500).json({ status: false, message: error.message });
  }
};

// Get all shows
export const getAllShows = async (req, res) => {
  try {
    const shows = await Show.find()
      .populate({
        path: "sellerId",
        select: "userInfo basicInfo", // Select only the `userInfo` field from the moderators
        populate: {
          path: "userInfo", // Populate the `userInfo` field inside moderators
          select: "userName emailId profileURL", // Select specific fields from the userInfo document
        },
      })
      .populate("auctions.bids.user", "userName emailId profileURL");
    res.status(200).json(shows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single show by ID
export const getShowById = async (req, res) => {
  try {
    console.log('--- IP Debug Info ---');
    console.log('req.ip:', req.ip); // This SHOULD show the client IP if trust proxy works
    console.log('req.ips:', req.ips); // Shows array of IPs if trust proxy > 0
    console.log('X-Forwarded-For Header:', req.headers['x-forwarded-for']); // What the proxy sent
    console.log('X-Real-IP Header:', req.headers['x-real-ip']); // Another common header
    console.log('Socket Remote Address:', req.socket.remoteAddress); // Likely the proxy's IP
    console.log('---------------------');
    const show = await Show.findById(req.params.id)
      .populate({
        path: "host", // Populate the 'host' field (dynamic ref via hostModel)
        select: "companyName businessName email userInfo approvalStatus", // Select fields available on Seller OR Dropshipper
        populate: {
          path: "userInfo", // Nested populate: Get user details from Seller/Dropshipper's userInfo field
          select: "userName name emailId profileURL role", // Select desired user fields
        },
      })
      .populate({
        path: "comments.user", // Populate the `user` field inside comments
        select: "userName name emailId profileURL role _id", // Select specific fields from the user document
      }).populate({
        path: "auctionProducts.productId", // Populate the `user` field inside comments
        select: "title description images emailId productType  category quantity role _id", // Select specific fields from the user document
      }).populate({
        path: "giveawayProducts.productId", // Populate the `user` field inside comments
        select: "title description images emailId productType category quantity role _id", // Select specific fields from the user document
      }).populate({
        path: "giveawayProducts.winner", // Populate the `user` field inside comments
        select: "userName name emailId profileURL role _id", // Select specific fields from the user document
      }).populate({
        path: "buyNowProducts.productId", // Populate the `user` field inside comments
        select: "title description images emailId productType category quantity role _id", // Select specific fields from the user document
      }).populate({
        path: "currentAuction.highestBidder", // Populate the `user` field inside comments
        select: "userName name emailId profileURL role _id", // Select specific fields from the user document
      }).populate({
        path: "currentAuction.bidderWon", // Populate the `user` field inside comments
        select: "userName name emailId profileURL role _id", // Select specific fields from the user document
      }).populate({
        path: "auctionProducts.highestBidder", // Populate the `user` field inside comments
        select: "userName name emailId profileURL role _id", // Select specific fields from the user document
      }).populate({
        path: "auctionProducts.bidderWon", // Populate the `user` field inside comments
        select: "userName name emailId profileURL role _id", // Select specific fields from the user document
      });

    if (!show) {
      return res.status(404).json({ message: "Show not found." });
    }

    res.status(200).json(show);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Update a show by ID
export const updateShow = async (req, res) => {
  try {
    const updatedDetails = req.body;

    const updatedShow = await Show.findByIdAndUpdate(
      req.params.id,
      updatedDetails,
      { new: true } // Return the updated document
    );

    if (!updatedShow) {
      return res
        .status(404)
        .json({ status: false, message: "Show not found." });
    }

    res.status(200).json({
      status: true,
      message: "show details updated successfully!",
      data: updatedShow,
    });
  } catch (error) {
    console.error("Error in updateShow:", error.message);
    res.status(500).json({ status: false, message: "Internal server Error" });
  }
};

// Delete a show by ID
export const deleteShow = async (req, res) => {
  try {
    const deletedShow = await Show.findByIdAndDelete(req.params.id);

    if (!deletedShow) {
      return res
        .status(404)
        .json({ status: false, message: "Show not found." });
    }

    res
      .status(200)
      .json({ status: true, message: "Show deleted successfully." });
  } catch (error) {
    console.error("Error in deleteShow:", error.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error." });
  }
};

// get shows by seller
export const getShowsBySeller = async (req, res) => {
  const { id } = req.params;
  try {
    const sellerShows = await Show.find({ sellerId: id });
    return res.status(200).json({
      status: true,
      message: "seller shows fetched successfully!",
      data: sellerShows || [],
    });
  } catch (error) {
    console.error("Error in getShowsBySeller:", error.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal server Error" });
  }
};

// start streaming(start show)
export const startShow = async (req, res) => {
  try {
    const { showId } = req.params;

    const show = await Show.findById(showId);
    if (!show) {
      return res.status(404).json({ status: false, message: "Show not found" });
    }

    // Authenticate before generating the token
    streamingApis.auth(TOKEN_SECRET);

    // Generate the token
    const tokenResponse = await streamingApis.publishTokenV1_CreateToken({
      subscribeRequiresAuth: false,
      record: false,
      clip: false,
      multisource: true,
      enableThumbnails: false,
      displaySrtPassphrase: false,
      lowLatencyRtmp: true,
      streams: [{ isRegex: true, streamName: show.streamName }],
      label: "stream_token",
    });

    const { token } = tokenResponse?.data?.data;

    if (!token) {
      return res
        .status(400)
        .json({ status: false, message: "Token generation failed!" });
    }

    const updatedShow = await Show.findByIdAndUpdate(
      showId,
      {
        isLive: true,
        showStatus: "live",
      },
      { new: true }
    );

    if (!updatedShow) {
      return res.status(404).json({ status: false, message: "Show not found" });
    }

    res.status(200).json({
      status: true,
      message: "Stream started successfully!",
      data: {
        updatedShow,
        token,
      },
    });
  } catch (error) {
    console.error("Error in startStream", error.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error." });
  }
};

// to end show
export const endShow = async (req, res) => {
  try {
    const { showId } = req.params;

    const updatedShow = await Show.findByIdAndUpdate(
      showId,
      { isLive: false, showStatus: "ended" },
      { new: true }
    );

    if (!updatedShow) {
      return res.status(404).json({ status: false, message: "Show not found" });
    }
    res.status(200).json({
      status: true,
      message: "show ended successfully!",
      data: updatedShow,
    });
  } catch (error) {
    console.error("Error in endShow", error.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error." });
  }
};

// to cancel show
export const cancelShow = async (req, res) => {
  try {
    const { showId } = req.params;

    const updatedShow = await Show.findByIdAndUpdate(
      showId,
      { isLive: false, showStatus: "cancelled" },
      { new: true }
    );

    if (!updatedShow) {
      return res.status(404).json({ status: false, message: "Show not found" });
    }
    res.status(200).json({
      status: true,
      message: "show cancelled successfully!",
      data: updatedShow,
    });
  } catch (error) {
    console.error("Error in cancelShow", error.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error." });
  }
};

// get live shows
export const getLiveShows = async (req, res) => {
  try {
    const liveShows = await Show.find({ isLive: true }).sort({ createdAt: -1 });
    return res.status(200).json({
      status: true,
      message: "live shows fetched successfully!",
      data: liveShows || [],
    });
  } catch (error) {
    console.error("Error in getLiveShows", error.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error." });
  }
};

// view show details by id
export const viewShowDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const show = await Show.findById(id);

    if (!show) {
      return res
        .status(404)
        .json({ status: false, message: "Show not found." });
    }

    res.status(200).json({
      status: true,
      message: "show fetched successfully",
      data: show,
    });
  } catch (error) {
    console.error("Error in viewShowDetails", error.message);
    res.status(500).json({ status: false, message: "internal server error." });
  }
};

// get created shows by seller ID (for tagging products)
export const getShowsToTagProducts = async (req, res) => {
  const { sellerId } = req.params;
  try {
    const shows = await Show.find(
      {
        sellerId,
        showStatus: "created",
      },
      "_id streamName title"
    ).lean();

    const formattedShows = shows.map(({ _id, ...rest }) => ({
      showId: _id,
      ...rest,
    }));

    return res.status(200).json({
      status: true,
      message: "shows fetched successfully!",
      data: formattedShows,
    });
  } catch (error) {
    console.error("Error in getShowsToTagProducts:", error.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal Server Error" });
  }
};

// tag product in shows
export const tagProductInShows = async (req, res) => {
  const { taggedShows, taggedProducts, sellerId } = req.body;
  try {
    // Validate inputs
    if (!sellerId) {
      return res
        .status(400)
        .json({ success: false, message: "sellerId is required." });
    }

    if (!Array.isArray(taggedShows) || !Array.isArray(taggedProducts)) {
      return res.status(400).json({
        success: false,
        message:
          "Both taggedShows and taggedProducts must be provided as arrays.",
      });
    }

    // Filter out duplicate products based on productId
    const uniqueTaggedProducts = taggedProducts.reduce((acc, product) => {
      if (
        !acc.some(
          (item) => String(item.productId) === String(product.productId)
        )
      ) {
        acc.push(product);
      }
      return acc;
    }, []);

    // Filter out duplicate shows based on showId
    const uniqueTaggedShows = taggedShows.reduce((acc, show) => {
      if (!acc.some((item) => String(item.showId) === String(show.showId))) {
        acc.push(show);
      }
      return acc;
    }, []);

    // Prepare arrays of ObjectIds for use in queries
    const showObjectIds = uniqueTaggedShows.map(
      (show) => new mongoose.Types.ObjectId(String(show.showId))
    );
    const productObjectIds = uniqueTaggedProducts.map(
      (product) => new mongoose.Types.ObjectId(String(product.productId))
    );

    // --------- Update Shows (taggedProducts array) ---------
    let totalShowUpdates = 0;
    let totalShowAdds = 0;
    // For each product, update existing entries and add if missing
    for (const product of uniqueTaggedProducts) {
      const productObjId = new mongoose.Types.ObjectId(
        String(product.productId)
      );
      // Update: if product exists, update its title
      const updateResult = await Show.updateMany(
        {
          _id: { $in: showObjectIds },
          sellerId, // filter by sellerId
          "taggedProducts.productId": productObjId,
        },
        {
          $set: { "taggedProducts.$.title": product.title },
        }
      );
      totalShowUpdates += updateResult.modifiedCount;

      // Add: if product does not exist in taggedProducts, add it.
      // $addToSet prevents duplicates.
      const addResult = await Show.updateMany(
        {
          _id: { $in: showObjectIds },
          sellerId, // filter by sellerId
          "taggedProducts.productId": { $ne: productObjId },
        },
        {
          $addToSet: { taggedProducts: product },
        }
      );
      totalShowAdds += addResult.modifiedCount;
    }

    // --------- Update ProductListings (taggedShows array) ---------
    let totalProductUpdates = 0;
    let totalProductAdds = 0;
    // For each show, update existing entries and add if missing
    for (const show of uniqueTaggedShows) {
      const showObjId = new mongoose.Types.ObjectId(String(show.showId));
      // Update: if show exists in taggedShows, update its title (or other fields as needed)
      const updateResult = await ProductListing.updateMany(
        {
          _id: { $in: productObjectIds },
          sellerId, // filter by sellerId
          "taggedShows.showId": showObjId,
        },
        {
          $set: { "taggedShows.$.title": show.title },
        }
      );
      totalProductUpdates += updateResult.modifiedCount;

      // Add: if show does not exist in taggedShows, add it.
      const addResult = await ProductListing.updateMany(
        {
          _id: { $in: productObjectIds },
          sellerId, // filter by sellerId
          "taggedShows.showId": { $ne: showObjId },
        },
        {
          $addToSet: { taggedShows: show },
        }
      );
      totalProductAdds += addResult.modifiedCount;
    }

    return res.status(200).json({
      success: true,
      message: "Tagged products in Shows and tagged shows in Products updated!",
      showsUpdated: totalShowUpdates,
      showsAdded: totalShowAdds,
      productsUpdated: totalProductUpdates,
      productsAdded: totalProductAdds,
    });
  } catch (error) {
    console.error("tagProductInShows", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
