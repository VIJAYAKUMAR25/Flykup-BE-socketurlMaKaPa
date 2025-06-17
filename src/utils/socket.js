// socket.js
import { Server } from 'socket.io';
import { createClient } from 'redis';
import chalk from 'chalk';
import Show from '../models/shows.model.js'; // Ensure correct path
import User from '../models/user.model.js'; // Ensure correct path

// Define a flag to control state storage: true = use Redis, false = use local in-memory object.
// IMPORTANT: This flag now only applies to AUCTIONS. Giveaways will always use DB + local in-memory cache.
const redisState = false; // Set to 'false' as requested for giveaways to use DB directly

// Initialize Redis client if redisState is true; otherwise, use local in-memory state.
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

    // Ensure connection is established before proceeding
    // Note: For production, consider using a more robust connection management.
    await redisClient.connect().catch(err => {
        console.error(chalk.red("❌ Failed to connect to Redis:", err));
        // process.exit(1); // Exit if Redis connection fails (optional, depending on your app's needs)
    });
} else {
    console.log(chalk.yellow.bold("🟡 Using local in-memory state for auctions (if applicable) and giveaways will use DB + local cache."));
}

// Local in-memory state (mainly for auctions, though currentGiveawayByStream is also here)
const auctions = {}; // Keyed by uniqueStreamId (still used if redisState is false for auctions)
const auctionIntervals = {}; // To keep track of timer intervals
const currentGiveawayByStream = {}; // This acts as a quick in-memory cache for the server instance.

// Helper function to calculate next bid suggestions
const calculateNextBids = (amnt, bidDirection) => {
    const increment = 50; // Fixed increment/decrement step

    if (bidDirection === 'incremental') {
        return [
            Math.round(amnt + increment),
            Math.round(amnt + increment * 2)
        ];
    } else if (bidDirection === 'decremental') {
        return [
            Math.max(0, Math.round(amnt - increment)),
            Math.max(0, Math.round(amnt - increment * 2))
        ];
    } else {
        throw new Error('Invalid bidDirection. Use "incremental" or "decremental".');
    }
};

