import mongoose from "mongoose";

const InventoryHistorySchema = new mongoose.Schema({
    inventoryInfo : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'inventories',
        required: true
    },
    totalQuantity : {
        type: Number,
        min: 0,
        default: 0
    },
    availableQuantity : {
        type: Number,
        min : 0,
        default: 0
    },
    history: [
        {
            date: {
                type: Date,
                default: null
            },
            size: {
                type: String,
                default: null
            },
            color: {
                type: String,
                default: null
            },
            quantity: {
                type: Number,
                default: null
            }
        }
    ]

} , { timestamps: true});

const InventoryHistory = mongoose.model("inventoryhistories", InventoryHistorySchema);

export default InventoryHistory;