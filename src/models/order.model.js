import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema({
    productInfo : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'products',
        required: true
    },
    sellerInfo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "sellers",
        required: true
    },
    userInfo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    ecomId: {
        type: String,
        trim: true
    },
    productImageUrl: {
        type: String
    },
    orderDetails: {
        productName: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        color: {
            type: String
        },
        size: {
            type: String
        }
    },
    orderDate: {
        type: String,
        required: true
    },
    orderTime: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: {
            values: ["created","live","dispatch","delivered","canceled","returned","rescheduled"],
            message: `{VALUE} is invalid status type`
        }
    },
    orderAmount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: {
            values: ["cash","online"],
            message: `{VALUE} is invalid payment method`
        },
        required: true
    },
    isPaid: {
        type: Boolean,
        default: false,
        required: true
    },
    paymentRefferenceId:{
        type: String
    },
    returnDate: { 
        type: String,
        default: null
    },
    rescheduleDate: {
        type: String,
        default: null
    },
    deliveryAddress: {
        name:{
            type: String,
            maxLength: 30,
            trim: true,
            required: true
        },
        mobile: {
            type: String,
            trim: true,
            maxLength: 15,
            required: true
        },
        alternateMobile: {
            type: String,
            trim: true,
            maxLength: 15,
            default: null
        },
        line1: {
            type: String,
            required: true,
            trim: true,
            maxLength: 100
        },
        line2: {
            type: String,
            trim: true,
            maxLength: 100,
            default: ""
        },
        city: {
            type: String,
            required: true,
            trim: true,
            maxLength: 20
        },
        state: {
            type: String,
            required: true,
            trim: true,
            maxLength: 25
        },
        pincode: {
            type: String,
            maxLength: 6,
            trim: true,
            required: true
        }
    },
    sellerAddress: {
        name:{
            type: String,
            maxLength: 30,
            trim: true,
            required: true
        },
        mobile: {
            type: String,
            trim: true,
            maxLength: 15,
            required: true
        },
        alternateMobile: {
            type: String,
            trim: true,
            maxLength: 15,
            default: null
        },
        line1: {
            type: String,
            required: true,
            trim: true,
            maxLength: 100
        },
        line2: {
            type: String,
            trim: true,
            maxLength: 100,
            default: ""
        },
        city: {
            type: String,
            required: true,
            trim: true,
            maxLength: 20
        },
        state: {
            type: String,
            required: true,
            trim: true,
            maxLength: 25
        },
        pincode: {
            type: String,
            maxLength: 6,
            trim: true,
            required: true
        }
    },
    deliveryDate: {
        type: String,
        default: null
    }
},{timestamps: true});


const Order = mongoose.model("orders", OrderSchema);

export default Order;