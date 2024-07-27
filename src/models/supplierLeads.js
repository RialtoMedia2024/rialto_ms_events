const mongoose = require('mongoose');

const supplierLeadsSchema = new mongoose.Schema({
  supplierId: {
    type: String,
    required: true,
    unique: true
  },
  rfqIds: [{
    rfqId: {
      type: Number,
      ref: 'RFQ', 
      required: true
    },
    date: {
      type: Date,
      required: true,
      default: Date.now 
    }
  }]
});


const SupplierLeads = mongoose.model('SupplierLeads', supplierLeadsSchema);

module.exports = SupplierLeads;
