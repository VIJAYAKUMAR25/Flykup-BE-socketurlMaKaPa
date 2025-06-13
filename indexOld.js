import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import chalk from 'chalk';
import cookieParser from 'cookie-parser';
import connectDB from './src/config/connection.js';
import authRouter from './src/routes/authentication.route.js';
import userRouter from './src/routes/user.route.js';
import sellerRouter from './src/routes/seller.route.js';
import categoryRouter from './src/routes/category.route.js';
import settingsRouter from './src/routes/settings.route.js';
import orderRouter from './src/routes/order.route.js';
import addressRouter from './src/routes/address.route.js';
import productRouter from './src/routes/product.route.js';
import inventoryHistoryRouter from './src/routes/inventoryHistory.route.js';
import adminSellerApplicationRouter from './src/routes/admin/sellerApplication.route.js';
import adminSellerRouter from './src/routes/admin/seller.route.js';
import adminUserRouter from './src/routes/admin/user.route.js';
import adminPartnerRouter from './src/routes/admin/admin.routes.js';
import showsRouter from './src/routes/shows.route.js';
import Show from './src/models/shows.model.js';
import productListingRouter from './src/routes/productListing.route.js';
import stockRouter from './src/routes/stock.route.js';
import razorpayRouter from './src/routes/RazorPay.routes.js';
import cashfreeRouter from './src/routes/Cashfree.routes.js';
import cartRouter from './src/routes/cart.routes.js';
import User from './src/models/user.model.js';
import { createClient } from 'redis';

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
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
      "https://flykup-bidding.vercel.app"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT"],
  },
});

// Middleware
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
    "https://flykup-bidding.vercel.app"
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/seller', sellerRouter);
app.use('/api/order', orderRouter);
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
app.use('/api/cart', cartRouter);

// Basic response route
app.get('/', (req, res) => {
  res.send("Hello, Welcome to Flykup Backend API");
});

////////////////////////////////////////////////////////////////////////////////
// Define a flag to control state storage: 
//   true = use Redis, false = use local in-memory object.
const redisState = false;

