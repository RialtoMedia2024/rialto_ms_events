const express = require("express");
const router = express.Router();

const leadsController = require("../controllers/leads");

router.get("/leads", leadsController.getMyLeads);
router.post("/acknowledge", leadsController.acknowledgeLead);
router.get("/lead", leadsController.getLead);

module.exports = router;
