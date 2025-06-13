import axios from "axios";
import jsSHA from "jssha";
import ProductListing from "../models/productListing.model.js";

const PAYU_MERCHANT_KEY = "oav6MQ";
const PAYU_MERCHANT_SALT = "WZ9RjZZiGfWkBJizoSTUyH1UYuzEUulG";
// const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY || "gtKFFx"; 
// const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT || "4R38IvwiV57FwVpsgOvTXBdLE4tHUXFW";
const PAYU_MODE = process.env.PAYU_MODE; // "TEST" or "LIVE"
const PAYU_URL = PAYU_MODE === "TEST" ? "https://test.payu.in/_payment" : "https://secure.payu.in/_payment";
// Define Verify API URL based on mode
const PAYU_VERIFY_URL = PAYU_MODE === "TEST"
  ? "https://test.payu.in/merchant/postservice?form=2"
  : "https://info.payu.in/merchant/postservice?form=2"; // Check PayU docs for the correct LIVE URL if different


// Helper function to generate SHA512 hash
const generateHash = (data) => {
  // --- FIX: Format amount based on whether it has decimals ---
  const numericAmount = parseFloat(data.amount);
  const amountString = Number.isInteger(numericAmount)
    ? String(numericAmount) // Use integer string "697"
    : numericAmount.toFixed(2); // Use "697.50" etc. for decimals
  // --- End FIX ---

  const hashStringData = [
    PAYU_MERCHANT_KEY,
    data.txnid,
    amountString, // Use the dynamically formatted amount string
    data.productinfo,
    data.firstname,
    data.email,
    data.udf1 || '',
    data.udf2 || '',
    data.udf3 || '',
    data.udf4 || '',
    data.udf5 || '',
    '', '', '', '', '',  // 5 empty placeholders
    PAYU_MERCHANT_SALT // Assuming this holds the correct V2 SALT now
  ];

  const hashString = hashStringData.join('|');

  console.log("Using SALT for Hash:", `"${PAYU_MERCHANT_SALT}"`); // Keep this log
  console.log("Amount string used:", `"${amountString}"`);      // Keep this log
  console.log("Generated Hash String V2:", hashString);         // Keep this log

  const sha = new jsSHA("SHA-512", "TEXT", { encoding: "UTF8" });
  sha.update(hashString);
  const hexHash = sha.getHash("HEX");
  console.log("Generated HEX Hash V2:", hexHash); // Log generated hash
  return hexHash;
};


export const createPayUOrder = async (req, res) => {
  const { selectedAddress, products, customer, amount: frontendAmount } = req.body;

  try {
    let total = 0;
    // --- Important: Use productPrice from DB ---
    for (const item of products) {
      // Ensure item.product._id exists and is valid
      if (!item?.product?._id) {
        return res.status(400).json({ error: "Invalid product data in request." });
      }
      const dbProduct = await ProductListing.findById(item.product._id).select('productPrice'); // Select only price
      if (!dbProduct || dbProduct.productPrice == null) { // Check price exists
        console.error(`Product not found or price missing for ID: ${item.product._id}`);
        return res.status(404).json({ error: `Product details not found for ID: ${item.product._id}` });
      }
      total += dbProduct.productPrice * item.quantity;
    }
    // --- End DB Price Check ---

    const shippingFee = total > 999 ? 0 : 49; // Example shipping logic
    const tax = Math.round(total * 0.18); // Example tax logic
    // --- Ensure final amount calculation matches frontend expectation precisely ---
    const finalAmount = parseFloat((total + shippingFee + tax).toFixed(2));

    // Verify amounts (crucial!)
    if (Math.abs(parseFloat(frontendAmount) - finalAmount) > 0.01) { // Use tolerance for float comparison
      console.warn(`Amount mismatch: Frontend=${frontendAmount}, Backend=${finalAmount}`);
      return res.status(400).json({
        error: "Amount mismatch detected. Please refresh and try again.",
        serverCalculatedAmount: finalAmount,
        frontendAmount: parseFloat(frontendAmount),
      });
    }

    const txnid = `txn_${Date.now()}`;
    const productinfo = "Flykup Order"; // Keep it simple

    // --- Data to be sent AND hashed ---
    const paymentData = {
      key: PAYU_MERCHANT_KEY,
      txnid,
      amount: finalAmount, // Pass the numeric amount here
      productinfo,
      firstname: customer.name || 'Guest', // Use fallback
      email: customer.emailId || 'guest@example.com', // Use fallback and ensure validity
      phone: selectedAddress?.mobile || customer?.mobile || '', // Ensure phone is present
      surl: `${process.env.FRONTEND_URL}/payment-success`, // Ensure FRONTEND_URL is set in .env
      furl: `${process.env.FRONTEND_URL}/payment-failure`, // Ensure FRONTEND_URL is set in .env
      udf1: "", udf2: "", udf3: "", udf4: "", udf5: "", // Keep these empty if not used
      // Address fields might be needed by PayU depending on integration type
      // address1: selectedAddress?.addressLine1 || '',
      // city: selectedAddress?.city || '',
      // state: selectedAddress?.state || '',
      // country: 'IN', // Assuming India
      // zipcode: selectedAddress?.pincode || '',
      service_provider: "payu_paisa", // Usually okay, but confirm if needed
    };

    // --- Generate hash using the correct data ---
    paymentData.hash = generateHash({
      ...paymentData,
      amount: paymentData.amount // Pass amount again (generateHash will format it)
    });

    console.log("Sending Payment Data:", paymentData); // Log final data being sent

    res.json({
      payuUrl: PAYU_URL,
      paymentData, // Contains all fields including key, hash, etc.
    });
  } catch (error) {
    console.error("Error creating PayU order:", error); // Log full error
    res.status(500).json({
      error: "Error creating PayU order",
      details: error.message,
    });
  }
};

