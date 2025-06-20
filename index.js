import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import chalk from 'chalk';
import cookieParser from 'cookie-parser';
import connectDB from './src/config/connection.js';
import authRouter from './src/routes/authentication.route.js';
import userRouter from './src/routes/user.route.js';
import sellerRouter from './src/routes/seller.route.js';
import categoryRouter from './src/routes/category.route.js';
import settingsRouter from './src/routes/settings.route.js';
import orderRouter from './src/routes/orders.routes.js';
import addressRouter from './src/routes/address.route.js';
import productRouter from './src/routes/product.route.js';
import inventoryHistoryRouter from './src/routes/inventoryHistory.route.js';
import adminSellerApplicationRouter from './src/routes/admin/sellerApplication.route.js';
import adminSellerRouter from './src/routes/admin/seller.route.js';
import adminUserRouter from './src/routes/admin/user.route.js';
import adminPartnerRouter from './src/routes/admin/admin.routes.js';
import showsRouter from './src/routes/shows.route.js';
import productListingRouter from './src/routes/productListing.route.js';
import stockRouter from './src/routes/stock.route.js';
import razorpayRouter from './src/routes/RazorPay.routes.js';
import cashfreeRouter from './src/routes/Cashfree.routes.js';
import payUOrder from './src/routes/payU.Routes.js';
import cartRouter from './src/routes/cart.routes.js';
import initializeSocket from './src/utils/socket.js';


const app = express();
const server = http.createServer(app);

// --- Configure Trust Proxy ---
// IMPORTANT: Set this EARLY, before routes/middleware using req.ip
app.set('trust proxy', 1); // Trust the first hop (common for Render, Heroku, etc.)
// --- End Configuration ---

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://flykup-admin.vercel.app",
    "https://flykup-user-app.vercel.app",
    "https://flykup-user.vercel.app",
    "https://user-vercel-flykup.vercel.app",
    "wss://flykup-dk4mv4s6.livekit.cloud",
    "https://app.flykup.live",
    "https://admin.flykup.live",
    "https://flykup-bidding.vercel.app",
    "https://flykup-merge.vercel.app",
    "https://flykup-fe-merged-new-3.vercel.app",
        "https://flykup-demo.vercel.app",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT"],
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/seller', sellerRouter);
app.use('/api/address', addressRouter);
app.use('/api/history/inventory', inventoryHistoryRouter);
app.use('/api/admin/sellerApplication', adminSellerApplicationRouter);
app.use('/api/admin/seller', adminSellerRouter);
app.use('/api/admin/user', adminUserRouter);
app.use('/api/partners/admin', adminPartnerRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/shows', showsRouter);
app.use('/api/product/listing', productListingRouter);
app.use('/api/product', productRouter);
app.use('/api/stock', stockRouter);
app.use('/api/razorpay', razorpayRouter);
app.use('/api/cashfree', cashfreeRouter);
app.use('/api/payu', payUOrder);
app.use('/api/cart', cartRouter);
app.use('/api/order', orderRouter);

app.get('/', (req, res) => {
  res.send("Hello, Welcome to Flykup Backend API");
});

connectDB()
  .then(() => {
    console.log(chalk.green.bold("🌐 MongoDB Connected Successfully..."));
    const PORT = process.env.PORT || 8081;
    const io = initializeSocket(server);
    server.listen(PORT, () => {
      console.log(chalk.green.bold("\n🚀 Flykup Backend Server is running:\n"));
      console.log(`  ${chalk.green.bold("➜")}  Local:   ${chalk.cyan.underline(`http://localhost:${PORT}/`)}`);
      console.log(`  ${chalk.green.bold("➜")}  Network: ${chalk.dim("use --host to expose")}`);
      console.log(`  ${chalk.green.bold("➜")}  ${chalk.dim("press h + enter to show help")}\n`);
    });
  })
  .catch((err) => {
    console.error(chalk.red.bold(`❌ Failed to connect to the database: ${err.message}`));
  });
