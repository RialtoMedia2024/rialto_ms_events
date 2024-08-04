const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

const dateAndTimeSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  duration: {
    type: String,
    required: true,
  },
});

const eventSchema = new mongoose.Schema(
  {
    eventId: {
      type: Number,
      auto: true,
      unique: true,
      //   required:true
    },
    name: {
      type: String,
      trim: true,
      required: true,
    },
    category: [String],
    dateAndTime: {
      type: dateAndTimeSchema,
    },
    bannerURL: {
      type: String,
      // required: true,
    },
    description: {
      type: String,
      required: true,
    },
    organizer: {
      type: Number,
    },
    location: {
      area: { type: String },
      city: { type: String },
      state: { type: String },
      region: { type: String },
    },
    address: {
      venue: { type: String },
      addressLine1: { type: String },
      addressLine2: { type: String },
      city: { type: String },
      state: { type: String },
      region: { type: String },
      country: { type: String },
      zip: { type: Number },
    },
    bookingDetails: {
      startDate: {
        type:Date
      },
      endDate: {
        type:Date
      },
      startTime: {
        type:String
      },
      endTime: {
        type:String
      }
      
    },
    tags:{type:String},
    ticketInstructions: { type: String },
  },
  { timestamps: true },
  {
    toJSON: { getters: true },
  }
);

eventSchema.plugin(AutoIncrement, { inc_field: "eventId" });

module.exports = rfq = mongoose.model("event", eventSchema);
