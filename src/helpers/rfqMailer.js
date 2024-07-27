const axios = require("axios");
const logger = require("../logger/logger.js");

class RFQMailer {

  constructor() {
    this.mailerService = process.env.MS_COMMUNICATION_SERVICE_URL;
    this.rfqMailerUrl = `${this.mailerService}/enquiry/email`;
    this.ackRFQMailerUrl = `${this.mailerService}/enquiry/acknowledge/email`;
  }

  async sendRFQMail(basicRecipient,premiumRecipient, inRFQ) {
    try {

      logger.info("RFQMailer.sendRFQMail() : List of suppliers : ", premiumRecipient,basicRecipient);
      if (!basicRecipient && !premiumRecipient)
      {
        return null;
      }
      const mailerService = process.env.MS_COMMUNICATION_SERVICE_URL;
      const rfqMailerUrl = `/enquiry/email`;

      const url = `${mailerService}${rfqMailerUrl}`;
      logger.info("RFQMailer.sendRFQMail() : Sending mail via : ", url);

      let respData = undefined;

      let response = await axios({
        method: "post", url: url,
        headers: {
          "content-type": "application/json",
        },
        data: {
          payload: {
            premiumRecipient: premiumRecipient,
            basicRecipient:basicRecipient,
            rfqDetails: inRFQ
          },
        },
      });

      logger.info("RFQMailer.sendRFQMail()", response.data);

      respData = response.data;
      logger.info("RFQMailer.sendRFQMail() :  response got : ", respData);
      if (respData != undefined && respData.payload.error == false) {
        logger.info("RFQMailer.sendRFQMail() sent RFQ successfully");
      }
      else {
        logger.info("RFQMailer.sendRFQMail() sent RFQ failed");
      }
      return respData;
    }
    catch (err) {
      logger.error("ERROR : RFQMailer.sendRFQMail() :", err);
      return null;
    }
  }

  async sendRFQMailToSupplier(rfq) {
    try {

      logger.info("RFQMailer.sendRFQMail() : List of suppliers : ", rfq);
      if (!rfq)
      {
        return null;
      }
      const mailerService = process.env.MS_COMMUNICATION_SERVICE_URL;
      const rfqMailerUrl = `/rfq/email`;

      const url = `${mailerService}${rfqMailerUrl}`;
      logger.info("RFQMailer.sendRFQMail() : Sending mail via : ", url);

      let respData = undefined;

      let response = await axios({
        method: "post", url: url,
        headers: {
          "content-type": "application/json",
        },
        data: {
          payload: {
            rfqDetails: rfq
          },
        },
      });

      logger.info("RFQMailer.sendRFQMail()", response?.data);

      respData = response?.data?.payload;
      logger.info("RFQMailer.sendRFQMail() :  response got : ", respData);
      if (respData != undefined && respData.error == false) {
        logger.info("RFQMailer.sendRFQMail() sent RFQ successfully");
      }
      else {
        logger.info("RFQMailer.sendRFQMail() sent RFQ failed");
      }
      return respData;
    }
    catch (err) {
      logger.error("ERROR : RFQMailer.sendRFQMail() :", err);
      return null;
    }
  }
  async sendAwardeeEmail(payload) {
    try {

      logger.info("RFQMailer.sendAwardeeEmail() : ", payload);
      if (!payload)
      {
        return null;
      }
      const mailerService = process.env.MS_COMMUNICATION_SERVICE_URL;
      const rfqMailerUrl = `/awardee/email`;

      const url = `${mailerService}${rfqMailerUrl}`;
      logger.info("RFQMailer.sendAwardeeEmail() : Sending mail via : ", url);

      let respData = undefined;

      let response = await axios({
        method: "post", url: url,
        headers: {
          "content-type": "application/json",
        },
        data: {
         payload
        },
      });

      logger.info("RFQMailer.sendAwardeeEmail()", response.data);

      respData = response.data.payload;
      logger.info("RFQMailer.sendAwardeeEmail() :  response got : ", respData);
      if (respData != undefined && respData.error == false) {
        logger.info("RFQMailer.sendAwardeeEmail() sent RFQ successfully");
      }
      else {
        logger.info("RFQMailer.sendAwardeeEmail() sent RFQ failed");
      }
      return respData;
    }
    catch (err) {
      logger.error("ERROR : RFQMailer.sendAwardeeEmail() :", err);
      return null;
    }
  }

