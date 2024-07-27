const RFQ = require("../models/rfqs");
const logger = require("../logger/logger.js");

async function updateEmailStatusInRFQ(data, emailToUpdate, status) {
    try {
        const rfq = await RFQ.findOne({ entityId: data?.entityId, rfqId: data?.rfqId });
        logger.info('updateEmailStatusInRFQ rfq=== ', rfq);
        if (!rfq) {
            throw new Error("RFQ not found");
        }
        for (const supplier of rfq.suppliers) {
            for (const contactDetail of supplier.contactDetails) {
                if (contactDetail.email === emailToUpdate) {
                    contactDetail.emailStatus = status;
                    // if (status === "Open") {
                    //     supplier.status = "ACKNOWLEDGED";
                    // }
                    await rfq.save();
                    return { success: true, message: "Email status updated successfully" };
                }
            }
        }

    } catch (error) {
        return { success: false, message: error.message };
    }
}
module.exports = updateEmailStatusInRFQ