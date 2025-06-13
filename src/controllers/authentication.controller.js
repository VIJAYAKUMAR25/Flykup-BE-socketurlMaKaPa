import {
  generateUniqueUsername,
  validateResetPassword,
  validateSignup,
} from "../utils/helper.js";
import User from "../models/user.model.js";
import { generateAndSaveOtp } from "../utils/otp.js";
import { sendEmailOtp, sendWelcomeEmail , sendPasswordResetSuccess } from "../email/send.js";

export const signupUser = async (req, res) => {
  try {
    validateSignup(req);
    const { name, emailId, password } = req.body;
    const lowerCaseEmail = emailId.toLowerCase().trim();

    const existingEmail = await User.findOne({ emailId: lowerCaseEmail });
    if (existingEmail) {
      return res.status(400).json({
        status: false,
        data: "Email is already registered!",
      });
    }

    const uniqueUsername = await generateUniqueUsername(name);

    const newUser = new User({
      name,
      emailId: lowerCaseEmail,
      password,
      userName: uniqueUsername,
    });

    const otp = await generateAndSaveOtp(newUser);

    const emailSent = await sendEmailOtp(lowerCaseEmail, otp, uniqueUsername);

    if (!emailSent) {
      return res.status(500).json({
        status: false,
        data: "Failed to send OTP.Try to login.",
      });
    }

    return res.status(200).json({
      status: true,
      action: "verifyOtp",
      data: "OTP sent to your email. Verify to complete signup.",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      data: error.message,
    });
  }
};

export const googleAuth = async (req, res) => {
  try {
    const { name, emailId, profileURL } = req.body;
    const lowerCaseEmail = emailId.toLowerCase().trim();

    // Try to find an existing user
    let existingUser = await User.findOne({ emailId: lowerCaseEmail });

    // If the user doesn't exist, create a new user
    if (!existingUser) {
      const uniqueUsername = await generateUniqueUsername(name);

      existingUser = new User({
        name,
        emailId: lowerCaseEmail,
        profileURL,
        isEmailVerified: true, // Assuming the email is verified via Google OAuth
        role: "user",
        oAuth: "google",
        userName: uniqueUsername,
      });

      await existingUser.save();

      // decoupling welcome email sending
      sendWelcomeEmail(existingUser.emailId, existingUser.userName).catch(
        (error) => console.error("Error sending welcome email:", error.message)
      );
    }

    // Create a JWT token for the user (either new or existing)
    const token = existingUser.createJwtToken();

    // Set the token in a cookie
    return res
      .cookie("authToken", token, {
        maxAge: 15 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "none",
        secure: true,
      })
      .status(200)
      .json({
        status: true,
        message: "Google authentication successful!",
        data: existingUser,
        action: "login",
      });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      data: "Internal server error. Please try again later.",
    });
  }
};

export const facebookAuth = async (req, res) => {
  try {
    const { name, emailId, profileURL, accessToken } = req.body;
    const lowerCaseEmail = emailId.toLowerCase().trim();

    // Step 1: Validate the Facebook access token with Facebook's API
    const response = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
    );
    const data = await response.json();

    // console.log(data);

    if (data.error) {
      return res.status(400).json({
        status: false,
        data: "Invalid Facebook token. Please try again.",
      });
    }

    // Step 2: Check if the user exists in the database
    let existingUser = await User.findOne({ emailId: lowerCaseEmail });

    // Step 3: Handle login/signup
    if (!existingUser) {
      // If the user doesn't exist, create a new user

      const uniqueUsername = await generateUniqueUsername(name);

      existingUser = new User({
        name,
        emailId: lowerCaseEmail,
        profileURL,
        isEmailVerified: true, // Assume email is verified by Facebook
        role: "user",
        oAuth: "facebook",
        userName: uniqueUsername,
      });
      await existingUser.save();

      // decoupling welcome email sending
      sendWelcomeEmail(existingUser.emailId, existingUser.userName).catch(
        (error) => console.error("Error sending welcome email:", error.message)
      );
    }

    // Step 4: Create JWT token for the user
    const token = existingUser.createJwtToken();

    // Step 5: Set the JWT token in a cookie
    return res
      .cookie("authToken", token, {
        maxAge: 15 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "none",
        secure: true,
      })
      .status(200)
      .json({
        status: true,
        message: "Facebook authentication successful!",
        data: existingUser,
        action: "login",
      });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      data: "Internal server error. Please try again later.",
    });
  }
};

export const verifyEmailOTP = async (req, res) => {
  try {
    const { emailId, otp } = req.body;
    const lowerCaseEmail = emailId.toLowerCase().trim();

    const user = await User.findOne({ emailId: lowerCaseEmail });
    if (!user) {
      return res.status(404).json({
        status: false,
        data: "User not found. Please sign up again.",
      });
    }

    if (
      user.emailVerificationOtp !== otp ||
      Date.now() > user.emailVerificationOtpExpiry
    ) {
      return res.status(400).json({
        status: false,
        data: "Invalid OTP.",
      });
    }

    user.isEmailVerified = true;
    user.role = "user";
    user.emailVerificationOtp = null;
    user.emailVerificationOtpExpiry = null;

    await user.save();

    // decoupling welcome email sending
    sendWelcomeEmail(user.emailId, user.userName).catch((error) =>
      console.error("Error in sendWelcomeEmail:", error.message)
    );

    return res.status(200).json({
      status: true,
      message: "Email verified. Signup successful!",
      data: user,
      action: "login",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      data: "Internal Server Error. Please try again later.",
    });
  }
};

