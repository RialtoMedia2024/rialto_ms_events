const mongoose = require("mongoose");

const variationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    order: {
        type: Number,
        required: true
    },
    description: {
        type: String
    }
});

const ticketSchema = new mongoose.Schema(
    {
        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event',
            required: true
        },
        name: {
            type: String,
            required: true
        },
        noOfTickets: {
            type: Number,
            required: true
        },
        maxTicketsPerCustomer: {
            type: Number,
            required: true
        },
        variations: [variationSchema],
        earlyBirdDiscount: {
            type: Number
        },
        discount: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        discountEndsOn: {
            type: Date
        },
        time: {
            type: String,
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Ticket", ticketSchema);