////////////////////////////////////////////////////////////////////////////////
// Initialize Redis client if redisState is true; otherwise, use local state.
let redisClient = null;
if (redisState) {
  redisClient = createClient({
    username: 'default',
    password: process.env.REDIS_PASSWORD,
    socket: {
      host: process.env.REDIS_HOST,
      port: 10110,
    },
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('ready', () => {
    console.log(chalk.blue.bold("🌐 Redis Client Connected Successfully!"));
  });

  await redisClient.connect();
} else {
  console.log(chalk.yellow.bold("🟡 Using local in-memory state for auctions."));
}

// Local in-memory state
const auctions = {}; // Keyed by uniqueStreamId
const auctionIntervals = {}; // To keep track of timer intervals
const giveaways = {}; // For giveaway state (if needed)


// Helper function to calculate next bid suggestions.
const calculateNextBids = (amnt) => {
  const increment = 50; // Fixed increment of 50
  return [
    Math.round(amnt + increment),
    Math.round(amnt + increment * 2)
  ];
};

////////////////////////////////////////////////////////////////////////////////
// Socket.io Connection and Events
io.on('connection', (socket) => {
  console.log(chalk.blue(`🔗 User connected: ${socket.id}`));

  // Join a specific live stream room.
  socket.on('joinRoom', async (streamId) => {
    if (!streamId) {
      console.log(chalk.yellow(`⚠️ Missing streamId for user ${socket.id}`));
      return;
    }
    socket.join(streamId);
    console.log(chalk.green(`✅ User ${socket.id} joined room: ${streamId}`));

    if (redisState) {
      // Retrieve auctions stored in Redis for this stream.
      const auctionKeys = await redisClient.keys(`auction:${streamId}_*`);
      for (const key of auctionKeys) {
        const auctionData = await redisClient.get(key);
        if (auctionData) {
          const auction = JSON.parse(auctionData);
          console.log("🔍 Found auction in Redis:", auction);
          socket.emit('bidUpdated', {
            streamId: auction.streamId,
            highestBid: auction.currentHighestBid,
            highestBidder: auction.highestBidder,
            nextBids: [auction.nextBid1, auction.nextBid2],
            product: auction.product
          });
          socket.emit("timerUpdate", {
            streamId,
            product: auction.product,
            endsAt: auction.endsAt,
            auctionType: auction.auctionType,
            increment: auction.increment,
            startingBid: auction.startingBid,
            uniqueStreamId: auction.uniqueStreamId,
            nextBids: [auction.nextBid1, auction.nextBid2],
          });
        }
      }
    } else {
      // Use local in-memory auctions: iterate and send those that belong to the stream.
      for (const key in auctions) {
        if (auctions[key].streamId === streamId) {
          console.log("🔍 Found auction in Local:", auctions[key]);
          socket.emit('bidUpdated', {
            streamId: auctions[key].streamId,
            highestBid: auctions[key].currentHighestBid,
            highestBidder: auctions[key].highestBidder,
            nextBids: [auctions[key].nextBid1, auctions[key].nextBid2],
            product: auctions[key].product
          });
          socket.emit("timerUpdate", {
            streamId,
            product: auctions[key].product,
            endsAt: auctions[key].endsAt,
            auctionType: auctions[key].auctionType,
            increment: auctions[key].increment,
            startingBid: auctions[key].startingBid,
            uniqueStreamId: auctions[key].uniqueStreamId,
            nextBids: [auctions[key].nextBid1, auctions[key].nextBid2],
          });
        }
      }
    }

    // --- New giveaway handling code ---
    if (redisState) {
      // Retrieve giveaways from Redis.
      const giveawayKeys = await redisClient.keys(`giveaway:${streamId}_*`);
      for (const key of giveawayKeys) {
        const giveawayData = await redisClient.get(key);
        if (giveawayData) {
          const giveaway = JSON.parse(giveawayData);
          if (giveaway.isActive) {
            console.log("🔍 Found giveaway in Redis:", giveaway);
            // Emit giveaway details (using the giveaway key without the "giveaway:" prefix).
            socket.emit('giveawayStarted', {
              ...giveaway,
              giveawayKey: key.replace("giveaway:", "")
            });
          }
        }
      }
    } else {
      // Iterate over local in-memory giveaways.
      for (const key in giveaways) {
        if (giveaways[key].streamId === streamId && giveaways[key].isActive) {
          console.log("🔍 Found giveaway in Local:", giveaways[key]);
          io.to(streamId).emit('giveawayStarted', { ...giveaways[key], giveawayKey: key });
        }
      }
    }
  });

  // Start Auction event.
  socket.on("startAuction", async ({ streamId, product, timer, auctionType, increment, startingBid }) => {
    io.to(streamId).emit("clrScr");
    console.log("startAuction clicked with stream ID", streamId);
    const uniqueStreamId = `${streamId}_${product}`;

    if (redisState) {
      const auctionKey = `auction:${uniqueStreamId}`;
      const exists = await redisClient.exists(auctionKey);
      if (!exists) {
        const endsAt = Date.now() + timer * 1000;
        const [nextBid1, nextBid2] = calculateNextBids(startingBid);

        // Retrieve the show to determine auction number.
        const show = await Show.findById(streamId);
        if (!show) {
          console.error(`❌ Show with streamId ${streamId} not found!`);
          return;
        }
        // Get all existing auctionNumbers EXCEPT for the product being started
        const auctionNumbers = show.auctionProducts
          .filter(a => a.productId.toString() !== product.toString()) // ignore current product
          .map(a => a.auctionNumber)
          .filter(num => num !== undefined && num !== null);

        // Set new auctionNumber
        const auctionNumber = auctionNumbers.length > 0
          ? Math.max(...auctionNumbers) + 1
          : 1;


        const newAuction = {
          streamId,
          product,
          auctionType,
          startingBid: Number(startingBid),
          increment,
          endsAt,
          isActive: true,
          bids: [],
          currentHighestBid: Number(startingBid),
          highestBidder: null,
          uniqueStreamId,
          nextBid1,
          nextBid2,
          auctionNumber, // <-- New field added here
        };

        try {
          const show = await Show.findById(streamId);
          if (!show) {
            console.error(`❌ Show with streamId ${streamId} not found!`);
            return;
          }
          const auctionIndex = show.auctionProducts.findIndex(a => a.productId.toString() === product.toString());
          if (auctionIndex !== -1) {
            show.auctionProducts[auctionIndex].streamId = streamId;
            show.auctionProducts[auctionIndex].auctionType = auctionType;
            show.auctionProducts[auctionIndex].increment = increment;
            show.auctionProducts[auctionIndex].endsAt = endsAt;
            show.auctionProducts[auctionIndex].isActive = true;
            show.auctionProducts[auctionIndex].bids = []; // Reset bids if needed.
            show.auctionProducts[auctionIndex].currentHighestBid = Number(startingBid);
            show.auctionProducts[auctionIndex].highestBidder = null;
            show.auctionProducts[auctionIndex].uniqueStreamId = uniqueStreamId;
            show.auctionProducts[auctionIndex].nextBid1 = nextBid1;
            show.auctionProducts[auctionIndex].nextBid2 = nextBid2;
            show.auctionProducts[auctionIndex].startingPrice = Number(startingBid);
            show.auctionProducts[auctionIndex].auctionNumber = auctionNumber; // Update auction number
          } else {
            show.auctionProducts.push({
              productId: product,
              startingPrice: Number(startingBid),
              reservedPrice: 0,
              isAuctionEnded: false,
              streamId,
              auctionType,
              increment,
              endsAt,
              isActive: true,
              bids: [],
              currentHighestBid: Number(startingBid),
              highestBidder: null,
              uniqueStreamId,
              nextBid1,
              nextBid2,
              auctionNumber, // <-- New field added here
            });
          }
          show.currentAuction = { ...newAuction, uniqueStreamId };
          await show.save();
        } catch (error) {
          console.error("Error saving auction inside show:", error);
        }

        // Save auction state in Redis.
        await redisClient.set(auctionKey, JSON.stringify(newAuction));
        console.log("Auction saved in Redis:", newAuction);

        io.to(streamId).emit("auctionStarted", {
          streamId,
          product,
          endsAt,
          auctionType,
          increment,
          startingBid,
          uniqueStreamId,
          nextBids: [nextBid1, nextBid2],
          auctionNumber, // <-- Include auction number here
        });

        // Start the countdown timer.
        auctionIntervals[uniqueStreamId] = setInterval(async () => {
          const auctionData = await redisClient.get(auctionKey);
          if (!auctionData) {
            clearInterval(auctionIntervals[uniqueStreamId]);
            return;
          }
          const auction = JSON.parse(auctionData);
          const remainingTime = Math.max(0, auction.endsAt - Date.now());
          io.to(streamId).emit("timerUpdate", { remainingTime, product });
          console.log("Remaining Time:", remainingTime / 1000);

          if (remainingTime <= 0) {
            clearInterval(auctionIntervals[uniqueStreamId]);
            delete auctionIntervals[uniqueStreamId];
            auction.isActive = false;
            try {
              const show = await Show.findById(streamId);
              if (!show) {
                console.error(`❌ Show with streamId ${streamId} not found!`);
                return;
              }
              const index = show.auctionProducts.findIndex(a =>
                a.productId.toString() === product.toString()
              );
              if (index === -1) {
                console.error(`❌ Auction with product ${product} not found in show`);
                return;
              }
              show.auctionProducts[index].isAuctionEnded = true;
              show.auctionProducts[index].currentHighestBid = auction.currentHighestBid;
              show.auctionProducts[index].highestBidder = auction.highestBidder;
              show.auctionProducts[index].bidderWon = auction.highestBidder;
              show.currentAuction = {
                ...show.currentAuction,
                bidderWon: auction.highestBidder,
                currentHighestBid: auction.currentHighestBid,
              };
              await show.save();
              console.log(`🚀 Auction ended for stream ${uniqueStreamId}. Winner: ${auction.highestBidder?.name || "No one"} with bid $${auction.currentHighestBid}`);
              io.to(streamId).emit("auctionEnded", {
                streamId,
                highestBid: auction.currentHighestBid,
                highestBidder: auction.highestBidder,
                bidderWon: auction.highestBidder,
                product,
              });
              // Remove auction state from Redis.
              await redisClient.del(auctionKey);
            } catch (error) {
              console.error("❌ Error updating auction status:", error);
            }
          }
        }, 1000);
      }
    } else {
      // Local in-memory auction state.
      if (!auctions[uniqueStreamId]) {
        const endsAt = Date.now() + timer * 1000;
        const [nextBid1, nextBid2] = calculateNextBids(startingBid);

        // Retrieve the show to determine auction number.
        const show = await Show.findById(streamId);
        if (!show) {
          console.error(`❌ Show with streamId ${streamId} not found!`);
          return;
        }
        // Get all existing auctionNumbers EXCEPT for the product being started
        const auctionNumbers = show.auctionProducts
          .filter(a => a.productId.toString() !== product.toString()) // ignore current product
          .map(a => a.auctionNumber)
          .filter(num => num !== undefined && num !== null);

        // Set new auctionNumber
        const auctionNumber = auctionNumbers.length > 0
          ? Math.max(...auctionNumbers) + 1
          : 1;


        const newAuction = {
          streamId,
          product,
          auctionType,
          startingBid: Number(startingBid),
          increment,
          endsAt,
          isActive: true,
          bids: [],
          currentHighestBid: Number(startingBid),
          highestBidder: null,
          uniqueStreamId,
          nextBid1,
          nextBid2,
          auctionNumber, // <-- New field added here
        };

        try {
          const show = await Show.findById(streamId);
          if (!show) {
            console.error(`❌ Show with streamId ${streamId} not found!`);
            return;
          }
          const auctionIndex = show.auctionProducts.findIndex(a => a.productId.toString() === product.toString());
          if (auctionIndex !== -1) {
            show.auctionProducts[auctionIndex].streamId = streamId;
            show.auctionProducts[auctionIndex].auctionType = auctionType;
            show.auctionProducts[auctionIndex].increment = increment;
            show.auctionProducts[auctionIndex].endsAt = endsAt;
            show.auctionProducts[auctionIndex].isActive = true;
            show.auctionProducts[auctionIndex].bids = [];
            show.auctionProducts[auctionIndex].currentHighestBid = Number(startingBid);
            show.auctionProducts[auctionIndex].highestBidder = null;
            show.auctionProducts[auctionIndex].uniqueStreamId = uniqueStreamId;
            show.auctionProducts[auctionIndex].nextBid1 = nextBid1;
            show.auctionProducts[auctionIndex].nextBid2 = nextBid2;
            show.auctionProducts[auctionIndex].startingPrice = Number(startingBid);
            show.auctionProducts[auctionIndex].auctionNumber = auctionNumber; // Update auction number
          } else {
            show.auctionProducts.push({
              productId: product,
              startingPrice: Number(startingBid),
              reservedPrice: 0,
              isAuctionEnded: false,
              streamId,
              auctionType,
              increment,
              endsAt,
              isActive: true,
              bids: [],
              currentHighestBid: Number(startingBid),
              highestBidder: null,
              uniqueStreamId,
              nextBid1,
              nextBid2,
              auctionNumber, // <-- New field added here
            });
          }
          show.currentAuction = { ...newAuction, uniqueStreamId };
          await show.save();
        } catch (error) {
          console.error("Error saving auction inside show:", error);
        }
        auctions[uniqueStreamId] = newAuction;
        console.log("Auction saved locally:", newAuction);
        io.to(streamId).emit("auctionStarted", {
          streamId,
          product,
          endsAt,
          auctionType,
          increment,
          startingBid,
          uniqueStreamId,
          nextBids: [nextBid1, nextBid2],
          auctionNumber, // <-- Include auction number here
        });
        auctionIntervals[uniqueStreamId] = setInterval(() => {
          const auction = auctions[uniqueStreamId];
          if (!auction) {
            clearInterval(auctionIntervals[uniqueStreamId]);
            return;
          }
          const remainingTime = Math.max(0, auction.endsAt - Date.now());
          io.to(streamId).emit("timerUpdate", { remainingTime, product });
          console.log("Remaining Time:", remainingTime / 1000);
          if (remainingTime <= 0) {
            clearInterval(auctionIntervals[uniqueStreamId]);
            delete auctionIntervals[uniqueStreamId];
            auction.isActive = false;
            (async () => {
              try {
                const show = await Show.findById(streamId);
                if (!show) {
                  console.error(`❌ Show with streamId ${streamId} not found!`);
                  return;
                }
                const index = show.auctionProducts.findIndex(a =>
                  a.productId.toString() === product.toString()
                );
                if (index === -1) {
                  console.error(`❌ Auction with product ${product} not found in show`);
                  return;
                }
                show.auctionProducts[index].isAuctionEnded = true;
                show.auctionProducts[index].currentHighestBid = auction.currentHighestBid;
                show.auctionProducts[index].highestBidder = auction.highestBidder;
                show.auctionProducts[index].bidderWon = auction.highestBidder;
                show.currentAuction = {
                  ...show.currentAuction,
                  bidderWon: auction.highestBidder,
                  currentHighestBid: auction.currentHighestBid,
                };
                await show.save();
                console.log(`🚀 Auction ended for stream ${uniqueStreamId}. Winner: ${auction.highestBidder?.name || "No one"} with bid $${auction.currentHighestBid}`);
                io.to(streamId).emit("auctionEnded", {
                  streamId,
                  highestBid: auction.currentHighestBid,
                  highestBidder: auction.highestBidder,
                  bidderWon: auction.highestBidder,
                  product,
                });
                delete auctions[uniqueStreamId];
              } catch (error) {
                console.error("❌ Error updating auction status:", error);
              }
            })();
          }
        }, 1000);
      }
    }
  });

  // Place Bid event.
  socket.on("placeBid", async ({ streamId, user, amount, uniqueStreamId }) => {
    console.log(`💰 New bid received from ${user.name} in stream ${streamId} for $${amount}`);
    if (redisState) {
      const auctionKey = `auction:${uniqueStreamId}`;
      if (!streamId || !user || !amount || !uniqueStreamId) {
        console.error("❌ Invalid bid data received.");
        socket.emit("bidRejected", {
          message: `Invalid bid data provided.`
        });
        return;
      }
      const auctionData = await redisClient.get(auctionKey);
      if (!auctionData) {
        socket.emit("bidRejected", { message: "Auction has not started yet or has ended" });
        return;
      }
      let auction = JSON.parse(auctionData);
      if (amount > auction.currentHighestBid) {
        auction.currentHighestBid = amount;
        auction.highestBidder = user;
        const [nextBid1, nextBid2] = calculateNextBids(amount);
        auction.nextBid1 = nextBid1;
        auction.nextBid2 = nextBid2;
        const remainingTime = Math.max(0, auction.endsAt - Date.now());
        if (auction.auctionType === "default" && remainingTime <= 10 * 1000) {
          if (!Number.isFinite(auction.endsAt)) {
            console.error("❌ Invalid `endsAt` detected. Resetting auction timer.");
            auction.endsAt = Date.now() + auction.increment * 1000;
          } else {
            auction.endsAt += auction.increment * 1000;
          }
          const newRemainingTime = Math.max(0, auction.endsAt - Date.now());
          console.log(`⏳ Timer extended by ${auction.increment} seconds! New timer: ${(newRemainingTime / 1000).toFixed(2)}s`);
        }
        await redisClient.set(auctionKey, JSON.stringify(auction));
        io.to(streamId).emit("bidUpdated", {
          streamId,
          highestBid: auction.currentHighestBid,
          highestBidder: auction.highestBidder,
          nextBids: [nextBid1, nextBid2],
          product: auction.product
        });
        try {
          const show = await Show.findById(streamId);
          if (!show) {
            console.error(`❌ Show with streamId ${streamId} not found!`);
            return;
          }
          const auctionIndex = show.auctionProducts.findIndex(a =>
            a.productId.toString() === auction.product.toString()
          );
          if (auctionIndex === -1) {
            console.error(`❌ Auction with product ${auction.product} not found in show`);
            return;
          }
          const auctionDataInDB = show.auctionProducts[auctionIndex];
          if (!auctionDataInDB.bids) {
            auctionDataInDB.bids = [];
          }
          auctionDataInDB.bids.push({ user: user._id, amount });
          auctionDataInDB.currentHighestBid = amount;
          auctionDataInDB.highestBidder = user._id;
          auctionDataInDB.nextBid1 = nextBid1;
          auctionDataInDB.nextBid2 = nextBid2;
          show.currentAuction = { ...auctionDataInDB };
          await show.save();
          console.log("✅ Bid saved inside auctionProducts successfully!");
        } catch (error) {
          console.error("❌ Error saving bid inside show:", error);
        }
      } else {
        socket.emit("bidRejected", { message: `Bid must be higher than ${auction.currentHighestBid}` });
      }
    } else {
      // Local in-memory bid handling.
      if (!streamId || !user || !amount || !uniqueStreamId) {
        console.error("❌ Invalid bid data received.");
        socket.emit("bidRejected", {
          message: `Invalid bid data provided.`
        });
        return;
      }
      const auction = auctions[uniqueStreamId];
      if (!auction) {
        socket.emit("bidRejected", { message: "Auction has not started yet" });
        return;
      }
      if (amount > auction.currentHighestBid) {
        auction.currentHighestBid = amount;
        auction.highestBidder = user;
        const [nextBid1, nextBid2] = calculateNextBids(amount);
        auction.nextBid1 = nextBid1;
        auction.nextBid2 = nextBid2;
        const remainingTime = Math.max(0, auction.endsAt - Date.now());
        if (auction.auctionType === "default" && remainingTime <= 10 * 1000) {
          if (!Number.isFinite(auction.endsAt)) {
            console.error("❌ Invalid `endsAt` detected. Resetting auction timer.");
            auction.endsAt = Date.now() + auction.increment * 1000;
          } else {
            auction.endsAt += auction.increment * 1000;
          }
          const newRemainingTime = Math.max(0, auction.endsAt - Date.now());
          console.log(`⏳ Timer extended by ${auction.increment} seconds! New timer: ${(newRemainingTime / 1000).toFixed(2)}s`);
        }
        io.to(streamId).emit("bidUpdated", {
          streamId,
          highestBid: auction.currentHighestBid,
          highestBidder: auction.highestBidder,
          nextBids: [nextBid1, nextBid2],
          product: auction.product
        });
        try {
          const show = await Show.findById(streamId);
          if (!show) {
            console.error(`❌ Show with streamId ${streamId} not found!`);
            return;
          }
          const auctionIndex = show.auctionProducts.findIndex(a =>
            a.productId.toString() === auction.product.toString()
          );
          if (auctionIndex === -1) {
            console.error(`❌ Auction with product ${auction.product} not found in show`);
            return;
          }
          const auctionDataInDB = show.auctionProducts[auctionIndex];
          if (!auctionDataInDB.bids) {
            auctionDataInDB.bids = [];
          }
          auctionDataInDB.bids.push({ user: user._id, amount });
          auctionDataInDB.currentHighestBid = amount;
          auctionDataInDB.highestBidder = user._id;
          auctionDataInDB.nextBid1 = nextBid1;
          auctionDataInDB.nextBid2 = nextBid2;
          show.currentAuction = { ...auctionDataInDB };
          await show.save();
          console.log("✅ Bid saved inside auctionProducts successfully!");
        } catch (error) {
          console.error("❌ Error saving bid inside show:", error);
        }
      } else {
        socket.emit("bidRejected", { message: `Bid must be higher than ${auction.currentHighestBid}` });
      }
    }
  });

  // Clear Auction event.
  socket.on("clearAuction", async (streamId, product) => {
    console.log("🟢 Clear Auction clicked for stream:", streamId);
    io.to(streamId).emit("clrScr");
    try {
      const updatedShow = await Show.findOneAndUpdate(
        { _id: streamId, "auctionProducts.productId": product },
        {
          $set: {
            "auctionProducts.$.isAuctionEnded": true,
            currentAuction: null
          }
        },
        { new: true }
      );
      if (!updatedShow) {
        console.error("❌ Show or product not found:", streamId, product);
        return;
      }
      console.log("✅ Auction cleared successfully for product:", product);
    } catch (error) {
      console.error("❌ Error clearing auction:", error);
    }
  });


  // Start Giveaway event.
  socket.on('startGiveaway', async ({ streamId, productId, productTitle, followersOnly }) => {
    console.log(`🎉 Giveaway started for product: ${productTitle} in stream: ${streamId}`);
    try {
      const show = await Show.findById(streamId);
      if (!show) {
        console.error("❌ Show not found:", streamId);
        return;
      }
      const giveawayKey = `${streamId}_${productId}`;
      const existingGiveaway = show.giveawayProducts.find(
        g => g.productId.toString() === productId
      );
      if (existingGiveaway) {
        io.to(streamId).emit('giveawayStarted', { ...existingGiveaway.toObject(), giveawayKey });
        console.log("ℹ️ Active giveaway already exists, re-emitting existing giveaway.");
        // --- New: Store giveaway state locally or in Redis ---
        if (redisState) {
          await redisClient.set(`giveaway:${giveawayKey}`, JSON.stringify(existingGiveaway));
          console.log("Giveaway saved in Redis:", existingGiveaway);
        } else {
          giveaways[giveawayKey] = existingGiveaway.toObject();
          console.log("Giveaway saved locally:", existingGiveaway);
        }
        return;
      }
      const newGiveaway = {
        streamId,
        productId,
        productTitle,
        followersOnly,
        isActive: true,
        applicants: [],
        winner: null,
        createdAt: new Date(),
      };
      show.giveawayProducts.push(newGiveaway);
      await show.save();
      io.to(streamId).emit('giveawayStarted', { ...newGiveaway, giveawayKey });
      console.log("✅ Giveaway stored in show successfully!");


    } catch (error) {
      console.error("❌ Error starting giveaway:", error);
    }
  });

  // Apply for Giveaway event.
  socket.on('applyGiveaway', async ({ streamId, productId, user }) => {
    const userId = user._id.toString();
    console.log(`📢 User ${userId} applied for giveaway ${productId}`);
    console.log("Giveaways:", giveaways);
    try {
      const show = await Show.findById(streamId);
      if (!show) return console.error("❌ Show not found");
      const giveawayIndex = show.giveawayProducts.findIndex(
        g => g.productId.toString() === productId && g.isActive
      );
      if (giveawayIndex === -1) return console.error("❌ Active giveaway not found");
      const alreadyApplied = show.giveawayProducts[giveawayIndex].applicants.some(
        applicant => applicant.toString() === userId
      );
      if (!alreadyApplied) {
        show.giveawayProducts[giveawayIndex].applicants.push(userId);
        await show.save();
        io.to(streamId).emit('giveawayApplicantsUpdated', {
          giveawayKey: `${streamId}_${productId}`,
          applicants: show.giveawayProducts[giveawayIndex].applicants,
        });
        console.log(`✅ User ${userId} added to giveaway applicants.`);

        // --- New: Update giveaway state in Redis or local memory ---
        const giveawayKey = `${streamId}_${productId}`;
        const updatedGiveaway = show.giveawayProducts[giveawayIndex];
        if (redisState) {
          await redisClient.set(`giveaway:${giveawayKey}`, JSON.stringify(updatedGiveaway));
          console.log("Giveaway updated in Redis:", updatedGiveaway);
        } else {
          giveaways[giveawayKey] = updatedGiveaway;
          console.log("Giveaway updated locally:", updatedGiveaway);
        }
      }
    } catch (error) {
      console.error("❌ Error applying for giveaway:", error);
    }
  });

  // Roll Giveaway event.
  socket.on('rollGiveaway', async ({ streamId, productId }) => {
    console.log(`🎲 Rolling for giveaway winner of product ${productId}`);
    try {
      const show = await Show.findById(streamId);
      if (!show) return console.error("❌ Show not found");
      const giveawayIndex = show.giveawayProducts.findIndex(
        g => g.productId.toString() === productId && g.isActive
      );
      if (giveawayIndex === -1) return console.error("❌ Active giveaway not found");
      const applicants = show.giveawayProducts[giveawayIndex].applicants;
      if (applicants.length === 0) {
        io.to(streamId).emit('noApplicants', { productId });
        return;
      }
      const winnerIndex = Math.floor(Math.random() * applicants.length);
      const winnerId = applicants[winnerIndex];
      const winnerUser = await User.findById(winnerId).lean();
      show.giveawayProducts[giveawayIndex].winner = winnerId;
      show.giveawayProducts[giveawayIndex].isActive = false;
      show.giveawayProducts[giveawayIndex].isGiveawayEnded = true;
      await show.save();
      io.to(streamId).emit('giveawayWinner', {
        giveawayKey: `${streamId}_${productId}`,
        productId,
        winner: winnerUser
      });
      console.log(`🏆 Winner selected: ${winnerId}`);

      // --- New: Remove giveaway state after completion ---
      if (redisState) {
        await redisClient.del(`giveaway:${streamId}_${productId}`);
        console.log("Giveaway removed from Redis for product:", productId);
      } else {
        delete giveaways[`${streamId}_${productId}`];
        console.log("Giveaway removed locally for product:", productId);
      }
    } catch (error) {
      console.error("❌ Error rolling giveaway winner:", error);
    }
  });


  // New Comment event.
  socket.on('newComment', async (comment) => {
    if (!comment || !comment.streamId || !comment.user || !comment.text) {
      console.log(chalk.yellow("⚠️ Received an invalid comment", comment));
      return;
    }
    try {
      const newComment = {
        user: comment.user,
        text: comment.text,
        createdAt: new Date(),
      };
      const updatedShow = await Show.findByIdAndUpdate(
        comment.streamId,
        { $push: { comments: newComment } },
        { new: true }
      ).populate("comments.user", "userName name emailId profileURL");
      if (!updatedShow) {
        console.log(chalk.red(`❌ Show not found for streamId: ${comment.streamId}`));
        return;
      }
      console.log(chalk.cyan("💬 New comment added to DB:", newComment));
      io.to(comment.streamId).emit(`commentAdded-${comment.streamId}`, newComment);
    } catch (error) {
      console.error(chalk.red("❌ Error saving comment:", error.message));
    }
  });

  // Toggle Like event.
  socket.on('toggleLike', async ({ streamId, userId }) => {
    if (!streamId || !userId) {
      console.log(chalk.yellow("⚠️ Invalid like request", { streamId, userId }));
      return;
    }
    try {
      const show = await Show.findById(streamId);
      if (!show) {
        console.log(chalk.red(`❌ Show not found for streamId: ${streamId}`));
        return;
      }
      let updatedShow;
      if (show.likedBy.includes(userId)) {
        updatedShow = await Show.findByIdAndUpdate(
          streamId,
          { $pull: { likedBy: userId }, $inc: { likes: -1 } },
          { new: true }
        );
      } else {
        updatedShow = await Show.findByIdAndUpdate(
          streamId,
          { $push: { likedBy: userId }, $inc: { likes: 1 } },
          { new: true }
        );
      }
      console.log(chalk.cyan(`👍 Updated likes for stream ${streamId}:`, updatedShow.likes));
      io.to(streamId).emit(`likesUpdated-${streamId}`, { likes: updatedShow.likes, likedBy: updatedShow.likedBy });
    } catch (error) {
      console.error(chalk.red("❌ Error handling like/unlike:", error.message));
    }
  });

  // Disconnect event.
  socket.on('disconnect', () => {
    console.log(chalk.red(`❌ User disconnected: ${socket.id}`));
  });
});

////////////////////////////////////////////////////////////////////////////////
// Connect to MongoDB and start the server.
connectDB()
  .then(() => {
    console.log(chalk.green.bold("🌐 MongoDB Connected Successfully..."));
    const PORT = process.env.PORT || 8081;
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