export const resendEmailOTP = async (req, res) => {
  try {
    const { emailId } = req.body;
    const lowerCaseEmail = emailId.toLowerCase().trim();

    const user = await User.findOne({ emailId: lowerCaseEmail });
    if (!user) {
      return res.status(404).json({
        status: false,
        data: "User not found. Please sign up again.",
      });
    }

    const otp = await generateAndSaveOtp(user);

    // console.log("otp", otp);
    

    const emailSent = await sendEmailOtp(lowerCaseEmail, otp, user.userName);
    if (!emailSent) {
      return res.status(500).json({
        status: false,
        data: "Failed to send OTP. Please try again.",
      });
    }

    return res.status(200).json({
      status: true,
      data: "A new OTP has been sent to your email.",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      data: "Internal Server Error. Please try again later.",
    });
  }
};

export const loginUser = async (req, res) => {
  const { emailId, password } = req.body;

  const lowerCaseEmail = emailId.toLowerCase().trim();

  try {
    const user = await User.findOne({ emailId: lowerCaseEmail });
    if (!user) {
      return res
        .status(400)
        .json({ status: false, data: "Invalid credentials!" });
    }

    if (user.oAuth) {
      return res.status(400).json({
        status: false,
        data: `You registered using ${user.oAuth}. Please login using ${user.oAuth}`,
      });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res
        .status(400)
        .json({ status: false, data: "Invalid credentials!" });
    }

    if (!user.isEmailVerified) {
      const otp = await generateAndSaveOtp(user);

      const emailSent = await sendEmailOtp(lowerCaseEmail, otp, user.userName);
      if (!emailSent) {
        return res.status(500).json({
          status: false,
          data: "Failed to send OTP. Please try again.",
        });
      }

      return res.status(200).json({
        status: true,
        action: "verifyOtp",
        data: "Your email is not verified. An OTP has been sent to your email. Please verify to proceed.",
      });
    }

    const token = await user.createJwtToken();

    return res
      .cookie("authToken", token, {
        maxAge: 15 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "none",
        secure: true,
      })
      .status(200)
      .json({
        status: true,
        message: `${user.userName} logged in successfully!`,
        data: user,
        action: "login",
      });
  } catch (error) {
    return res.status(500).json({
      status: false,
      data: "Internal Server Error. Please try again later.",
    });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const user = req.user;
    return res
      .cookie("token", null, { expires: new Date(Date.now()) })
      .status(200)
      .json({
        status: true,
        data: `${user.userName} logged out successfully!`,
      });
  } catch (error) {
    res.status(400).json({ status: false, data: error.message });
  }
};

export const forgotPasswordRequest = async (req, res) => {
  const { emailId } = req.body;
  const lowerCaseEmail = emailId.toLowerCase().trim();

  try {
    const user = await User.findOne({ emailId: lowerCaseEmail });
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found.",
      });
    }

    if (user.oAuth) {
      return res.status(400).json({
        status: false,
        message: `You registered using ${user.oAuth}. Please login using ${user.oAuth}`,
      });
    }

    const otp = await generateAndSaveOtp(user);

    const emailSent = await sendEmailOtp(lowerCaseEmail, otp, user.userName);
    if (!emailSent) {
      return res.status(500).json({
        status: false,
        message: "Failed to send OTP. Please try again.",
      });
    }

    return res.status(200).json({
      status: true,
      action: "verifyOtp",
      data: "An OTP has been sent to your email. Please verify to reset your password.",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const verifyForgotPasswordOtp = async (req, res) => {
  const { emailId, otp } = req.body;
  const lowerCaseEmail = emailId.toLowerCase().trim();

  try {
    const user = await User.findOne({ emailId: lowerCaseEmail });
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found.",
      });
    }

    if (
      user.emailVerificationOtp !== otp ||
      Date.now() > user.emailVerificationOtpExpiry
    ) {
      return res.status(400).json({
        status: false,
        message: "Invalid OTP.",
      });
    }

    user.emailVerificationOtp = null;
    user.emailVerificationOtpExpiry = null;
    user.isPasswordResetAllowed = true;
    await user.save();

    return res.status(200).json({
      status: true,
      action: "resetPassword",
      data: "OTP verified. You can now reset your password.",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    // validating data with custom function
    validateResetPassword(req);

    const { emailId, confirmPassword } = req.body;
    const lowerCaseEmail = emailId.toLowerCase().trim();

    const user = await User.findOne({ emailId: lowerCaseEmail });
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    if (!user.isPasswordResetAllowed) {
      return res.status(400).json({
        status: false,
        message: "Password reset not allowed. Please verify your identity",
      });
    }

    user.password = confirmPassword;
    user.isPasswordResetAllowed = false;
    await user.save();

    // password reset success email
    sendPasswordResetSuccess(user.emailId, user.userName).catch(
      (error) => console.error("Error sending welcome email:", error.message)
    );

    return res.status(200).json({
      status: true,
      data: "Password reset success. You can now log in with your new password.",
    });
  } catch (error) {
    return res.status(400).json({
      status: false,
      message: error.message,
    });
  }
};

// check user Name availability

export const checkUsernameAvailability = async (req, res) => {
  try {
    const { userName } = req.query;
    const lowerCaseUserName = userName.toLowerCase().trim();

    const existingUserName = await User.findOne({
      userName: lowerCaseUserName,
    });

    if (existingUserName) {
      return res.status(200).json({
        status: false,
        data: "Username is already taken!",
      });
    }

    return res.status(200).json({
      status: true,
      data: "Username is available!",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      data: error.message,
    });
  }
};
