const RFQ = require("../models/rfqs");
const STATUS_CODE = require("../configs/errors");
const RFQMailer = require("../helpers/rfqMailer");
const Publisher = require("./../utilities/publisher");
const moment = require('moment');


const { RFQStatus, RFQSupplierStatus, RFQNotificationType } = require('../configs/enums');
const { addNotification } = require("../helpers/addNotification");
const logger = require("../logger/logger.js");


class LeadsController {
  async getMyLeads(req, resp) {
    logger.info("LeadsController.getMyLeads()", req.query);

    try {
      const supplierEmail = req.headers['email'];
      const userId = req.headers['userid'];
      // const supplierId = req.query.supplierId || req.headers['supplierid'];
      logger.info("LeadsController.getMyLeads() userid:", userId);

      //Need to check if the user is owner of the business
      // var isOwner = await Publisher.isOwnerOfBusiness({ supplierId, userId });
      var supplierId = await Publisher.supplierData({ userId })

      // if (isOwner == false) {
      //   return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
      //     message: STATUS_CODE.GET_LEADS_FAILED,
      //   });
      // }
      // let query = { isDeleted: false, suppliers: { $elemMatch: { email: { $eq: supplierEmail } } } };
      let query;
      if (supplierId) {
        query = { isDeleted: false, suppliers: { $elemMatch: { supplierId: { $eq: supplierId } } } };
      }

      await RFQ.find(query, '-_id', (err, leads) => {

        if (err) {
          return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
            message: STATUS_CODE.GET_LEADS_FAILED,
          });
        }

        if (leads) {
          logger.info("LeadsController.getMyLeads(): supplierId:", supplierId, " leads: Fetched successfully ");
          leads.forEach(async function (lead, i) {
            lead.suppliers.forEach(async function (supplier, i) {
              if (
                // supplier.email == supplierEmail ||
                 supplier?.supplierId == supplierId) {

                lead.suppliers = [];
                lead.suppliers.push(supplier);
              }
            });
          });
        }

        return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
          error: false,
          message: STATUS_CODE.GET_LEADS_SUCCESS,
          payload: leads
        });

      });
    } catch (err) {
      logger.error("ERROR : LeadsController.getMyLeads() : ", err.message);
      return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: false,
        message: STATUS_CODE.GET_LEADS_FAILED,
      });
    }

  }

  async getLead(req, resp) {

    logger.info("LeadsController.getLeads()", req.query);

    try {

      const rfqIdIn = req.query.rfqId;
      const supplierId = req.query.supplierId || req.headers['supplierid'];

      await RFQ.findOne({ rfqId: rfqIdIn, isDeleted: false }, '-_id', (err, lead) => {

        if (err || !lead) {
          return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
            message: STATUS_CODE.GET_LEADS_FAILED,
          });
        }

        logger.info("LeadsController.getLead() : Lead : ", lead);
        lead.suppliers.forEach(async function (supplier, i) {
          logger.info("Supplier: ", supplier);
          if (supplier.supplierId == supplierId) {

            logger.info("LeadsController.getLead() : Supplier: ", supplier);
            lead.suppliers = [];
            lead.suppliers.push(supplier);

            logger.info("LeadsController.getLead() : Lead : ", lead);
            return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
              error: false,
              message: STATUS_CODE.GET_LEADS_SUCCESS,
              payload: lead
            });
          }
        });

      });
      return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
        message: STATUS_CODE.GET_LEADS_FAILED,
      });
    } catch (err) {
      logger.error("ERROR : LeadsController.getLeads() : ", err.message);
      return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: false,
        message: STATUS_CODE.GET_LEADS_FAILED,
      });
    }
  }

  async acknowledgeLead(req, resp) {
    logger.info("LeadsController.acknowledgeLead()", req.body.payload);

    try {

      const { rfqId } = req.body.payload;
      const supplierEmail = req.headers['email'];
      // const supplierId = req.headers['supplierid'];
      const { supplierId } = req.body.payload;
      const { viewById } = req.body.payload;
      const { viewByName } = req.body.payload;
      // const acknowledgeDate = moment().format('DD/MM/YY');
      const acknowledgeDate = req.body.payload.acknowledgeDate;
      logger.info("LeadsController.supplierId payload()", supplierId);

      await RFQ.findOne({ rfqId: rfqId, isDeleted: false }, async (err, lead) => {

        if (err || !lead) {
          logger.info("LeadsController.acknowledgeLead() : Failed to get RFQ with Id:", rfqId);
          return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
            message: STATUS_CODE.GET_LEADS_FAILED,
          });
        }

        logger.info("LeadsController.acknowledgeLead(): lead: ", lead);
        let matchedSupplier = null;
        lead.suppliers.forEach(async (supplier, i) => {
          logger.info("supplier i:", supplier);
          if ((supplier.email && supplier.email != null && supplier.email == supplierEmail) ||
            (supplierId && supplier.supplierId == supplierId)) {
            logger.info("Matched supplier :", supplier);
            lead.suppliers[i].status = RFQSupplierStatus.ACKNOWLEDGED;
            lead.suppliers[i].viewById = viewById;
            lead.suppliers[i].viewByName = viewByName;
            lead.suppliers[i].acknowledgeDate = acknowledgeDate;
            matchedSupplier = supplier;
          }
        });

        if (matchedSupplier != null) {
          await lead.save(async (err, lead) => {
            if (err) {
              logger.info("LeadsController.acknowledgeLead() err=", err);
              return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
                message: STATUS_CODE.LEAD_STATUS_SAVE_FAILED,
              });
            }

            //add Notification
            // addNotification([matchedSupplier], lead, RFQNotificationType.LEAD_ACK);
            // logger.info("update suppliers and return");
            // lead.suppliers = [];
            // lead.suppliers.push(matchedSupplier);


            //send AcknowledgeRFQMail
            // let respData = await RFQMailer.sendRFQAckMail(lead.requestedBy, lead);
            // logger.info("RLeadsController.acknowledgeLead() respData from mailer: ", respData);

            // if (!respData) {
            //   return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
            //     error: false,
            //     message: STATUS_CODE.RFQ_SEND_FAILED,
            //     payload: {
            //       rfq: lead,
            //     }
            //   });
            // }

            return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
              message: STATUS_CODE.LEAD_STATUS_SAVE_SUCCESS,
              payload: {
                rfq: lead,
              }
            });

          });
        }
        else {
          logger.info("Did not find the supplier in the RFQ");
          return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
            message: STATUS_CODE.GET_LEADS_FAILED,
          });
        }
      });

      logger.info(" Outside Find block");
    } catch (err) {
      logger.error("ERROR : LeadsController.acknowledgeLead() : ", err.message);
      return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: false,
        message: STATUS_CODE.GET_LEADS_FAILED,
      });
    }

  }

}

module.exports = new LeadsController();
