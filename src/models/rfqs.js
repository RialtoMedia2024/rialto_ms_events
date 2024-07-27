const mongoose = require("mongoose");
const autoIncrement = require('mongoose-sequence')(mongoose);
const { RFQStatus, RFQSupplierStatus, newRFQStatus, RfqSupplierState } = require('../configs/enums')

const MAX_SUPPLIERID_LENGTH = 10;
const MAX_EMAIL_LENGTH = 40;
const MAX_MOBILE_LENGTH = 12;

const supplierDetailSchema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      trim: true,
      // unique: true
    },
    supplierId: {
      type: String,
      trim: true,
      maxlength: MAX_SUPPLIERID_LENGTH,
      // unique: true
    },
    email: {
      type: String,
      trim: true,
      maxlength: MAX_EMAIL_LENGTH
    },
    emails:[String],
    mobile: {
      type: String,
      trim: true,
      maxlength: MAX_MOBILE_LENGTH
    },
    status: {
      type: String,
      enum: RFQSupplierStatus,
      default: RFQSupplierStatus.OPEN
    },
    state: {
      type: String,
      enum: RfqSupplierState,
      default: RfqSupplierState.NOTINVITED
    },
    businessOwnerMobileNumber: {
      type: String,
      trim: true,
      maxlength: MAX_MOBILE_LENGTH
    },
    createDate: {
      type: Date,
    },
    acknowledgeDate: {
      type: Date,
    },
    viewById: {
      type: String,
      trim: true,
    },
    viewByName: {
      type: String,
      trim: true,
    },
    isPremium: {
      type: Boolean,
      trim: true,
    },
    resendCount: {
      type: Number,
      default: 0
    },
    reminderDate: {
      type: String,
      // default: ""
    },
    noteDescriptions:[],
    // resendInfo:[],
    contactDetails : [{
      name:{type:String},
      email:{type:String},
      mobile:{type:String},
      emailStatus:{type:String}
    }],
    isNeevayVendor:{
      type:Boolean
    },
    quotationDetails:{
      received: {type:Boolean},
      amount:{type:Number},
      alignedToTerms:{type:Boolean},
      nonAlignmentReason:{type:String, trim:true},
      otherNonAlignmentReason:{type:String,trim:true},
      rank:{type:String, trim:true},
      reason:{type:String, trim:true},
      otherReason:{type:String, trim:true},
    },
    closingDetails:[{
      amount:{type:String,trim:true},
      poNumber:{type:String, trim:true},
      poDate:{type:Date},
      remark:{type:String, trim:true}
    }],
    isAwarded:{type:Boolean},
    addedBy:{
      name:{type:String, trim:true},
      userId:{type:Number}
    }
  },
);

const rfqSchema = new mongoose.Schema(
  {
    rfqId: {
      type: Number,
      auto: true
    },
    entityId:{
      type: String,
    },
    supplierId: {
      type: Number,
      // required: true,
      // default: 0
    },
    userBusinessName: {
      type: String,
      // required: true,
      // default: 0
    },
    requesterName: {
      type: String,
      // required: true,
      // default: 0
    },
    name: {
      type: String,
      trim: true,
      maxength: 100,
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      trim: true,
      required: true
    },
    validityDate: {
      type: Date,
      required: false
    },
    workStartDate: {
      type: Date,
      required: false,
    },
    workEndDate: {
      type: Date,
      required: false,
    },
    creditPeriod: { //In Days
      type: String,
      // default: 0
    },
    requesterId: {
      type: String
    },
    requestedBy: {
      type: String,
    },
    requesterContact: {
      type: String,
    },
    requesterMobile: {
      type: String,
    },
    siteEngineerContact: {
      type: String,
    },
    siteEngineerName: {
      type: String,
    },
    newCcEmails: [],
    selectedFilesBase: [],
    projectName: {
      type: String,
      default: null
    },
    location: {
      type: String,
      default: null
    },
    capacity: {
      type: Number,
      // default: 0
    },
    uom: {
      type: String,
      // default: ""
    },
    suppliers: [{
      type: supplierDetailSchema,
    }],
    // suppliers:[],
    status: {
      type: String,
      enum: newRFQStatus,
      default: "DRAFT"
    },
    isActive: {
      type: Boolean,
      // default: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    subscriptionType: {
      type: String,
      // default: null
    },
    isEmailAuthorized:{
      type:Boolean,
      // default:false
    },
    estimatedValue:{
      type:Number
    },
    rfqType:{
      type:String,
    },
    isEntityUser:{
      type:Boolean
    },
    // rfqAwarded:[],
    projectId:{
      type:String
    },
    // awardeeDetails:{
    //   userId:{type:Number},
    //   awardeeName:{type:String, trim:true},
    //   date:{type:Date}
    // },
    rfqClosingDetails:{
      userId:{type:Number},
      name:{type:String, trim:true},
      date:{type:Date}
    },
    indentId:{
      type:String,
      trim:true
    },
    previousStatus:{
      type:String,
      trim:true
    },
    statusLogs: [{
      changedStatusFrom: { type: String },
      changedStatusTo: { type: String },
      userId: { type: Number },
      name: { type: String },
      date: { type: Date, default: Date.now }
  }]  
  },
  
  { timestamps: true },
  {
    toJSON: { getters: true }
  }
);


rfqSchema.plugin(autoIncrement, { id: 'rfqSeq', inc_field: 'rfqId' });

module.exports = rfq = mongoose.model("rfq", rfqSchema);
