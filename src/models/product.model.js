import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema ({
    sellerInfo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'sellers',
        required: true
    },
    inventoryInfo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'inventories',
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    productType: {
        type: String,
        enum: {
            values: ["quantity", "colorQuantity", "sizeQuantity", "sizeColorQuantity"],
            message: `{VALUE} is invalid product type`
        },
        required: true
    },
    description:{
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    subCategory: {
        type: String,
        required: true
    },
    totalQuantity:{
        type: Number,
        required: true
    },
    actualPrice: {
        type: Number,
        min: 0
    },
    sellingPrice: {
        type: Number,
        min: 0
    },
    photoUrl: {
        type: String,
        required: true
    },
    videoUrl: {
        type: String,
        required: true
    },
    additionalInfo: [
        {
            color: {
                type: String,
                trim: true,
                default: null
            },
            size: {
                type: String,
                trim: true,
                default: null
            },
            quantity: {
                type: Number,
                min: 0
            },
            actualPrice: {
                type: Number,
                min: 0
            },
            sellingPrice: {
                type: Number,
                min: 0
            },
            sizes: [
                {
                    size: {
                        type: String,
                        trim: true,
                        default: null
                    },
                    quantity: {
                        type: Number,
                        required: true,
                        min: 0
                    },
                    actualPrice: {
                        type: Number,
                        min: 0
                    },
                    sellingPrice: {
                        type: Number,
                        min: 0
                    },
                }
            ]
        }
    ],
    isActive: {
        type: Boolean,
        default: true
    },
    productWeight: {
        type: String,
        required: true
    }
}, { timestamps: true});

const Product = mongoose.model("products", ProductSchema);

export default Product;