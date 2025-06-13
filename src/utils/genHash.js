import jsSHA from "jssha";

const PAYU_MERCHANT_KEY = "gtKFFx";  // standard sandbox key
const PAYU_MERCHANT_SALT = "eCwWELxi";  // standard sandbox salt

const generateHash = (data) => {
    const hashString = [
      PAYU_MERCHANT_KEY,
      data.txnid,
      data.amount,
      data.productinfo,
      data.firstname,
      data.email,
      data.udf1 || '',
      data.udf2 || '',
      data.udf3 || '',
      data.udf4 || '',
      data.udf5 || '',
      '', '', '', '', '',
      PAYU_MERCHANT_SALT
    ].join('|');
  
    const sha = new jsSHA("SHA-512", "TEXT");
    sha.update(hashString);
    return sha.getHash("HEX");
  };

  const testData = {
    txnid: "txn_test_123456",
    amount: "10.00",
    productinfo: "Test Product",
    firstname: "Test",
    email: "test@example.com",
    udf1: "", udf2: "", udf3: "", udf4: "", udf5: ""
  };
  
  console.log("Sandbox hash:", generateHash(testData));