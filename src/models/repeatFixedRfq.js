const mongoose = require("mongoose");
const autoIncrement = require('mongoose-sequence')(mongoose);
const { RepeatRfqTypeOfOrder } = require('../configs/enums')



const repeatFixedRfqSchema = new mongoose.Schema(
  {
    repeatRfqId: {
      type: String,
      auto: true,
      unique: true,
      //   required:true
    },
    orderName: {
      type: String,
      trim: true,
      required: true
    },
    vendorName: {
      type: String,
      trim: true,
    },
    typeOfOrder: {
      type: String,
      enum: RepeatRfqTypeOfOrder,
      required: true
    },
    vendorId: {
      type: String,
      required: true,
    },
    orderValue: {
      type: String,
      required: true
    },
    description: {
      type: String,
      trim: true,
      required: true
    },
    createdBy: {
      type: Number
    },
    addedBy: {
      type: String,
      trim: true
    },
    projectName: {
      type: String,
      trim: true,
    },
    projectId: {
      type: String,
      trim: true,
    },
    orderCategory:{
      type: String,
      trim: true
    },
    poDetails: [{
      amount: { type: String, trim: true },
      poNumber: { type: String, trim: true },
      poDate: { type: Date, default: Date.now}
    }],
  },
  { timestamps: true },
  {
    toJSON: { getters: true }
  }
);


// repeatFixedRfqSchema.plugin(autoIncrement, { id: 'repeatFixedRfqSeq', inc_field: 'repeatRfqId' });

module.exports = rfq = mongoose.model("repeatFixedRfq", repeatFixedRfqSchema);
