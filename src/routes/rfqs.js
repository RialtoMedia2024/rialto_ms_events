const express = require("express");
const router = express.Router();

const rfqsController = require("../controllers/rfqs");
const directoryRfqController = require("../controllers/directoryRfqs")

router.post("/rfqs", rfqsController.getAllRFQs);
router.get("/by/page", rfqsController.getRFQs);
router.get("/search", rfqsController.searchInRfqs);
router.get("/global/search", rfqsController.searchInGlobalRfqs);
router.get("/repeat-fixed/search", rfqsController.searchInRepeatRfqs);
router.post("/create", rfqsController.createRFQ);
router.post("/repeat-fixed/create", rfqsController.createRepeatFixedRFQ);
router.post("/repeat-fixed/rfqs", rfqsController.getRepeatFixedRfqs);
router.post("/update", rfqsController.updateRFQ);
router.get("/rfq", rfqsController.getRFQ);
router.put("/add/supplier", rfqsController.addSuppliersToRFQAndSend);
router.post("/submit", rfqsController.submitRFQ);
router.post("/close", rfqsController.closeRFQ);
router.post("/delete", rfqsController.deleteRFQ);
router.get("/total-rfqs", rfqsController.getTotalRFQS);
router.post("/upload/attachments", rfqsController.fileUpload);
router.post("/resend", rfqsController.resendRFQ);
router.get("/send/excel", rfqsController.sendExcelSheet);
router.patch("/update/repeat/order", rfqsController.updateRepeatOrder)
router.delete("/delete/repeat/order", rfqsController.deleteRepeatOrder)
router.post("/search/repeat/order", rfqsController.SearchInRepeatOrder)
router.post("/update/email-status", rfqsController.updateEmailStatus);


// company directory rfq management

router.get("/entity/rfq",directoryRfqController.getEntityRfq);
router.get("/entity/rfq/pdf",directoryRfqController.getEntityRfqPdf);
router.get("/by/projectid",directoryRfqController.getRfqsByProjectId);

router.post("/save",directoryRfqController.saveRfq);
router.post("/entity/rfqs",directoryRfqController.getEntityRfqs);
router.post("/entity/rfqs/status",directoryRfqController.getEntityRfqsWithStatus);
router.post("/cd/search",directoryRfqController.searchInRfqs);
router.post("/entity/rfqs/date-range",directoryRfqController.getRfqsByDateRange);

router.patch("/add/suppliers",directoryRfqController.addSuppliersToRfq);
router.patch("/invite/vendors",directoryRfqController.inviteAllVendorsToRfq);
router.patch("/update/vendor/email", directoryRfqController.updateVendorEmailAndInvite);
router.patch("/invite/selected-vendor",directoryRfqController.inviteSelectedVendorsToRfq);
router.patch("/update/status", directoryRfqController.closeRfq);
router.patch("/update/rfq", directoryRfqController.updateRFQ);
router.patch("/reinvite",directoryRfqController.reInviteVendor);
router.patch("/multiple/reinvite",directoryRfqController.reInviteMultipleVendor);
router.patch("/supplier/add/emails",directoryRfqController.addEmailsToSupplier);
router.patch("/quotation/details",directoryRfqController.rfqQuotationDetails);
router.patch("/closing/details",directoryRfqController.rfqClosingDetails);
router.patch("/close/without/vendors",directoryRfqController.closeRfqWithoutVendors);
router.patch("/trash/rfq",directoryRfqController.trashRfq);
router.patch("/trash/single/rfq",directoryRfqController.trashSingleRfq);
router.patch("/restore/rfq",directoryRfqController.restoreRfq);
router.patch("/delet/rfq",directoryRfqController.deleteRfq);
router.patch("/update/closed/rfq",directoryRfqController.updateClosedRfq);
router.patch("/change/status",directoryRfqController.updateRfqStatus);

router.delete("/remove/suppliers",directoryRfqController.removeSupplierFromRfq);

module.exports = router;
