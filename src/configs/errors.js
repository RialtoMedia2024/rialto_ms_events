/* HTTP/HTTPS status code*/
module.exports.SERVER_SUCCESS = 200;
module.exports.SERVER_BAD_REQUEST = 400;
module.exports.SERVER_UNAUTHORIZED = 401;
module.exports.SERVER_NOT_FOUND = 404;
module.exports.SERVER_INTERNAL_ERROR_CODE = 500;
module.exports.SERVER_REQUEST_TIMEOUT_CODE = 502;

/*RFQS error Errors*/
module.exports.DATA_NOT_FOUND = "Data not found";
module.exports.CRON_JOB_START_SUCCESS = "Cron job successfully started";
module.exports.CRON_JOB_START_FAILED = "Cron job start failed";
module.exports.RFQ_UPDATE_STATUS_FAILED = "Failed to update Requirement Status";
module.exports.RFQ_UPDATE_STATUS_SUCCESS = "Requirement Status updated successfully";

module.exports.RFQ_NOT_FOUND_WITH_RFQ_ID = "RFQ not found with the provided rfqId"

module.exports.RFQ_FETCHE_FAILED = "Requirement Fetch failed";
module.exports.RFQ_FETCHED_SUCCESS= "Requirement fetched successfully";


module.exports.RFQ_ADD_SUPPLIERS_FAILED = "Failed to add Suppliers to Requirement";
module.exports.RFQ_ADD_SUPPLIERS_SUCCESS = "Suppliers added to RFQ and RFQ status updated to 'DRAFT'";
module.exports.RFQ_ADD_INVITE_SUPPLIERS_SUCCESS = "Suppliers added to RFQ and Invitation send successfully";
module.exports.RFQ_ADD_SUPPLIERS_DUPLICATE = "Supplier/s already exist in the RFQ";

module.exports.RFQ_SUBMIT_FAILED = "Failed to submit Requirement";
module.exports.RFQ_SUBMIT_SUCCESS = "Requirement submitted successfully";


module.exports.RFQ_CLOSE_FAILED = "Failed to close Requirement";
module.exports.RFQ_CLOSE_SUCCESS = "Requirement closed successfully and awardede to vendors";

module.exports.RFQ_DELETED_FAILED = "Failed to delete Requirement";
module.exports.RFQ_DELETED_SUCCESS = "Requirement deleted successfully";

module.exports.FAILED_RFQ_TRASHED = "Failed to trash Requirement";

module.exports.RFQ_UPDATE_FAILED = "Failed to update Requirement";
module.exports.RFQ_UPDATE_SUCCESS = "Requirement updated successfully";
module.exports.RFQ_UPDATE_FAILED_DUPLICATE_NAME = "Duplicate Requirement name";

module.exports.RFQ_CREATE_FAILED = "Failed to create Requirement";
module.exports.RFQ_CREATE_SUCCESS = "Requirement created successfully";
module.exports.RFQ_CREATE_FAILED_DUPLICATE = "Requirement create failed due to duplicate name";
module.exports.RFQ_SEND_FAILED = "Requirement is created, but it failed to send mail to supplier"


module.exports.GET_LEADS_FAILED = "Failed to get Leads";
module.exports.LEAD_STATUS_SAVE_FAILED = "Failed to acknowledge Lead";
module.exports.LEAD_STATUS_SAVE_SUCCESS = "Successfully acknowledged Lead";
module.exports.RFQ_FETCHED_FAILED = "Failed to fetch rfqs";


module.exports.FAILED_ADD_SUPPLIER_IN_RFQ = "Failed to add supplier in rfq";
module.exports.ADD_SUPPLIER_IN_RFQ_SUCCESS = "Successfully added supplier in rfq";

module.exports.VENDOR_EMAILS_ADD_SUCCESS = "Successfully added emails to vendor";
module.exports.VENDOR_EMAILS_ADD_FAILED = "Failed to add emails to vendor";