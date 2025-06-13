import User from "../models/user.model.js";
import Seller from "../models/seller.model.js";
import {
  USER_PUBLIC_FIELDS,
  SELLER_PUBLIC_FIELDS,
} from "../utils/constants.js";
import { sendApplicationReceived, sendWelcomeEmail } from "../email/send.js";
import { generateUniqueUsername } from "../utils/helper.js";

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select(USER_PUBLIC_FIELDS);

    return res.status(200).json({
      status: true,
      data: users,
    });
  } catch (error) {
    console.error("Error in getAllUsers", error.message);
    return res.status(500).json({
      status: false,
      data: "Internal Server Error. Please try again later.",
    });
  }
};

export const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id).select(USER_PUBLIC_FIELDS).populate({
      path: "sellerInfo",
      select: SELLER_PUBLIC_FIELDS,
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        data: "User not found.",
      });
    }

    return res.status(200).json({
      status: true,
      data: user,
    });
  } catch (error) {
    console.error("Error in getUserById", error.message);
    return res.status(500).json({
      status: false,
      data: "Internal Server Error. Please try again later.",
    });
  }
};

export const requestToBecomeSeller = async (req, res) => {
  const { userId, basicInfo, aadharInfo, addressInfo } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    const existingDetails = await Seller.findOne({ userInfo: userId });

    if (existingDetails) {
      return res.status(400).json({
        status: false,
        message: "Existing! Can't send request again.",
      });
    }

    // Check for existing Aadhar number in Seller collection
    const existingAadhar = await Seller.findOne({
      "aadharInfo.aadharNumber": aadharInfo.aadharNumber,
    });
    if (existingAadhar) {
      return res.status(400).json({
        status: false,
        message: "Aadhar number is already linked with another account.",
      });
    }

    const newRequest = new Seller({
      userInfo: userId,
      basicInfo,
      aadharInfo,
      addressInfo,
    });

    await newRequest.save();

    user.sellerInfo = newRequest._id;
    await user.save();

    // application confirmation email
    sendApplicationReceived(user.emailId, user.userName).catch((error) =>
      console.error("Error sending welcome email:", error.message)
    );

    const updatedUserDataWithSellerData = await User.findById(userId).populate(
      "sellerInfo",
      "approvalStatus rejectedReason"
    );

    return res.status(200).json({
      status: true,
      message:
        "Your seller request has been submitted successfully and is under review.",
      data: updatedUserDataWithSellerData,
    });
  } catch (error) {
    console.error("Error in requestToBecomeSeller:", error.message);

    // Handle MongoDB duplicate key error specifically
    if (error.code === 11000) {
      return res.status(400).json({
        status: false,
        message: "Aadhar number is already linked with another account.",
      });
    }

    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const modifyBecomeSellerRequest = async (req, res) => {
  const { userId, basicInfo, aadharInfo, addressInfo } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "user not found",
      });
    }

    const seller = await Seller.findOne({ userInfo: userId });

    if (!seller) {
      return res.status(404).json({
        status: false,
        message: "Seller request not found.",
      });
    }

    if (seller.approvalStatus !== "rejected") {
      return res.status(400).json({
        status: false,
        message: "You can only update details if your request was rejected.",
      });
    }

    Object.assign(seller, {
      basicInfo,
      aadharInfo,
      addressInfo,
      approvalStatus: "pending",
      rejectedReason: null,
    });

    await seller.save();

    // application confirmation email
    sendApplicationReceived(user.emailId, user.userName).catch((error) =>
      console.error("Error sending welcome email:", error.message)
    );

    const updatedUserDataWithSellerData = await User.findById(userId).populate(
      "sellerInfo",
      "approvalStatus rejectedReason"
    );

    return res.status(200).json({
      status: true,
      message:
        "Details updated successfully. Your request is now pending for review.",
      data: updatedUserDataWithSellerData,
    });
  } catch (error) {
    console.error("Error in modifyBecomeSellerRequest:", error.message);

    // Handle MongoDB duplicate key error specifically
    if (error.code === 11000) {
      return res.status(400).json({
        status: false,
        message: "Aadhar number is already linked with another account.",
      });
    }

    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const getSellerRequestStatus = async (req, res) => {
  const { userId } = req.params;

  try {
    const seller = await Seller.findOne({ userInfo: userId }).select(
      "approvalStatus rejectedReason basicInfo aadharInfo addressInfo"
    );

    if (!seller) {
      return res.status(404).json({
        status: false,
        data: "No seller request found for this user.",
      });
    }

    return res.status(200).json({
      status: true,
      data: seller,
    });
  } catch (error) {
    console.error("Error in getSellerRequestStatus:", error.message);
    return res.status(500).json({
      status: false,
      data: "Internal Server Error. Please try again later.",
    });
  }
};

// create user from admin panel
export const createUser = async (req, res) => {
  try {
    const { name, emailId, password, mobile } = req.body;
    const lowerCaseEmail = emailId.toLowerCase().trim();

    const existingUser = await User.findOne({ emailId: lowerCaseEmail });
    if (existingUser) {
      return res.status(400).json({
        status: false,
        message: "User with this email already exists",
      });
    }

    const uniqueUsername = await generateUniqueUsername(name);

    const newUser = new User({
      name,
      emailId: lowerCaseEmail,
      password,
      mobile,
      userName: uniqueUsername,
      role: "user",
      isEmailVerified: true
    });

    await newUser.save();

    // decoupling welcome email sending
    sendWelcomeEmail(newUser.emailId, newUser.userName).catch((error) =>
      console.error("Error in sendWelcomeEmail:", error.message)
    );

    return res.status(201).json({
      status: true,
      message: "User created successfully",
      data: newUser,
    });
  } catch (error) {
    console.error("Error in createUser:", error.message);

    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

// update user from admin panel
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    Object.keys(payload).forEach((key) => {
      user[key] = payload[key];
    });

    await user.save();

    return res.status(200).json({
      status: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Error in updateUser:", error.message);

    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};


export const toggleUserAccessAdmin = async (req, res) => {
  const { id } = req.params;
  const { accessAllowed } = req.body;

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    user.accessAllowed = accessAllowed;
    await user.save();

    return res.status(200).json({
      status: true,
      message: `user access is ${accessAllowed ? "enabled" : "disabled"}`,
    });
  } catch (error) {
    console.error("Error in toggleUserAccessAdmin:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

//  Delete user from admin end
export const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    await user.deleteOne();

    return res
      .status(200)
      .json({ status: true, data: "User deleted successfully" });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

//  Get all users from admin end
export const getAllUsersAdmin = async (req, res) => {
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
        { emailId: { $regex: searchQuery, $options: "i" } },
        { mobile: { $regex: searchQuery } },
        { userName: { $regex: searchQuery, $options: "i" } },
      ],
    };
  }
  try {
    const filter = {
      role: "user",
      ...searchFilter,
    };

    const totalCount = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res
      .status(200)
      .json({
        status: true,
        message: "all users fetched successfully!",
        data: users || [],
        totalCount,
      });
  } catch (error) {
    console.error("Error in getAllUsersAdmin:", error.message);
    return res
      .status(500)
      .json({
        status: false,
        message: "Internal server error. Please try again later.",
      });
  }
};

//  Get user by id from admin end
export const getUserByIdAdmin = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  return res.status(200).json({ status: true, data: user });
};
