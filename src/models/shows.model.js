import mongoose from 'mongoose';
const { Schema } = mongoose;

// Comment Schema
const commentSchema = new Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users', // Reference to the User model
        // required: true,
    },
    text: {
        type: String,
        // required: true,
    },
    timeStamp: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const bidSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users", // Reference to the User model
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Auction Schema
const auctionSchema = new mongoose.Schema({
    streamId: {
        type: String,
    },
    product: {
        type: String,
    },
    auctionType: {
        type: String, // 'default' or other types
    },
    bidDirection: {
        type: String,
        enum: ['incremental', 'decremental'],
        default: 'incremental',
    },
    startingBid: {
        type: Number,
    },
    reservedPrice: {
        type: Number,
    },
    increment: {
        type: Number,
        default: 500,
    },
    currentHighestBid: {
        type: Number,
        default: 0,
    },
    nextBid1: {
        type: Number,
        default: 0,
    },
    nextBid2: {
        type: Number,
        default: 0,
    },
    highestBidder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users", // Store reference to the highest bidder
        default: null,
    },
    bidderWon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users", // Store reference to the highest bidder
        default: null,
    },
    bids: [bidSchema], // Array of bids
    endsAt: {
        type: Date,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    uniqueStreamId: {
        type: String,
    },
    auctionNumber: {  // <-- New field in auctionProducts sub-schema
        type: Number,
    }
}, { timestamps: true });


// Show Schema
const showSchema = new Schema(
    {
        // === MODIFIED START: Host Information ===
        sellerId: {  // <--- REMOVE or comment out this line
            type: mongoose.Schema.Types.ObjectId,
            ref: "sellers",
        },
        host: { // New field for the host (Seller or Dropshipper)
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'hostModel' // Dynamic reference
        },
        hostModel: { // New field to define the type of host
            type: String,
            required: true,
            enum: ['sellers', 'dropshippers'] // Allowed host types
        },
        // === MODIFIED END: Host Information ===

        title: {
            type: String,
            required: true,
        },
        date: {
            type: Date,
        },
        time: {
            type: String,
        },
        category: {
            type: String,
        },
        subCategory: {
            type: String,
            default: '',
        },
        streamName: {
            type: String,
            default: ''
        },
        tags: {
            type: [String],
            default: [],
        },

        thumbnailImage: {
            type: String, // URL or file path
            default: null,
        },
        previewVideo: {
            type: String, // URL or file path
            default: null,
        },
        language: {
            type: String,
        },
        isLive: {
            type: Boolean,
            default: false,
        },
        streamUrl: {
            type: String, // URL for the live stream
            default: null,
        },
        showStatus: {
            type: String,
            enum: ['created', 'live', 'cancelled', 'ended'],
            default: 'created'
        },
        comments: [commentSchema], // Array of comments
        likes: {
            type: Number,
            default: 0,
        },
        likedBy: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'users',
            default: [],
        },
        // auctions: [auctionSchema], // Array of auctions
        currentAuction: auctionSchema,
        buyNowProducts: {
            type: [
                {
                    _id: false,
                    productId: { type: Schema.Types.ObjectId, ref: "productlistings" },
                    // --- ADDED productOwnerSellerId ---
                    productOwnerSellerId: { type: Schema.Types.ObjectId, ref: 'sellers', required: true },
                    productPrice: { type: Number, min: 0, default: null }, // Price set by host for this show
                },
            ],
            default: [],
        },
        auctionProducts: {
            type: [
                {
                    _id: false,
                    productId: { type: Schema.Types.ObjectId, ref: "productlistings" },
                    // --- ADDED productOwnerSellerId ---
                    productOwnerSellerId: { type: Schema.Types.ObjectId, ref: 'sellers', required: true },
                    startingPrice: { type: Number, min: 0, default: null },
                    reservedPrice: { type: Number, min: 0, default: null },
                    isAuctionEnded: {
                        type: Boolean,
                        default: false
                    },
                    streamId: {
                        type: String,
                    },
                    // product: {
                    //     type: String,
                    // },
                    auctionType: {
                        type: String, // 'default' or other types
                    },
                    startingBid: {
                        type: Number,
                    },
                    increment: {
                        type: Number,
                        default: 5,
                    },
                    currentHighestBid: {
                        type: Number,
                        default: 0,
                    },
                    nextBid1: {
                        type: Number,
                        default: 0,
                    },
                    nextBid2: {
                        type: Number,
                        default: 0,
                    },
                    highestBidder: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "users", // Store reference to the highest bidder
                        default: null,
                    },
                    bidderWon: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "users", // Store reference to the highest bidder
                        default: null,
                    },
                    bids: [bidSchema], // Array of bids
                    endsAt: {
                        type: Date,
                    },
                    isActive: {
                        type: Boolean,
                        default: true,
                    },
                    uniqueStreamId: {
                        type: String,
                    },
                    auctionNumber: {  // <-- New field in auctionProducts sub-schema
                        type: Number,
                    }
                },
            ],
            default: [],
        },
         // === NEW FIELD: currentGiveaway ===
        currentGiveaway: {
            type: {
                productId: { type: Schema.Types.ObjectId, ref: "productlistings", required: true },
                productOwnerSellerId: { type: Schema.Types.ObjectId, ref: 'sellers', required: true },
                streamId: { type: String },
                productTitle: { type: String },
                followersOnly: { type: Boolean, default: false },
                 isRolling: { type: Boolean, default: false },
                isActive: { type: Boolean, default: false }, // Set to true when this giveaway is active
                isGiveawayEnded: { type: Boolean, default: false }, // True when winner selected or manually ended
                applicants: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }], // Store user IDs of applicants
                winner: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null }, // Store winner user ID
                createdAt: { type: Date, default: Date.now },
                giveawayNumber: { type: Number }, // To track the order of giveaways
            },
            default: null, // Will be null if no giveaway is currently active
        },

        // === MODIFIED FIELD: giveawayProducts ===
        // This array will now primarily store *completed* or *available for future use* giveaways.
        // The active one is in `currentGiveaway`.
        giveawayProducts: {
            type: [
                {
                    _id: false, // Ensure Mongoose doesn't create a default _id for subdocuments here
                    productId: { type: Schema.Types.ObjectId, ref: "productlistings", required: true },
                    productOwnerSellerId: { type: Schema.Types.ObjectId, ref: 'sellers', required: true },
                    startingPrice: { type: Number, min: 0, default: null }, // Assuming this was a typo for giveaway initial value, if not, adjust.
                    isAuctionEnded: { // This field seems like it belongs to auctionProducts, remove if not relevant here.
                        type: Boolean,
                        default: false
                    },
                    streamId: { type: String },
                    productTitle: { type: String }, // Adding title for easier access without populating productId
                    followersOnly: { type: Boolean, default: false },
                    isActive: { type: Boolean, default: false }, // Should be false for items in this array (unless they are *available* but not *active*)
                    isGiveawayEnded: { type: Boolean, default: false }, // Track if this particular giveaway has finished
                    applicants: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
                    winner: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
                    createdAt: { type: Date, default: Date.now },
                    giveawayNumber: { type: Number }, // Keep for ordering/tracking
                },
            ],
            default: [],
        },


        // giveaways: [giveawaySchema], // Array of giveaways
    },
    { timestamps: true } // Automatically adds `createdAt` and `updatedAt`
);

// Create and export the Show model
const Show = mongoose.model('shows', showSchema);
export default Show;

