const express = require("express");
const router = express.Router();

const meterCount = require("../controllers/meterCount");

router.get("/rfq-count",meterCount.getRequirenmentCount)

module.exports = router;