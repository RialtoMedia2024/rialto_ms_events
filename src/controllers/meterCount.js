const RFQ = require("../models/rfqs");

class meterCount {

getRequirenmentCount = async (req, res) => {
  try {
    // Retrieve the count of suppliers from the database
    let TotalRfqs = await RFQ.countDocuments();

    // Return the count as the response
    const RequirenmentCount = TotalRfqs + 1500
    res.json({ RequirenmentCount });
  } catch (error) {
    console.error("Error retrieving registerd RequirenmentCount:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

}
module.exports = new meterCount();
