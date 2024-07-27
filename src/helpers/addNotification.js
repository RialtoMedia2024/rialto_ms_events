const axios = require("axios");
const { RFQNotificationType } = require("../configs/enums");
const CONSTANTS = require("../configs/constants");
const logger = require("../logger/logger.js");

module.exports.addNotification = async (suppliers, rfq, type = RFQNotificationType.LEAD) => {
  try {
    logger.info("addNotification : List of suppliers : ", suppliers);
    logger.info("addNotification : for :", rfq);
    const notificationService = process.env.MS_NOTIfICATION_SERVICE_URL;
    const addNotoficationUrl = `/send`;

    const url = `${notificationService}${addNotoficationUrl}`;
    logger.info("addNotification : Adding notification via : ", url);

    let respData = undefined;
    let msg = null;

    if (type = RFQNotificationType.LEAD) {
      msg = CONSTANTS.format(CONSTANTS.RFQLeadNotification, rfq.rfqId, rfq.requesterId);
    }

    suppliers.forEach(async (supplier, i) => {
      if (type = RFQNotificationType.LEAD_ACK) {
        msg = CONSTANTS.format(CONSTANTS.RFQLeadAckNotification, rfq.rfqId, supplier.businessName);
      }
      let response = await axios({
        method: "post", url: url,
        headers: {
          "content-type": "application/json",
        },
        data: {
          userId: supplier.supplierId,
          notificationType: type,
          message: msg,
          refId: rfq.rfqId
        },
      });
      logger.info("addNotification() : response: ", response.data);

      respData = response.data;
      logger.info("addNotification :  response got : ", respData);
      if (respData != undefined && respData.error == false) {
        logger.info("addNotification() : successfully Added Noticiation");
      }
      else {
        logger.info("addNotification(): Failed to add Notification");
        //TODO : Write to a file to push notifcation later
      }
    });
  }
  catch (err) {
    logger.error("ERROR : addNotification() :", err);
  }
}