export const initializeSocket = (server) => {
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
                "https://flykup-bidding.vercel.app",
                "https://flykup-fe-merged-new-3.vercel.app"
            ],
            credentials: true,
            methods: ["GET", "POST", "PUT"],
        },
        transports: ['websocket'],
        allowUpgrades: true,
    });

    io.on('connection', async (socket) => {
        console.log(chalk.blue(`🔗 User connected: ${socket.id}`));

        const { userId } = socket.handshake.auth || {};
        if (userId) {
            socket.data.userId = userId;
            try {
                await User.findByIdAndUpdate(userId, { socketId: socket.id });
                console.log(chalk.green(`✅ Updated socketId for user ${userId} to ${socket.id}`));
            } catch (err) {
                console.error(chalk.red(`❌ Error updating socketId for user ${userId}: ${err.message}`));
            }
        } else {
            console.warn(chalk.yellow(`⚠️ No userId provided in handshake for socket ${socket.id}`));
        }

        // Join a specific live stream room.
        socket.on('joinRoom', async (streamId) => {
            if (!streamId) {
                console.log(chalk.yellow(`⚠️ Missing streamId for user ${socket.id}`));
                return;
            }
            socket.join(streamId);
            // console.log(chalk.green(`✅ User ${socket.id} joined room: ${streamId}`));

            // Send existing auction state if applicable
            // ... (existing auction logic remains the same) ...
            if (redisState) {
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
                            product: auction.product,
                            bidDirection: auction.bidDirection,
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
                            bidDirection: auction.bidDirection,
                        });
                    }
                }
            } else {
                for (const key in auctions) {
                    if (auctions[key].streamId === streamId) {
                        console.log("🔍 Found auction in Local:", auctions[key]);
                        socket.emit('bidUpdated', {
                            streamId: auctions[key].streamId,
                            highestBid: auctions[key].currentHighestBid,
                            highestBidder: auctions[key].highestBidder,
                            nextBids: [auctions[key].nextBid1, auctions[key].nextBid2],
                            product: auctions[key].product,
                            bidDirection: auctions[key].bidDirection,
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
                            bidDirection: auctions[key].bidDirection,
                        });
                    }
                }
            }

            // --- GIVEAWAY HANDLING (NOW ONLY DB + LOCAL CACHE) ---
            try {
                // Fetch the show to get the current giveaway state from DB
                const show = await Show.findById(streamId).populate('currentGiveaway.productId');
                if (show && show.currentGiveaway && show.currentGiveaway.isActive && !show.currentGiveaway.isGiveawayEnded) {
                    // Update local cache
                    currentGiveawayByStream[streamId] = show.currentGiveaway.toObject(); 
                    // Emit to the newly joined client about the active giveaway
                    socket.emit('giveawayStarted', currentGiveawayByStream[streamId]);
                    // Also emit current applicants count in case it updated while this client was disconnected
                    socket.emit('giveawayApplicantsUpdated', currentGiveawayByStream[streamId]);
                } else {
                    // Ensure local cache is clear if no active giveaway in DB
                    delete currentGiveawayByStream[streamId];
                    // If no active giveaway, inform the client to clear any existing giveaway display
                    socket.emit('giveawayEndedManually', { streamId: streamId, productId: null, message: "No active giveaway." });
                }
            } catch (error) {
                console.error(chalk.red(`❌ Error fetching active giveaway for stream ${streamId} on join: ${error.message}`));
            }
        });

        // Start Auction event.
        // ... (existing auction logic remains the same) ...
        socket.on("startAuction", async ({ streamId, product, timer, auctionType, bidDirection, increment, startingBid, reservedPrice }) => {
            io.emit("clrScr");
            console.log("startAuction clicked with stream ID", streamId);
            const uniqueStreamId = `${streamId}_${product}`;

            if (redisState) {
                const auctionKey = `auction:${uniqueStreamId}`;
                const exists = await redisClient.exists(auctionKey);
                if (!exists) {
                    const endsAt = Date.now() + timer * 1000;
                    const [nextBid1, nextBid2] = calculateNextBids(startingBid, bidDirection);

                    const show = await Show.findById(streamId);
                    if (!show) {
                        console.error(`❌ Show with streamId ${streamId} not found!`);
                        return;
                    }
                    const auctionNumbers = show.auctionProducts
                        .filter(a => a.productId.toString() !== product.toString())
                        .map(a => a.auctionNumber)
                        .filter(num => num !== undefined && num !== null);

                    const auctionNumber = auctionNumbers.length > 0
                        ? Math.max(...auctionNumbers) + 1
                        : 1;

                    const newAuction = {
                        streamId, product, auctionType, startingBid: Number(startingBid),
                        increment, endsAt, isActive: true, bids: [], currentHighestBid: Number(startingBid),
                        highestBidder: null, uniqueStreamId, nextBid1, nextBid2, auctionNumber,
                        reservedPrice: Number(reservedPrice), bidDirection,
                    };

                    try {
                        const show = await Show.findById(streamId);
                        if (!show) {
                            console.error(`❌ Show with streamId ${streamId} not found!`);
                            return;
                        }
                        const auctionIndex = show.auctionProducts.findIndex(a => a.productId.toString() === product.toString());
                        if (auctionIndex !== -1) {
                            Object.assign(show.auctionProducts[auctionIndex], newAuction); // Update existing
                        } else {
                            show.auctionProducts.push(newAuction); // Add new
                        }
                        show.currentAuction = { ...newAuction, uniqueStreamId };
                        await show.save();
                    } catch (error) {
                        console.error("Error saving auction inside show:", error);
                    }

                    await redisClient.set(auctionKey, JSON.stringify(newAuction));
                    console.log("Auction saved in Redis:", newAuction);

                    io.emit("auctionStarted", {
                        streamId, product, endsAt, auctionType, increment, startingBid,
                        uniqueStreamId, nextBids: [nextBid1, nextBid2], auctionNumber, reservedPrice,
                    });

                    auctionIntervals[uniqueStreamId] = setInterval(async () => {
                        const auctionData = await redisClient.get(auctionKey);
                        if (!auctionData) {
                            clearInterval(auctionIntervals[uniqueStreamId]);
                            return;
                        }
                        const auction = JSON.parse(auctionData);
                        const remainingTime = Math.max(0, auction.endsAt - Date.now());
                        io.emit("timerUpdate", { remainingTime, product });

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
                                show.currentAuction = null; // Clear current auction after it ends
                                await show.save();
                                console.log(`🚀 Auction ended for stream ${uniqueStreamId}. Winner: ${auction.highestBidder?.name || "No one"} with bid $${auction.currentHighestBid}`);
                                io.emit("auctionEnded", {
                                    streamId, highestBid: auction.currentHighestBid, highestBidder: auction.highestBidder,
                                    bidderWon: auction.highestBidder, product,
                                });
                                await redisClient.del(auctionKey);
                            } catch (error) {
                                console.error("❌ Error updating auction status:", error);
                            }
                        }
                    }, 1000);
                }
            } else {
                if (!auctions[uniqueStreamId]) {
                    const endsAt = Date.now() + timer * 1000;
                    const [nextBid1, nextBid2] = calculateNextBids(startingBid, bidDirection);

                    const show = await Show.findById(streamId);
                    if (!show) {
                        console.error(`❌ Show with streamId ${streamId} not found!`);
                        return;
                    }
                    const auctionNumbers = show.auctionProducts
                        .filter(a => a.productId.toString() !== product.toString())
                        .map(a => a.auctionNumber)
                        .filter(num => num !== undefined && num !== null);

                    const auctionNumber = auctionNumbers.length > 0
                        ? Math.max(...auctionNumbers) + 1
                        : 1;

                    const newAuction = {
                        streamId, product, auctionType, startingBid: Number(startingBid),
                        increment, endsAt, isActive: true, bids: [], currentHighestBid: Number(startingBid),
                        highestBidder: null, uniqueStreamId, nextBid1, nextBid2, auctionNumber,
                        reservedPrice: Number(reservedPrice), bidDirection,
                    };

                    try {
                        const show = await Show.findById(streamId);
                        if (!show) {
                            console.error(`❌ Show with streamId ${streamId} not found!`);
                            return;
                        }
                        const auctionIndex = show.auctionProducts.findIndex(a => a.productId.toString() === product.toString());
                        if (auctionIndex !== -1) {
                            Object.assign(show.auctionProducts[auctionIndex], newAuction);
                        } else {
                            show.auctionProducts.push(newAuction);
                        }
                        show.currentAuction = { ...newAuction, uniqueStreamId };
                        await show.save();
                    } catch (error) {
                        console.error("Error saving auction inside show:", error);
                    }
                    auctions[uniqueStreamId] = newAuction;
                    console.log("Auction saved locally:", newAuction);
                    io.emit("auctionStarted", {
                        streamId, product, endsAt, auctionType, increment, startingBid,
                        uniqueStreamId, nextBids: [nextBid1, nextBid2],
                    });
                    auctionIntervals[uniqueStreamId] = setInterval(() => {
                        const auction = auctions[uniqueStreamId];
                        if (!auction) {
                            clearInterval(auctionIntervals[uniqueStreamId]);
                            return;
                        }
                        const remainingTime = Math.max(0, auction.endsAt - Date.now());
                        io.emit("timerUpdate", { remainingTime, product });

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
                                    show.currentAuction = null; 
                                    await show.save();
                                    console.log(`🚀 Auction ended for stream ${uniqueStreamId}. Winner: ${auction.highestBidder?.name || "No one"} with bid $${auction.currentHighestBid}`);
                                    io.emit("auctionEnded", {
                                        streamId, highestBid: auction.currentHighestBid, highestBidder: auction.highestBidder,
                                        bidderWon: auction.highestBidder, product,
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
        // ... (existing auction logic remains the same) ...
        socket.on("placeBid", async ({ streamId, user, amount, uniqueStreamId }) => {
            console.log(`💰 New bid received from ${user.name} in stream ${streamId} for $${amount}`);
            if (redisState) {
                const auctionKey = `auction:${uniqueStreamId}`;
                if (!streamId || !user || !amount || !uniqueStreamId) {
                    console.error("❌ Invalid bid data received.");
                    socket.emit("bidRejected", { message: `Invalid bid data provided.` });
                    return;
                }
                const auctionData = await redisClient.get(auctionKey);
                if (!auctionData) {
                    socket.emit("bidRejected", { message: "Auction has not started yet or has ended" });
                    return;
                }
                let auction = JSON.parse(auctionData);
                if (auction.bidDirection === "incremental" && amount > auction.currentHighestBid) {
                    auction.currentHighestBid = amount;
                    auction.highestBidder = user;
                    const [nextBid1, nextBid2] = calculateNextBids(amount, auction.bidDirection);
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
                    }
                    await redisClient.set(auctionKey, JSON.stringify(auction));
                    io.emit("bidUpdated", {
                        streamId, highestBid: auction.currentHighestBid, highestBidder: auction.highestBidder,
                        nextBids: [nextBid1, nextBid2], product: auction.product
                    });
                    try {
                        const show = await Show.findById(streamId);
                        if (!show) { console.error(`❌ Show with streamId ${streamId} not found!`); return; }
                        const auctionIndex = show.auctionProducts.findIndex(a => a.productId.toString() === auction.product.toString());
                        if (auctionIndex === -1) { console.error(`❌ Auction with product ${auction.product} not found in show`); return; }
                        const auctionDataInDB = show.auctionProducts[auctionIndex];
                        if (!auctionDataInDB.bids) { auctionDataInDB.bids = []; }
                        auctionDataInDB.bids.push({ user: user._id, amount });
                        auctionDataInDB.currentHighestBid = amount;
                        auctionDataInDB.highestBidder = user._id;
                        auctionDataInDB.nextBid1 = nextBid1;
                        auctionDataInDB.nextBid2 = nextBid2;
                        show.currentAuction = { ...auctionDataInDB };
                        await show.save();
                        console.log("✅ Bid saved inside auctionProducts successfully!");
                    } catch (error) { console.error("❌ Error saving bid inside show:", error); }
                } else if (auction.bidDirection === "decremental" && amount < auction.currentHighestBid) {
                    auction.currentHighestBid = amount;
                    auction.highestBidder = user;
                    const [nextBid1, nextBid2] = calculateNextBids(amount, auction.bidDirection);
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
                    }
                    await redisClient.set(auctionKey, JSON.stringify(auction));
                    io.emit("bidUpdated", {
                        streamId, highestBid: auction.currentHighestBid, highestBidder: auction.highestBidder,
                        nextBids: [nextBid1, nextBid2], product: auction.product
                    });
                    try {
                        const show = await Show.findById(streamId);
                        if (!show) { console.error(`❌ Show with streamId ${streamId} not found!`); return; }
                        const auctionIndex = show.auctionProducts.findIndex(a => a.productId.toString() === auction.product.toString());
                        if (auctionIndex === -1) { console.error(`❌ Auction with product ${auction.product} not found in show`); return; }
                        const auctionDataInDB = show.auctionProducts[auctionIndex];
                        if (!auctionDataInDB.bids) { auctionDataInDB.bids = []; }
                        auctionDataInDB.bids.push({ user: user._id, amount });
                        auctionDataInDB.currentHighestBid = amount;
                        auctionDataInDB.highestBidder = user._id;
                        auctionDataInDB.nextBid1 = nextBid1;
                        auctionDataInDB.nextBid2 = nextBid2;
                        show.currentAuction = { ...auctionDataInDB };
                        await show.save();
                        console.log("✅ Bid saved inside auctionProducts successfully!");
                    } catch (error) { console.error("❌ Error saving bid inside show:", error); }
                }
                else {
                    socket.emit("bidRejected", { message: `Bid must be higher than ${auction.currentHighestBid}` });
                }
            } else {
                if (!streamId || !user || !amount || !uniqueStreamId) {
                    console.error("❌ Invalid bid data received.");
                    socket.emit("bidRejected", { message: `Invalid bid data provided.` });
                    return;
                }
                const auction = auctions[uniqueStreamId];
                if (!auction) {
                    socket.emit("bidRejected", { message: "Auction has not started yet" });
                    return;
                }
                const bidDirection = auction.bidDirection;

                if (bidDirection === "incremental" && amount > auction.currentHighestBid) {
                    auction.currentHighestBid = amount;
                    auction.highestBidder = user;
                    const [nextBid1, nextBid2] = calculateNextBids(amount, bidDirection);
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
                    }
                    io.emit("bidUpdated", {
                        streamId, highestBid: auction.currentHighestBid, highestBidder: auction.highestBidder,
                        nextBids: [nextBid1, nextBid2], product: auction.product
                    });
                    try {
                        const show = await Show.findById(streamId);
                        if (!show) { console.error(`❌ Show with streamId ${streamId} not found!`); return; }
                        const auctionIndex = show.auctionProducts.findIndex(a => a.productId.toString() === auction.product.toString());
                        if (auctionIndex === -1) { console.error(`❌ Auction with product ${auction.product} not found in show`); return; }
                        const auctionDataInDB = show.auctionProducts[auctionIndex];
                        if (!auctionDataInDB.bids) { auctionDataInDB.bids = []; }
                        auctionDataInDB.bids.push({ user: user._id, amount });
                        auctionDataInDB.currentHighestBid = amount;
                        auctionDataInDB.highestBidder = user._id;
                        auctionDataInDB.nextBid1 = nextBid1;
                        auctionDataInDB.nextBid2 = nextBid2;
                        show.currentAuction = { ...auctionDataInDB };
                        await show.save();
                        console.log("✅ Bid saved inside auctionProducts successfully!");
                    } catch (error) { console.error("❌ Error saving bid inside show:", error); }
                } else if (bidDirection === "decremental" && amount < auction.currentHighestBid) {
                    auction.currentHighestBid = amount;
                    auction.highestBidder = user;
                    const [nextBid1, nextBid2] = calculateNextBids(amount, bidDirection);
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
                    }
                    io.emit("bidUpdated", {
                        streamId, highestBid: auction.currentHighestBid, highestBidder: auction.highestBidder,
                        nextBids: [nextBid1, nextBid2], product: auction.product
                    });
                    try {
                        const show = await Show.findById(streamId);
                        if (!show) { console.error(`❌ Show with streamId ${streamId} not found!`); return; }
                        const auctionIndex = show.auctionProducts.findIndex(a => a.productId.toString() === auction.product.toString());
                        if (auctionIndex === -1) { console.error(`❌ Auction with product ${auction.product} not found in show`); return; }
                        const auctionDataInDB = show.auctionProducts[auctionIndex];
                        if (!auctionDataInDB.bids) { auctionDataInDB.bids = []; }
                        auctionDataInDB.bids.push({ user: user._id, amount });
                        auctionDataInDB.currentHighestBid = amount;
                        auctionDataInDB.highestBidder = user._id;
                        auctionDataInDB.nextBid1 = nextBid1;
                        auctionDataInDB.nextBid2 = nextBid2;
                        show.currentAuction = { ...auctionDataInDB };
                        await show.save();
                        console.log("✅ Bid saved inside auctionProducts successfully!");
                    } catch (error) { console.error("❌ Error saving bid inside show:", error); }
                } else {
                    socket.emit("bidRejected", { message: `Bid must be higher than ${auction.currentHighestBid}` });
                }
            }
        });

        // Clear Auction event.
        // ... (existing auction logic remains the same) ...
        socket.on("clearAuction", async (streamId, product) => {
            console.log("🟢 Clear Auction clicked for stream:", streamId);
            io.emit("clrScr");
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

        // --- Start Giveaway event. (Modified to use DB directly for state) ---
        socket.on('startGiveaway', async ({ streamId, productId, productTitle, followersOnly, productOwnerSellerId }) => {
            console.log(`🎉 Host trying to start giveaway for product: ${productTitle} in stream: ${streamId}`);
            try {
                const show = await Show.findById(streamId).lean(); // Use .lean() to get a plain JS object

                if (!show) {
                    console.error("❌ Show not found:", streamId);
                    return;
                }

                if (show.currentGiveaway && show.currentGiveaway.isActive && !show.currentGiveaway.isGiveawayEnded) {
                    console.log("⚠️ Another giveaway is already active for this stream. Cannot start a new one.");
                    socket.emit('giveawayAlreadyActive', { message: 'Another giveaway is currently active. Please end it first.' });
                    return;
                }

                const productToActivate = show.giveawayProducts.find(
                    p => p.productId && p.productId.toString() === productId
                );

                if (!productToActivate) {
                    console.error(`❌ Product ${productId} not found in giveawayProducts for show ${streamId}`);
                    socket.emit('giveawayError', { message: 'Giveaway product not found in show\'s list.' });
                    return;
                }

                const currentMaxGiveawayNumber = show.giveawayProducts.reduce((max, g) => Math.max(max, g.giveawayNumber || 0), 0);
                const newGiveawayNumber = currentMaxGiveawayNumber + 1;

                const newActiveGiveaway = {
                    productId: productToActivate.productId,
                    productOwnerSellerId: productToActivate.productOwnerSellerId,
                    streamId: streamId, // IMPORTANT: Keep streamId in the payload
                    productTitle: productToActivate.productTitle || productToActivate.productId?.title || productTitle,
                    followersOnly: productToActivate.followersOnly || followersOnly,
                    isActive: true,
                    isGiveawayEnded: false,
                    isRolling: false, // New field: not rolling yet
                    applicants: [],
                    winner: null,
                    createdAt: new Date(),
                    giveawayNumber: newGiveawayNumber,
                };

                await Show.findByIdAndUpdate(
                    streamId,
                    { $set: { currentGiveaway: newActiveGiveaway } },
                    { new: true, runValidators: true, context: 'query' }
                );
                await Show.updateOne(
                    { _id: streamId, "giveawayProducts.productId": productToActivate.productId },
                    {
                        $set: {
                            "giveawayProducts.$.isActive": true,
                            "giveawayProducts.$.isGiveawayEnded": false,
                            "giveawayProducts.$.isRolling": false, // New field
                            "giveawayProducts.$.applicants": [],
                            "giveawayProducts.$.winner": null,
                            "giveawayProducts.$.createdAt": newActiveGiveaway.createdAt,
                            "giveawayProducts.$.giveawayNumber": newActiveGiveaway.giveawayNumber,
                        }
                    }
                );

                const latestShow = await Show.findById(streamId).populate('currentGiveaway.productId');

                if (!latestShow || !latestShow.currentGiveaway) {
                    console.error("❌ Failed to fetch latest show with populated currentGiveaway after starting it.");
                    return;
                }

                console.log("✅ Current giveaway set in show successfully:", latestShow.currentGiveaway.productTitle);

                currentGiveawayByStream[streamId] = latestShow.currentGiveaway.toObject();
                currentGiveawayByStream[streamId].productId = latestShow.currentGiveaway.productId;

                io.emit('giveawayStarted', currentGiveawayByStream[streamId]); 

            } catch (error) {
                console.error("❌ Error starting giveaway:", error.message, error.stack);
                if (error.name === 'VersionError') {
                    socket.emit('giveawayError', { message: 'Failed to start giveaway due to a conflict. Please try again.' });
                } else {
                    socket.emit('giveawayError', { message: `Error starting giveaway: ${error.message}` });
                }
            }
        });


        // --- Apply for Giveaway event. (Modified to use DB directly for state) ---
        socket.on('applyGiveaway', async ({ streamId, productId, user }) => {
            const userId = user._id.toString();
            console.log(`📢 User ${user.userName || user.name} applied for giveaway ${productId} in stream ${streamId}`);
            console.log("receving data from apply from front end", { streamId, productId, userId }); 
            try {
                // Fetch the show document to get the current state and prevent race conditions
                const show = await Show.findById(streamId);
                if (!show) {
                    console.error("❌ Show not found.");
                    socket.emit("giveawayApplicationRejected", { message: "Show not found." });
                    return;
                }

                let activeGiveaway = show.currentGiveaway;

                // Ensure the product ID matches and giveaway is active and not ended
                if (!activeGiveaway || !activeGiveaway.isActive || activeGiveaway.isGiveawayEnded || activeGiveaway.productId.toString() !== productId) {
                    console.error("❌ No active giveaway for this product, or giveaway has ended, or product ID mismatch.");
                    socket.emit("giveawayApplicationRejected", { message: "No active giveaway for this product, or giveaway has ended." });
                    return;
                }

                // Check if user already applied (using Array.prototype.some for better readability)
                const alreadyApplied = activeGiveaway.applicants.some(
                    applicantId => applicantId.toString() === userId
                );

                if (alreadyApplied) {
                    console.log(`ℹ️ User ${userId} already applied for giveaway ${productId}`);
                    socket.emit("giveawayApplicationRejected", { message: "You have already applied for this giveaway." });
                    return;
                }

                // Add applicant to the currentGiveaway's applicants array
                activeGiveaway.applicants.push(userId);

                // Update ONLY the currentGiveaway subdocument in the show using $set for direct modification
                // and then explicitly mark the overall document as modified for nested arrays
                const updatedShow = await Show.findByIdAndUpdate(
                    streamId,
                    { $set: { "currentGiveaway.applicants": activeGiveaway.applicants } },
                    { new: true } // Return the updated document
                );

                if (!updatedShow) {
                    console.error(`❌ Failed to update show ${streamId} with new applicant.`);
                    socket.emit('giveawayError', { message: 'Failed to update giveaway application.' });
                    return;
                }

                // Fetch the updated `currentGiveaway` from the database to send it back with populated product
                const latestGiveaway = await Show.findById(streamId).select('currentGiveaway').populate('currentGiveaway.productId');

                if (!latestGiveaway || !latestGiveaway.currentGiveaway) {
                    console.error("Could not retrieve latest currentGiveaway after update.");
                    return;
                }
                const giveawayToEmit = latestGiveaway.currentGiveaway.toObject();
                giveawayToEmit.productId = latestGiveaway.currentGiveaway.productId; // Ensure populated product data

                // console.log(`✅ User ${user.userName || user.name} added to active giveaway applicants in DB. Current applicants: ${giveawayToEmit.applicants.length}`);

                // Update local in-memory cache
                currentGiveawayByStream[streamId] = giveawayToEmit;

                io.emit('giveawayApplicantsUpdated', giveawayToEmit);
                console.log("Applicants count increse before emit", giveawayToEmit.applicants.length);
            } catch (error) {
                console.error("❌ Error applying for giveaway:", error);
                socket.emit('giveawayError', { message: `Error applying for giveaway: ${error.message}` });
            }
        });

        // --- Roll Giveaway event. (Modified to use DB directly for state) ---
        socket.on('rollGiveaway', async ({ streamId, productId }) => {
            console.log(`🎲 Host trying to roll for giveaway winner of product ${productId} in stream: ${streamId}`);

            try {
                const show = await Show.findById(streamId).populate('currentGiveaway.productId');

                if (!show) {
                    console.error("❌ Roll Giveaway: Show not found for ID:", streamId);
                    socket.emit('giveawayRollRejected', { message: 'Show not found.' });
                    return;
                }

                let activeGiveaway = show.currentGiveaway;

                // Validate the active giveaway state
                if (!activeGiveaway || !activeGiveaway.isActive || activeGiveaway.isGiveawayEnded || activeGiveaway.isRolling) {
                    console.error("❌ Roll Giveaway: No current active giveaway found, or it's already ended/rolling.");
                    socket.emit('giveawayRollRejected', { message: 'No active giveaway to roll, or it\'s already rolling/ended.' });
                    return;
                }

                if (!activeGiveaway.productId || activeGiveaway.productId._id.toString() !== productId) {
                    console.error(`❌ Roll Giveaway: Product ID mismatch. Expected ${activeGiveaway.productId ? activeGiveaway.productId._id.toString() : 'N/A'}, got ${productId}.`);
                    socket.emit('giveawayRollRejected', { message: 'Product ID mismatch for active giveaway.' });
                    return;
                }

                const applicants = activeGiveaway.applicants;
                if (applicants.length === 0) {
                    io.emit('noApplicants', { productId });
                    socket.emit('giveawayRollRejected', { message: 'No applicants for this giveaway yet.' });
                    return;
                }

                // --- START ROLLING EFFECT ---
                activeGiveaway.isRolling = true; // Set rolling state
                await Show.findByIdAndUpdate(
                    streamId,
                    { $set: { "currentGiveaway.isRolling": true } },
                    { new: true }
                );
                currentGiveawayByStream[streamId].isRolling = true; // Update local cache

                // Emit to all clients that rolling has started
                io.emit('giveawayRolling', { streamId, productId, applicants: activeGiveaway.applicants }); // Send applicants for frontend rolling effect

                // Set a timeout for the 5-second rolling period
                setTimeout(async () => {
                    try {
                        const winnerIndex = Math.floor(Math.random() * applicants.length);
                        const winnerId = applicants[winnerIndex];
                        const winnerUser = await User.findById(winnerId).lean();

                        // --- SELECT WINNER AND END GIVEAWAY ---
                        const updatedShow = await Show.findById(streamId); // Re-fetch to ensure we have the latest document for update
                        if (!updatedShow) {
                            console.error("❌ Show not found during winner selection cleanup.");
                            return;
                        }

                        let finalActiveGiveaway = updatedShow.currentGiveaway;
                        if (!finalActiveGiveaway || finalActiveGiveaway.productId.toString() !== productId) {
                             console.error("❌ Active giveaway changed or cleared unexpectedly during winner selection.");
                             return;
                        }

                        // Update the active giveaway for termination
                        finalActiveGiveaway.winner = winnerId;
                        finalActiveGiveaway.isActive = false;
                        finalActiveGiveaway.isGiveawayEnded = true;
                        finalActiveGiveaway.isRolling = false; // Rolling ends

                        // Find and update the historical entry in giveawayProducts
                        const indexInGiveawayProducts = updatedShow.giveawayProducts.findIndex(
                            p => p.productId && p.productId.toString() === productId
                        );

                        if (indexInGiveawayProducts !== -1) {
                            Object.assign(updatedShow.giveawayProducts[indexInGiveawayProducts], {
                                winner: winnerId,
                                isActive: false,
                                isGiveawayEnded: true,
                                isRolling: false, // Ensure this is also false in historical record
                                applicants: finalActiveGiveaway.applicants, // Preserve final applicants list
                            });
                        } else {
                            console.warn(`⚠️ Could not find product ${productId} in giveawayProducts array for historical update after rolling.`);
                        }

                        updatedShow.currentGiveaway = null; // Clear the active giveaway
                        await updatedShow.save();
                        console.log(`🏆 Winner selected: ${winnerUser?.name || winnerUser?.userName || winnerId} for product ${finalActiveGiveaway.productTitle}. Current giveaway cleared.`);

                        delete currentGiveawayByStream[streamId]; // Clear local cache

                        io.emit('giveawayWinner', {
                            streamId,
                            productId: productId, // Send as string ID
                            winner: winnerUser, // Send populated winner user object
                            productTitle: finalActiveGiveaway.productTitle,
                            isGiveawayEnded: true,
                        });

                    } catch (error) {
                        console.error("❌ Error during giveaway winner selection or update:", error.message, error.stack);
                        // Attempt to revert isRolling if an error occurs during selection/save
                        try {
                            const failedShow = await Show.findById(streamId);
                            if (failedShow && failedShow.currentGiveaway && failedShow.currentGiveaway.productId.toString() === productId) {
                                failedShow.currentGiveaway.isRolling = false;
                                await failedShow.save();
                                currentGiveawayByStream[streamId].isRolling = false;
                                io.to(streamId).emit('giveawayError', { message: 'Rolling failed, please try again.' });
                            }
                        } catch (revertError) {
                            console.error("❌ Failed to revert isRolling state:", revertError);
                        }
                    }
                }, 5000); // 5-second delay
            } catch (error) {
                console.error("❌ Critical Error in rollGiveaway (initial stage):", error.message, error.stack);
                socket.emit('giveawayError', { message: `Error rolling winner: ${error.message}` });
            }
        });

        // --- Manually end Giveaway event. (Modified to use DB directly for state) ---
        socket.on('endGiveawayManual', async ({ streamId, productId }) => {
            console.log(`🛑 Host manually ending giveaway for product: ${productId} in stream: ${streamId}`);
            try {
                const show = await Show.findById(streamId).populate('currentGiveaway.productId');
                if (!show) {
                    console.error("❌ Show not found:", streamId);
                    socket.emit('giveawayError', { message: 'Show not found.' });
                    return;
                }

                let activeGiveaway = show.currentGiveaway;
                if (!activeGiveaway || !activeGiveaway.isActive || activeGiveaway.isGiveawayEnded || activeGiveaway.productId.toString() !== productId) {
                    console.error("❌ No active giveaway for this product to end manually, or it's already ended.");
                    socket.emit('giveawayError', { message: 'No active giveaway for this product to end manually.' });
                    return;
                }

                // Update status for manual end (no winner)
                activeGiveaway.isActive = false;
                activeGiveaway.isGiveawayEnded = true;
                activeGiveaway.isRolling = false; // Ensure rolling is stopped
                activeGiveaway.winner = null; // Ensure winner is null if manually ended

                // Find the index of the product in the main `giveawayProducts` array and update it
                const indexInGiveawayProducts = show.giveawayProducts.findIndex(
                    p => p.productId && p.productId.toString() === productId
                );

                if (indexInGiveawayProducts !== -1) {
                    Object.assign(show.giveawayProducts[indexInGiveawayProducts], {
                        isActive: false,
                        isGiveawayEnded: true,
                        isRolling: false, // Ensure this is also false
                        winner: null,
                        applicants: activeGiveaway.applicants, // Persist applicants to historical record
                        createdAt: activeGiveaway.createdAt, // Maintain original creation time
                        giveawayNumber: activeGiveaway.giveawayNumber
                    });
                }

                // Clear the `currentGiveaway` field
                show.currentGiveaway = null; // Set to null to explicitly clear

                await show.save();

                // Clear local in-memory cache
                delete currentGiveawayByStream[streamId];

                io.emit('giveawayEndedManually', {
                    streamId,
                    productId: productId,
                    productTitle: activeGiveaway.productTitle,
                    message: `Giveaway for ${activeGiveaway.productTitle} has been cancelled by host.`
                });
                console.log(`✅ Giveaway for product ${productId} ended manually.`);

            } catch (error) {
                console.error("❌ Error ending giveaway manually:", error);
                socket.emit('giveawayError', { message: `Error ending giveaway: ${error.message}` });
            }
        });


        // New Comment event.
        // ... (existing comment logic remains the same) ...
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
                io.to(comment.streamId).emit(`commentAdded-${comment.streamId}`, newComment);
            } catch (error) {
                console.error(chalk.red("❌ Error saving comment:", error.message));
            }
        });

        // Toggle Like event.
        // ... (existing like logic remains the same) ...
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
                io.to(streamId).emit(`likesUpdated-${streamId}`, { likes: updatedShow.likes, likedBy: updatedShow.likedBy });
            } catch (error) {
                console.error(chalk.red("❌ Error handling like/unlike:", error.message));
            }
        });

        // Disconnect event.
        // ... (existing disconnect logic remains the same) ...
        socket.on('disconnect', async () => {
            console.log(chalk.red(`❌ User disconnected: ${socket.id}`));
            const storedUserId = socket.data.userId;
            if (storedUserId) {
                try {
                    await User.findByIdAndUpdate(storedUserId, { $unset: { socketId: "" } });
                    console.log(chalk.green(`✅ Removed socketId for user ${storedUserId}`));
                } catch (err) {
                    console.error(chalk.red(`❌ Error removing socketId for user ${storedUserId}: ${err.message}`));
                }
            }
        });
    });

    return io;
};

export default initializeSocket;