export const verifyPayUPayment = async (req, res) => {
  const { txnid } = req.body; // Get txnid from the frontend request

  if (!txnid) {
    return res.status(400).json({ error: "Transaction ID (txnid) is required." });
  }

  try {
    // Prepare data for PayU Verify Payment API
    // The command is 'verify_payment'
    // Hash sequence for verify_payment: key|command|var1|salt
    const command = "verify_payment";
    const hashStringData = [
      PAYU_MERCHANT_KEY,
      command,
      txnid, // var1 is the txnid
      PAYU_MERCHANT_SALT
    ];
    const hashString = hashStringData.join('|');

    const sha = new jsSHA("SHA-512", "TEXT", { encoding: "UTF8" });
    sha.update(hashString);
    const hash = sha.getHash("HEX");

    console.log("Verify API Hash String:", hashString);
    console.log("Verify API Hash:", hash);

    // Use 'axios' or 'node-fetch' to call PayU Verify API
    // PayU expects form-urlencoded data for this API
    const params = new URLSearchParams();
    params.append('key', PAYU_MERCHANT_KEY);
    params.append('command', command);
    params.append('var1', txnid);
    params.append('hash', hash);

    console.log("Calling PayU Verify API at:", PAYU_VERIFY_URL);
    console.log("Sending Verify Params:", { key: PAYU_MERCHANT_KEY, command, var1: txnid, hash });


    const response = await axios.post(PAYU_VERIFY_URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log("PayU Verify API Raw Response:", response.data);

    // --- Process the response from PayU ---
    // PayU Verify API returns data that needs parsing (it's not always clean JSON)
    // Common fields: status, msg, transaction_details (which itself is complex)
    const verificationData = response.data;

    if (verificationData && verificationData.transaction_details && verificationData.transaction_details[txnid]) {
      const transactionDetails = verificationData.transaction_details[txnid];
      console.log(`Verification details for ${txnid}:`, transactionDetails);

      // Check the definitive status from PayU
      const payuStatus = transactionDetails.status; // e.g., 'success', 'failure', 'pending'
      const payuAmount = parseFloat(transactionDetails.amt || transactionDetails.amount); // Check field name in your response
      // You might also want to verify: mihpayid, mode, productinfo etc. against your records

      // **IMPORTANT**: Compare payuAmount with the amount stored in *your* database for this txnid/order
      // const order = await YourOrderModel.findOne({ transactionId: txnid });
      // if (!order || Math.abs(order.amount - payuAmount) > 0.01) {
      //     console.error(`Amount mismatch! PayU: ${payuAmount}, DB: ${order?.amount}`);
      //     // Handle mismatch - treat as potentially fraudulent or failed
      //     return res.status(400).json({ verified: false, status: "failure", message: "Amount mismatch during verification." });
      // }

      if (payuStatus === 'success') {
        console.log(`Verification successful for ${txnid}`);
        // ** crucial: Update your order status in YOUR database to 'PLACED' or 'PAID' here **
        // await YourOrderModel.updateOne({ transactionId: txnid }, { status: 'PAID', paymentDetails: transactionDetails });
        res.json({ verified: true, status: payuStatus, message: "Payment verified successfully." });
      } else {
        console.warn(`Verification status for ${txnid}: ${payuStatus}`);
        // Update your order status accordingly (e.g., 'FAILED', 'PENDING')
        res.json({ verified: false, status: payuStatus, message: `Payment status: ${payuStatus}` });
      }
    } else {
      console.error("Verification failed: Transaction details not found in PayU response or invalid response format.", verificationData);
      res.status(500).json({ verified: false, status: "error", message: "Verification failed: Could not retrieve transaction details." });
    }

  } catch (error) {
    console.error("Error verifying PayU payment:", error.response ? error.response.data : error.message);
    res.status(500).json({
      verified: false,
      status: "error",
      message: "Error verifying payment",
      details: error.response ? error.response.data : error.message,
    });
  }
};

