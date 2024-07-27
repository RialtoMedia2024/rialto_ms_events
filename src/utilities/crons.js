const cron = require("node-cron");
const axios = require("axios");

const RFQ = require("../models/rfqs");
const STATUS_CODE = require("../configs/errors");
const logger = require("../logger/logger");

class Crons {
    constructor() {
        
    }

    async startRfqOpenToExpired() {
        logger.info(`Crons.startRfqOpenToExpired() :: cron about to start`);
        let response;
        try {
            const todaysDate = new Date();
            try {
                const foundDocs = await RFQ.find(
                    { $and: [ {validityDate: {$lt: todaysDate}}, {status: "OPEN"}, {isDeleted: false}] },
                    { rfqId: 1, _id : 1 });
                logger.info("Crons.startRfqOpenToExpired() :: foundDocs: ", foundDocs);
                if (!foundDocs || foundDocs.length<=0) {
                    response = {
                        error: false,
                        message: STATUS_CODE.DATA_NOT_FOUND,
                        payload: null
                    };
                    return response;
                }
                // Extract the _id values into a separate array
                const rfqIds = foundDocs.map(foundDoc => foundDoc.rfqId);
                logger.info("Crons.startRfqOpenToExpired() :: rfqIds: ", rfqIds);

                try {
                    const updtDocs = await RFQ.updateMany(
                        { rfqId: { $in: rfqIds } },
                        { $set: { status: "EXPIRED" } }
                    );
                    logger.info(`Crons.startRfqOpenToExpired() :: ${updtDocs.nModified} documents were updated`);
                    logger.info(`Crons.startRfqOpenToExpired() :: updtDocs: `, updtDocs);
                    
                    response = {
                        error: false,
                        message: STATUS_CODE.RFQ_UPDATE_STATUS_SUCCESS,
                        payload: {
                            updatedDocIds: rfqIds,
                            totalDocs: rfqIds.length,
                            totalDocModified: updtDocs.nModified,
                        }
                    };
                    return response;

                } catch (updtErr) {
                    logger.error(`Crons.startRfqOpenToExpired() :: updtErr: `, updtErr);
                    response = {
                        error: true,
                        message: STATUS_CODE.RFQ_UPDATE_STATUS_FAILED,
                        payload: null
                    }
                    return response;
                }
                
            } catch (foundErr) {
                logger.error("Crons.startRfqOpenToExpired() :: foundErr: ", foundErr);
                response = {
                    error: true,
                    message: STATUS_CODE.DATA_NOT_FOUND,
                    payload: null
                };
                return response;
            }
        
        } catch (error) {
            logger.error("Crons.startRfqOpenToExpired() :: AXIOS ERROR: ", error.message);
            response = {
                error: true,
                message: STATUS_CODE.CRON_JOB_START_FAILED,
                errorCode: `CRON_JOB_START_FAILED : ${error.message}`,
            };
            return response;
        }
    }

    async  getRFQSForLeadReminder() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sixDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      
        // Get RFQs from the last six days and match the other criteria.
        const RFQS = await RFQ.find({
          createdAt: { $gte: sixDaysAgo, $lt: today },
          status: { $ne: "EXPIRED" }, //condition to check RFQ status is not "EXPIRED"
          "suppliers.status": { $in: ["OPEN", "PUBLISHED"] },
        })
          .select("suppliers.mobile suppliers.supplierId suppliers.email suppliers.businessName")
          .lean()
          .exec();
      
        // Get the count of unreadLeads from all RFQs and group by supplierId.
        const unreadLeadsCounts = await RFQ.aggregate([
            { $match: { 
              status: { $ne: "EXPIRED" }, // Exclude RFQs with status 'EXPIRED'
              "suppliers.status": { $in: ["PUBLISHED", "OPEN"] } 
            } },
            { $unwind: "$suppliers" },
            {
              $group: {
                _id: "$suppliers.supplierId",
                unreadLeads: {
                  $sum: {
                    $cond: [{ $in: ["$suppliers.status", ["PUBLISHED", "OPEN"]] }, 1, 0],
                  },
                },
              },
            },
          ]);          

        const supplierCountMap = new Map();
      
        for (const rfq of RFQS) {
          for (const supplier of rfq.suppliers) {
            const { mobile, supplierId, email, businessName } = supplier;
            const unreadLeads = unreadLeadsCounts.find((count) => count._id === supplierId.toString())?.unreadLeads || 0;
      
            if (unreadLeads > 0) {
              if (supplierCountMap.has(supplierId)) {
                supplierCountMap.get(supplierId).unreadLeads = unreadLeads;
              } else {
                supplierCountMap.set(supplierId, {
                  mobile,
                  supplierId,
                  email,
                  unreadLeads,
                  businessName
                });
              }
            }
          }
        }
      
        const finalResult = Array.from(supplierCountMap.values());

        return finalResult;
      }

}

module.exports = new Crons();
