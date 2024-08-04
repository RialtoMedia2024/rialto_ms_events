const mongoose = require("mongoose");

const variationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  order: {
    type: Number,
    required: true,
  },
  // description: {
  //     type: String
  // }
});

const ticketSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    noOfTickets: {
      type: Number,
      // required: true
    },
    maxTicketsPerCustomer: {
      type: Number,
      // required: true
    },
    variations: [variationSchema],
    isEarlyBirdDiscount: {
        type: Boolean,
        default: false
    },
    earlyBirdDiscount: {
      discount: {
        type: Number,
        // required: true,
      },
        discountType: {
        type: String,
        },
      discountEndsDate: {
        type: Date,
      },
      time: {
        type: String,
        // required: true,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ticket", ticketSchema);
