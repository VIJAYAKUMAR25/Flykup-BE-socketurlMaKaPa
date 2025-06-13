import mongoose from "mongoose";


const InventorySchema = new mongoose.Schema({
    sellerInfo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'sellers',
        required: true
    },
    inventoryName: {
        type: String,
        required: true,
        trim: true,
        maxLength: 255
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxLength: 500
    },
    expiryDate: {
        type: String,
        required: true
    },
    totalQuantity: { 
        type: Number,
        min: 0,
        default: 0
    },
    addMoreQuantity: {
        type: Number,
        default: 0
    },
    lowLevelThreshold: {
        type: Number,
        required: true,
        min: 0
    },
    inventoryType: {
        type: String,
        enum: {
            values: ["quantity", "colorQuantity", "sizeQuantity", "sizeColorQuantity"],
            message: `{VALUE} is invalid inventory type`
        },
        required: true
    },
    inventory: [
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
            addMoreQuantity: {
                type: Number,
                default: 0
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
                    addMoreQuantity: {
                        type: Number,
                        default: 0
                    }
                }
            ]
        }
    ],
    isActive: {
        type: Boolean,
        default: true
    },
    isProductListed: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });


const Inventory = mongoose.model("inventories", InventorySchema);

export default Inventory;