  async ReInviteSupplierToRfq(basicRecipients, premiumRecipients,cdRecipients,rfq) {
    try {

      logger.info("RFQMailer.sendRFQMail() : List of suppliers : ", rfq);
      if (!rfq)
      {
        return null;
      }
      const mailerService = process.env.MS_COMMUNICATION_SERVICE_URL;
      const rfqMailerUrl = `/rfq/re-invite`;

      const url = `${mailerService}${rfqMailerUrl}`;
      logger.info("RFQMailer.sendRFQMail() : Sending mail via : ", url);

      let respData = undefined;

      let response = await axios({
        method: "post", url: url,
        headers: {
          "content-type": "application/json",
        },
        data: {
          payload: {
            basicRecipients:basicRecipients,
            premiumRecipients:premiumRecipients,
            cdRecipients:cdRecipients,
            rfqDetails: rfq
          },
        },
      });

      logger.info("RFQMailer.sendRFQMail()", response.data);

      respData = response.data.payload;
      logger.info("RFQMailer.sendRFQMail() :  response got : ", respData);
      if (respData != undefined && respData.error == false) {
        logger.info("RFQMailer.sendRFQMail() sent RFQ successfully");
      }
      else {
        logger.info("RFQMailer.sendRFQMail() sent RFQ failed");
      }
      return respData;
    }
    catch (err) {
      logger.error("ERROR : RFQMailer.sendRFQMail() :", err);
      return null;
    }
  }

  async sendResendRFQMail(basicRecipient,premiumRecipient, inRFQ) {
    try {

      logger.info("RFQMailer.sendRFQMail() : List of suppliers : ", premiumRecipient,basicRecipient);
      if (!basicRecipient && !premiumRecipient)
      {
        return null;
      }
      const mailerService = process.env.MS_COMMUNICATION_SERVICE_URL;
      const rfqMailerUrl = `/resend/enquiry/email`;

      const url = `${mailerService}${rfqMailerUrl}`;
      logger.info("RFQMailer.sendRFQMail() : Sending mail via : ", url);

      let respData = undefined;

      let response = await axios({
        method: "post", url: url,
        headers: {
          "content-type": "application/json",
        },
        data: {
          payload: {
            premiumRecipient: premiumRecipient,
            basicRecipient:basicRecipient,
            rfqDetails: inRFQ
          },
        },
      });

      logger.info("RFQMailer.sendRFQMail()", response.data);

      respData = response.data;
      logger.info("RFQMailer.sendRFQMail() :  response got : ", respData);
      if (respData != undefined && respData.payload.error == false) {
        logger.info("RFQMailer.sendRFQMail() sent RFQ successfully");
      }
      else {
        logger.info("RFQMailer.sendRFQMail() sent RFQ failed");
      }
      return respData;
    }
    catch (err) {
      logger.error("ERROR : RFQMailer.sendRFQMail() :", err);
      return null;
    }
  }

  async sendRFQAckMail(recipients, inRFQ) {
    try {

      logger.info("RFQMailer.sendRFQAckMail() : List of suppliers : ", recipients);
      const mailerService = process.env.MS_COMMUNICATION_SERVICE_URL;
      const rfqMailerUrl = `/enquiry/acknowledge/email`;

      const url = `${mailerService}${rfqMailerUrl}`;
      logger.info("RFQMailer.sendRFQAckMail() : Sending mail via : ", this.ackRFQMailerUrl);

      let respData = undefined;

      let response = await axios({
        method: "post", url: this.ackRFQMailerUrl,
        headers: {
          "content-type": "application/json",
        },
        data: {
          payload: {
            recepient: recipients,
            rfqDetails: inRFQ
          },
        },
      });

      logger.info("RFQMailer.sendRFQAckMail()", response.data);

      respData = response.data;
      logger.info("RFQMailer.sendRFQAckMail() :  response got : ", respData);
      if (respData != undefined && respData.payload.error == false) {
        logger.info("RFQMailer.sendRFQAckMail() sent RFQ successfully");
      }
      else {
        logger.info("RFQMailer.sendRFQAckMail() sent RFQ failed");
      }
      return respData;
    }
    catch (err) {
      logger.error("ERROR : RFQMailer.sendRFQAckMail() :", err);
      return null;
    }
  }

  async  sendLeadReminder(recipients) {
    try {
      if (!recipients) {
        return null;
      }
  
      const mailerService = process.env.MS_COMMUNICATION_SERVICE_URL;
      const leadReminderMailerUrl = `/lead/reminder`;
  
      const url = `${mailerService}${leadReminderMailerUrl}`;
      logger.info("sendLeadReminder() : Sending mail via : ", url);
  
      let respData = undefined;
  
      let response = await axios({
        method: "post",
        url: url,
        headers: {
          "content-type": "application/json",
        },
        data: {
          payload: {
            recipients
          },
        },
      });
  
      logger.info("sendLeadReminder()", response.data);
  
      respData = response.data;
      logger.info("sendLeadReminder() :  Response received : ", respData);
  
      if (respData != undefined) {
        logger.info("sendLeadReminder() sent reminder successfully");
      } else {
        logger.info("sendLeadReminder() sending reminder failed");
      }
  
      return respData;
    } catch (err) {
      logger.error("ERROR : sendLeadReminder() :", err);
      return null;
    }
  }
}


module.exports = new RFQMailer();
