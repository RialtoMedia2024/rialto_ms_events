module.exports.RFQStatus = {
  OPEN : "OPEN",
  SUBMITTED : "SUBMITTED",
  PUBLISHED : "PUBLISHED",
  CLOSED : "CLOSED",
  EXPIRED : "EXPIRED"
};

module.exports.newRFQStatus = {
  DRAFT : "DRAFT",
  OPEN : "OPEN",
  CLOSED : "CLOSED",
  DELETED:"DELETED",
  EXPIRED : "EXPIRED",
  HOLD : "HOLD",
  CANCELED : "CANCELED",
};

module.exports.RfqSupplierState = {
  INVITED : "INVITED",
  NOTINVITED : "NOTINVITED"
};


module.exports.RFQSupplierStatus = {
  OPEN : "OPEN",
  PUBLISHED : "PUBLISHED",
  ACKNOWLEDGED : "ACKNOWLEDGED"
}

module.exports.RFQNotificationType = {
  LEAD: "LEAD",
  LEAD_ACK: "LEAD_ACK"
}

module.exports.RepeatRfqTypeOfOrder = {
  FIXED_ORDER:"FIXED_ORDER",
  REPEAT_ORDER:"REPEAT_ORDER",
  REPEAT_AND_FIXED_ORDER:"REPEAT_AND_FIXED_ORDER"
}
