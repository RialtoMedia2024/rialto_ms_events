const RFQ = require("../models/rfqs");
const RepeatFixedRFQ = require("../models/repeatFixedRfq.js");
const STATUS_CODE = require("../configs/errors");
const RFQMailer = require("../helpers/rfqMailer");
const { addNotification } = require("../helpers/addNotification");
const { RFQSupplierStatus, RfqSupplierState, RFQStatus } = require("../configs/enums");
const logger = require("../logger/logger.js");
const Publisher = require("./../utilities/publisher");
// const moment = require("moment")
const { uploadFileToAzureBlobStorage } = require('../helpers/uploadFileToAzureBlobStorage');
const dateToString = require("../helpers/dateToString");
const { subDays, startOfDay } = require('date-fns');
const exceljs = require('exceljs');
const moment = require('moment-timezone');
const updateEmailStatusInRFQ = require("../helpers/updateEmailStatusInRFQ.js");

class RFQsController {


  async createRFQ(req, resp) {
    // logger.info("RFQsController.createRFQ()", req.body);

    try {

      const payload = req.body.payload;
      let requesterName = req.headers['name'];
      let userEmail = req.headers['email'];
      let userMobile = req.headers['mobile'];
      const userId = req.headers['userid'];
      const supplierId = req.headers['supplierid'];
      // const createDateToday = moment().format('DD/MM/YY');
      const createDateToday = payload.createDate;

      const inRFQ = {
        name: payload.name,
        summary: payload.summary,
        description: payload.description,
        validityDate: payload.validity,
        workStartDate: payload.startDate,
        workEndDate: payload.endDate,
        requestedBy: payload.requestedBy,
        requesterContact: userMobile,
        requesterId: userId,
        projectName: payload.projectName,
        location: payload.projectLocation,
        capacity: payload.capacity,
        uom: payload.uom,
        creditPeriod: payload.creditPeriod,
        userBusinessName: payload.userCompany,
        requesterName: payload.userName,
        requesterMobile: payload.requesterMobile,
        siteEngineerName: payload.siteEngineerName,
        siteEngineerContact: payload.siteEngineerContact,
        newCcEmails: payload.newCcEmails,
        selectedFilesBase: payload.selectedFilesBase,
        subscriptionType: payload.subscriptionType,
        isEmailAuthorized: payload.isEmailAuthorized,

        rfqType: payload.rfqType,
        isEntityUser: payload.isEntityUser,
        entityId: payload.entityId
      };

      if (payload.estimatedValue && payload.estimatedValue > 0) {
        inRFQ.estimatedValue = payload.estimatedValue;
      }

      if (supplierId) {
        inRFQ.supplierId = supplierId;
      }
      if (payload.suppliers && payload.suppliers.length > 0) {
        inRFQ.suppliers = payload.suppliers;
      }
      else {
        inRFQ.suppliers = [];
      }

      const newRfq = new RFQ(inRFQ);
      logger.info("RFQsController.createRFQ() rfq=", newRfq);

      let basicRecipient = [];
      let premiumRecipient = [];
      if (inRFQ.suppliers && inRFQ.suppliers.length > 0) {
        //Checking the supplier subcription upgradation from smp_ms_supplier
        let suppliersDetails = await Publisher.getSupplierContacts({ suppliers: newRfq.suppliers });

        if (suppliersDetails) {
          newRfq.suppliers = suppliersDetails;
        }
      }

      await newRfq.save(async (err, nRfq) => {
        if (err) {
          logger.info("RFQsController.createRFQ() err=", err);

          return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
            message: STATUS_CODE.RFQ_CREATE_FAILED,
          });
        }

        logger.info("RFQsController.createRFQ() saved rfq ", nRfq);
        logger.info("rfqId : ", nRfq._id.toHexString())

        logger.info("RFQsController.createRFQ() :  sending mail to suppliers");
        //If any supplier is provided, then send mail to them
        if (newRfq.suppliers && newRfq.suppliers.length > 0) {

          newRfq.suppliers.forEach(function (supplier) {
            if (supplier.isPremium === true) {
              premiumRecipient = premiumRecipient.concat(supplier.emails);
            } else {
              basicRecipient = basicRecipient.concat(supplier.emails);
            }
          });


          const txt = JSON.stringify(nRfq);
          const finalRfq = JSON.parse(txt);
          let respData = await RFQMailer.sendRFQMail(basicRecipient, premiumRecipient, finalRfq);
          logger.info("RFQsController.createRFQ() respData from mailer: ", respData);


          if (respData == null) {
            resp.status(STATUS_CODE.SERVER_SUCCESS).json({
              error: false,
              message: STATUS_CODE.RFQ_SEND_FAILED,
              payload: {
                rfq: nRfq,
                error: true
              }
            });
          }
          else {
            //set status for the supplier as mail Sent
            nRfq.status = RFQStatus.OPEN;
            nRfq.suppliers.forEach(async function (supplier, i) {
              nRfq.suppliers[i].status = RFQSupplierStatus.PUBLISHED;
              nRfq.suppliers[i].state = RfqSupplierState.INVITED;
              nRfq.suppliers[i].createDate = createDateToday;
            });


            nRfq.save();
            //Send notification
            addNotification(nRfq.suppliers, nRfq);
            resp.status(STATUS_CODE.SERVER_SUCCESS).json({
              message: STATUS_CODE.RFQ_CREATE_SUCCESS,
              payload: {
                rfq: nRfq,
              }
            });

          }
        }
        else {
          resp.status(STATUS_CODE.SERVER_SUCCESS).json({
            message: STATUS_CODE.RFQ_CREATE_SUCCESS,
            payload: {
              rfq: nRfq,
            }
          });
        }
      });
    } catch (err) {
      logger.error(err.message);
      return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        message: STATUS_CODE.RFQ_CREATE_FAILED,
      });
    }
  }

  async createRepeatFixedRFQ(req, res) {
    try {
      const {
        typeOfOrder,
        vendorId,
        orderValue,
        description,
        createdBy,
        vendorName,
        orderName,
        addedBy,
        poDetails,
        projectName,
        projectId,
        orderCategory,
      } = req.body;

      if (!poDetails || !Array.isArray(poDetails) || poDetails.length === 0) {
        return res.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
          error: true,
          message: "poDetails must be a non-empty array.",
        });
      }

      const poNumbers = poDetails.map(detail => detail.poNumber);
      const existingOrder = await RepeatFixedRFQ.findOne({ 'poDetails.poNumber': { $in: poNumbers } });
      if (existingOrder) {
        return res.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
          error: true,
          message: `PO number(s) already exist: ${existingOrder.poDetails.map(detail => detail.poNumber).join(', ')}`,
        });
      }

      const latestRFQ = await RepeatFixedRFQ.findOne().sort({ createdAt: -1 });
      const latestId = latestRFQ ? parseInt(latestRFQ.repeatRfqId.split('-')[1]) : 0;
      const newRepeatRfqId = `NEEVAY-${latestId + 1}`;

      const newRFQ = new RepeatFixedRFQ({
        repeatRfqId: newRepeatRfqId,
        orderName,
        vendorName,
        typeOfOrder,
        vendorId,
        orderValue,
        description,
        createdBy,
        addedBy,
        poDetails,
        projectName,
        projectId,
        orderCategory,
      });

      await newRFQ.save();

      return res.status(STATUS_CODE.SERVER_SUCCESS).json({
        error: false,
        payload: newRFQ,
      });
    } catch (error) {
      console.error("Error creating RFQ:", error);

      return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: true,
        payload: null,
        message: error.message,
      });
    }
  };


  async getRepeatFixedRfqs(req, res) {
    try {
      const page = parseInt(req.body.page) || 1;
      const createdBy = req.body.userIds || [];
      const pageSize = 10;
      const skip = (page - 1) * pageSize;

      const [rfqs, totalRepeatRfqs] = await Promise.all([
        RepeatFixedRFQ.find({ createdBy: { $in: createdBy } })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .exec(),
        RepeatFixedRFQ.countDocuments({ createdBy: { $in: createdBy }  }).exec(),
      ]);

      return res.status(STATUS_CODE.SERVER_SUCCESS).json({
        error: false,
        payload: {
          rfqs,
          totalRepeatRfqs,
          currentPage: page,
          totalPages: Math.ceil(totalRepeatRfqs / pageSize),
        },
      });
    } catch (error) {
      console.error("Error fetching RFQs:", error);

      return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: true,
        payload: null,
        message: error.message,
      });
    }
  }

  async searchInRepeatRfqs(req, resp) {
    logger.info("RFQsController.getAllRFQs()", req.query);
    try {
      let userId = req.query.userId;
      if (!userId) {
        return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
          error: true,
          message: "user ID is required.",
        });
      }

      let query = {
        // isDeleted: false,
        createdBy: userId,
        // status: { $nin: ['CLOSED', 'EXPIRED'] }, 
      };

      if (req.query.searchParam) {
        const searchRegex = new RegExp(req.query.searchParam, 'i');
        query.$or = [
          { description: { $regex: searchRegex } },
          { orderName: { $regex: searchRegex } },
        ];
      }

      const page = req.query.page ? parseInt(req.query.page) : 1;
      const pageSize = 10;
      const skip = (page - 1) * pageSize;

      const [repeatRfqs, totalCount] = await Promise.all([
        RepeatFixedRFQ.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .exec(),
        RepeatFixedRFQ.countDocuments(query).exec(),
      ]);

      logger.info("repeatRFQsController.getAllrepeatRFQs() repeatRfqs[]", repeatRfqs);
      const totalPages = Math.ceil(totalCount / pageSize);
      return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
        error: false,
        message: STATUS_CODE.RFQ_FETCHED_SUCCESS,
        payload: {
          repeatRfqs,
          totalCount,
          currentPage: page,
          totalPages: totalPages === 0 ? 1 : totalPages,
        },
      });
    } catch (err) {
      logger.error(err.message);
      return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: false,
        message: STATUS_CODE.RFQ_FETCHE_FAILED,
      });
    }
  }



  async updateRFQ(req, resp) {
    logger.info("RFQsController.updateRFQ()", req.body);

    try {

      const payload = req.body.payload;
      let userEmail = req.headers['email'];
      let userMobile = req.headers['mobile'];
      const supplierId = req.headers['supplierid'];

      const inRFQ = {
        rfqId: payload.rfqId,
        name: payload.name,
        summary: payload.summary,
        description: payload.description,
        validityDate: payload.validity,
        workStartDate: payload.startDate,
        workEndDate: payload.endDate,
        requestedBy: userEmail,
        requesterContact: userMobile,
        projectName: payload.projectName,
        location: payload.projectLocation,
        capacity: payload.capacity,
        uom: payload.uom,
        creditPeriod: payload.creditPeriod
      }

      let query = { isDeleted: false, name: payload.name, requestedBy: payload.requestedBy };
      if (supplierId) {
        query = { isDeleted: false, name: payload.name, supplierId: supplierId };
      }

      //Check for duplicate RFQ name
      RFQ.findOne(query, async (err, rfq) => {
        if (rfq && rfq.rfqId != inRFQ.rfqId) {
          return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
            message: STATUS_CODE.RFQ_UPDATE_FAILED_DUPLICATE_NAME,
          });
        }
      });

      RFQ.findOneAndUpdate({ rfqId: inRFQ.rfqId }, inRFQ, (err, rfq) => {
        if (err || !rfq) {
          return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
            message: STATUS_CODE.RFQ_UPDATE_FAILED,
          });
        }

        return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
          error: false,
          message: STATUS_CODE.RFQ_UPDATE_SUCCESS,
          payload: rfq
        });
      });

    } catch (err) {
      logger.error(err.message);
      return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: false,
        message: STATUS_CODE.RFQ_UPDATE_FAILED,
      });
    }

  }

  async deleteRFQ(req, resp) {

    logger.info("RFQsController.deleteRFQ()", req.body);

    try {

      const payload = req.body.payload;

      const rfqId = payload.rfqId;

      RFQ.findOne({ rfqId }, (err, rfq) => {

        if (err || !rfq) {
          return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
            message: STATUS_CODE.RFQ_DELETED_FAILED,
          });
        }

        rfq.isDeleted = true;

        rfq.save().then((oOrder) => {
          logger.info("RFQsController.deleteRFQ() deleted successfully", oOrder);

          return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
            error: false,
            message: STATUS_CODE.RFQ_DELETED_SUCCESS,
          });
        });
      });

    } catch (err) {
      logger.error(err.message);
      return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: false,
        message: STATUS_CODE.RFQ_DELETED_FAILED,
      });
    }

  }

  async getRFQ(req, resp) {
    logger.info("RFQsController.getRFQ()", req.query);
    try {
      const rfqIdIn = req.query.rfqId;

      RFQ.findOne({ isDeleted: false, rfqId: rfqIdIn }, (err, rfq) => {

        if (err || !rfq) {
          return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
            message: STATUS_CODE.RFQ_FETCHE_FAILED,
          });
        }

        logger.info("RFQsController.getAllRFQs() rfq: ", rfq);

        return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
          error: false,
          message: STATUS_CODE.RFQ_FETCHED_SUCCESS,
          payload: rfq
        });
      });
    } catch (err) {
      logger.error(err.message);
      return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: false,
        message: STATUS_CODE.RFQ_FETCHE_FAILED,
      });
    }
  }

  async getAllRFQs(req, resp) {

    logger.info("RFQsController.getAllRFQs()", req.query);

    try {
      // let userEmail = req.headers['email'];
      let userMobile = req.body.userMobile;
      const userId = req.headers['userid'];
      const supplierId = req.query.supplierId || req.headers['supplierid']
      // const requestedBy = userEmail || req.query.requestedBy;

      let query = { isDeleted: false, requesterContact: userMobile };
      // if (supplierId){
      //   query = { isDeleted: false, supplierId: supplierId };
      // }
      RFQ.find({
        $and: [{ isDeleted: false, requesterContact: userMobile }]
        // $and : [ query,
        //         { $or: [{requesterId: userId}, {requesterContact: userMobile}]}
        //       ]
      }, (err, rfqs) => {

        if (err) {
          return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
            message: STATUS_CODE.SERVICE_FETCHED_FAILED,
          });
        }

        logger.info("RFQsController.getAllRFQs() rfqs[]", rfqs);

        return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
          error: false,
          message: STATUS_CODE.RFQ_FETCHED_SUCCESS,
          payload: rfqs
        });
      });

    } catch (err) {
      logger.error(err.message);
      return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: false,
        message: STATUS_CODE.RFQ_FETCHE_FAILED,
      });
    }

  }

  async getRFQs(req, resp) {
    logger.info("RFQsController.getAllRFQs()", req.query);
    try {
      let requesterId = req.query.userId;
      let query = { isDeleted: false, requesterId: requesterId, status: { $nin: ['CLOSED', 'EXPIRED'] } };

      if (req.query.startDate) {
        const daysAgo = parseInt(req.query.startDate);
        // Calculating startDate using date-fns(a npm package to handle date and time)
        const startDate = subDays(new Date(), daysAgo);
        query.createdAt = { $gte: startDate };
      }

      const page = req.query.page ? parseInt(req.query.page) : 1;
      const pageSize = 10;
      const skip = (page - 1) * pageSize;

      const [rfqs, totalCount] = await Promise.all([
        RFQ.find(query)
          .sort({ createdAt: -1 }) // sorting by createdAt in descending order
          .skip(skip)
          .limit(pageSize)
          .exec(),
        RFQ.countDocuments(query).exec(),
      ]);

      logger.info("RFQsController.getAllRFQs() rfqs[]", rfqs);
      const totalPages = Math.ceil(totalCount / pageSize);
      return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
        error: false,
        message: STATUS_CODE.RFQ_FETCHED_SUCCESS,
        payload: {
          rfqs,
          totalCount,
          currentPage: page,
          totalPages: totalPages === 0 ? 1 : totalPages,
        },
      });
    } catch (err) {
      logger.error(err.message);
      return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: false,
        message: STATUS_CODE.RFQ_FETCHE_FAILED,
      });
    }
  }

  async searchInRfqs(req, resp) {
    logger.info("RFQsController.getAllRFQs()", req.query);
    try {
      let requesterId = req.query.userId;
      if (!requesterId) {
        return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
          error: true,
          message: "Requester ID is required.",
        });
      }

      let query = {
        isDeleted: false,
        requesterId: requesterId,
        status: { $nin: ['CLOSED', 'EXPIRED'] },
      };

      if (req.query.searchParam) {
        const searchRegex = new RegExp(req.query.searchParam, 'i');
        query.$or = [
          { description: { $regex: searchRegex } },
          { name: { $regex: searchRegex } },
        ];
      }

      const page = req.query.page ? parseInt(req.query.page) : 1;
      const pageSize = 10;
      const skip = (page - 1) * pageSize;

      const [rfqs, totalCount] = await Promise.all([
        RFQ.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .exec(),
        RFQ.countDocuments(query).exec(),
      ]);

      logger.info("RFQsController.getAllRFQs() rfqs[]", rfqs);
      const totalPages = Math.ceil(totalCount / pageSize);
      return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
        error: false,
        message: STATUS_CODE.RFQ_FETCHED_SUCCESS,
        payload: {
          rfqs,
          totalCount,
          currentPage: page,
          totalPages: totalPages === 0 ? 1 : totalPages,
        },
      });
    } catch (err) {
      logger.error(err.message);
      return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: false,
        message: STATUS_CODE.RFQ_FETCHE_FAILED,
      });
    }
  }


  async searchInGlobalRfqs(req, resp) {
    logger.info("RFQsController.getAllRFQs()", req.query);
    try {

      let query = {
        isDeleted: false,
        status: { $nin: ['CLOSED', 'EXPIRED'] },
      };

      if (req.query.searchParam) {
        const escapedSearchParam = req.query.searchParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escapedSearchParam, "i");
        query.$or = [
          { description: { $regex: searchRegex } },
          { name: { $regex: searchRegex } },
          { requesterName: { $regex: searchRegex } },
          { requesterContact: { $regex: searchRegex } },
          { "suppliers": { $elemMatch: { businessName: { $regex: searchRegex } } } }
        ];
      }

      const page = req.query.page ? parseInt(req.query.page) : 1;
      const pageSize = 100;
      const skip = (page - 1) * pageSize;

      const [rfqs, totalCount] = await Promise.all([
        RFQ.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .exec(),
        RFQ.countDocuments(query).exec(),
      ]);

      // logger.info("RFQsController.getAllRFQs() rfqs[]", rfqs);
      const totalPages = Math.ceil(totalCount / pageSize);
      return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
        error: false,
        message: STATUS_CODE.RFQ_FETCHED_SUCCESS,
        payload: {
          rfqs,
          totalCount,
          currentPage: page,
          totalPages: totalPages === 0 ? 1 : totalPages,
        },
      });
    } catch (err) {
      logger.error(err.message);
      return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: false,
        message: STATUS_CODE.RFQ_FETCHE_FAILED,
      });
    }
  }

  //////////////////Total RFQS in Database for Admin Panel////////////////////////////
  /*
    async getTotalRFQS(req, resp) {
      try {
        
        RFQ.find((err, rfqs) => {
            if (err) {
                return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
                    message: STATUS_CODE.RFQ_FETCHED_FAILED,
                });
            }
  
          logger.info("RFQsController.getAllRFQs() rfqs[]", rfqs);
  
          return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
            error: false,this is my api 
            message: STATUS_CODE.RFQ_FETCHED_SUCCESS,
            payload: rfqs
          });
        });
  
      } catch (err) {
        logger.error(err.message);
        return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
          error: false,
          message: STATUS_CODE.RFQ_FETCHED_FAILED,
        });
      }
    }
  */

  async getTotalRFQS(req, res) {
    try {
      logger.info("RFQsController.getTotalRFQS", req.query);
      const page = req.query.page ? parseInt(req.query.page) : 1;
      const limit = 100; // Number of RFQs per page
      const skip = (page - 1) * limit;

      const [rfqs, totalCount] = await Promise.all([
        RFQ.find({})
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        // Count total documents without any filtering:
        RFQ.countDocuments({}).exec(),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return res.status(STATUS_CODE.SERVER_SUCCESS).json({
        error: false,
        message: STATUS_CODE.RFQ_FETCHED_SUCCESS,
        rfqs: rfqs,
        totalCount: totalCount,
        currentPage: page,
        totalPages: totalPages === 0 ? 1 : totalPages
      });

    } catch (error) {
      logger.error("RFQsController.getTotalRFQS Error", error);
      res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: true,
        message: STATUS_CODE.RFQ_FETCHED_FAILED
      })
    }
  }

  ////////////////////////////////////////////////////////////////////////////////////

  /* This API is no more being used as we are always sending RFQ to suppliers*/
  async addSuppliersToRFQ(req, resp) {
    logger.info("RFQsController.addSuppliersToRFQ()", req.body);

    try {
      const payload = req.body.payload;
      var supplierList = payload.suppliers;

      RFQ.findOne({ isDeleted: false, rfqId: payload.rfqId }, (err, rfq) => {
        if (err) {
          logger.info("RFQsController.addSuppliersToRFQ() cannot find rfq with Id: ", payload.rfqId);
          return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
            message: STATUS_CODE.RFQ_FETCHE_FAILED,
          });
        }

        logger.info("RFQsController.addSuppliersToRFQ() found rfq with Id: ", payload.rfqId, " rfq:", rfq);
        supplierList.forEach(function (supplier, i) {
          logger.info("RFQsController.addSuppliersToRFQ() adding supplier as: ", supplier);
          rfq.suppliers.push(supplier);
        });


        rfq.save(async (err, rfq) => {
          if (err) {
            logger.info("RFQsController.addSuppliersToRFQ() err=", err);

            return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
              message: STATUS_CODE.SERVICE_ADD_FAILED,
            });
          }

          logger.info("RFQsController.addSuppliersToRFQ() saved rfq ", rfq);

          resp.status(STATUS_CODE.SERVER_SUCCESS).json({
            message: STATUS_CODE.ORDER_CREATE_SUCCESS,
            payload: {
              rfq: rfq,
            }
          });
        });

      });

    } catch (err) {
      logger.error(err.message);
      return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: false,
        message: STATUS_CODE.RFQ_ADD_SUPPLIERS_FAILED,
      });
    }
  }

  /* async addSuppliersToRFQAndSend(req, resp) {
   logger.info("RFQsController.addSuppliersToRFQAndSend()", req.body);

   try {
     const payload = req.body.payload;
     var supplierList = payload.suppliers;
     let requesterName = req.headers['name'];

     RFQ.findOne({ isDeleted: false, rfqId: payload.rfqId }, async (err, rfq) => {
       if (err) {
         logger.info("RFQsController.addSuppliersToRFQAndSend() cannot find rfq with Id: ", payload.rfqId);
         return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
           message: STATUS_CODE.RFQ_FETCHE_FAILED,
         });
       }

       logger.info("RFQsController.addSuppliersToRFQAndSend() found rfq with Id: ", payload.rfqId, " rfq:", rfq);
       let recipients = [];

       let suppliersDetails = await Publisher.getSupplierContacts({ suppliers: supplierList });
       if (suppliersDetails) {
         suppliersDetails.forEach(function (supplier, i) {
           logger.info("RFQsController.addSuppliersToRFQAndSend() adding supplier as: ", supplier);

           const isPresent = (rfq.supplier && rfq.supplier.length > 0) ? rfq.suppliers.filter(s => s.supplierId === supplier.supplierId).length > 0 : false;

           if (isPresent == false) {
             rfq.suppliers.push(supplier);
           }
           recipients.push(supplier.email);


         });
       }
       logger.info("RFQsController.addSuppliersToRFQAndSend(): recipients : ", recipients);

       const txt = JSON.stringify(rfq);
       const finalRfq = JSON.parse(txt);
       finalRfq.requesterName = requesterName;
       let respData = await RFQMailer.sendRFQMail(recipients, finalRfq);
       logger.info("RFQsController.addSuppliersToRFQAndSend() respData from mailer: ", respData);

       let status = STATUS_CODE.SERVER_BAD_REQUEST;
       let msg = STATUS_CODE.RFQ_SEND_FAILED;

       if (respData != null) {
         //set status for the supplier as mail Sent
         logger.info("RFQsController.addSuppliersToRFQAndSend() : Setting the Status of each supplier");
         rfq.suppliers.forEach(async function (supplier, i) {
           if (recipients.indexOf(supplier.email)) {
             rfq.suppliers[i].status = RFQSupplierStatus.PUBLISHED;
           }
         });

         status = STATUS_CODE.SERVER_SUCCESS;
         msg = STATUS_CODE.RFQ_ADD_SUPPLIERS_SUCCESS;
       }
       else {
         logger.info("RFQsController.addSuppliersToRFQAndSend(): Failed to send mail to supplier");
         status = STATUS_CODE.SERVER_SUCCESS;
       }

       logger.info("RFQsController.addSuppliersToRFQAndSend(): Save the rfq with supplier details");
       rfq.save(async (err, rfq) => {
         if (err) {
           logger.info("RFQsController.addSuppliersToRFQAndSend() err=", err);

           return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
             message: STATUS_CODE.RFQ_ADD_SUPPLIERS_FAILED,
           });
         }

         logger.info("RFQsController.addSuppliersToRFQAndSend() saved rfq ", rfq);
         //Send notification
         addNotification(supplierList, rfq);
         resp.status(status).json({
           message: msg,
           payload: {
             rfq: rfq,
           }
         });
       });
       logger.info("RFQsController.addSuppliersToRFQAndSend(): Returning");
     });

   } catch (err) {
     logger.error("ERROR RFQsController.addSuppliersToRFQAndSend():", err.message);
     return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
       error: false,
       message: STATUS_CODE.RFQ_ADD_SUPPLIERS_FAILED,
     });
   }
 }
 */

  async addSuppliersToRFQAndSend(req, res) {
    logger.info("RFQsController.addSupplierToRfqAndSend()", req.body);
    try {
      const { rfqId, supplierList, page, userId } = req.body;

      // Find RFQ by rfqId
      const rfq = await RFQ.findOne({ rfqId: rfqId });

      if (!rfq) {
        logger.error("RFQsController.addSupplierToRfqAndSend() RFQ not found");
        return res.status(STATUS_CODE.NOT_FOUND).json({
          error: true,
          message: STATUS_CODE.RFQ_NOT_FOUND,
        });
      }

      logger.info("RFQsController.addSupplierToRfqAndSend() found RFQ", rfq);

      // Get supplier details
      const supplierDetails = await Publisher.getSupplierContacts({ suppliers: supplierList });

      if (supplierDetails && supplierDetails.length > 0) {
        // Add suppliers to the rfq.suppliers array
        rfq.suppliers.push(...supplierDetails);

        // Save the updated RFQ
        await rfq.save();

        const basicRecipient = [];
        const premiumRecipient = [];

        supplierDetails.forEach((supplier) => {
          if (supplier.isPremium) {
            premiumRecipient.push(...supplier.emails);
          } else {
            basicRecipient.push(...supplier.emails);
          }
        });

        const finalRfq = { ...rfq.toObject() };
        finalRfq.suppliers = supplierDetails;

        // Send RFQ mail
        const respData = await RFQMailer.sendRFQMail(basicRecipient, premiumRecipient, finalRfq);

        if (respData && respData.payload.error === false) {

          const currentPage = page ? parseInt(page) : 1;
          var pageSize = 10
          const skip = (currentPage - 1) * pageSize;

          var [rfqs, totalCount] = await Promise.all([
            RFQ.find({ isDeleted: false, requesterId: userId, status: { $nin: ['CLOSED', 'EXPIRED'] } })
              .sort({ createdAt: -1 }) // sorting by createdAt in descending order
              .limit(pageSize)
              .skip(skip)
              .exec(),
            RFQ.countDocuments({ isDeleted: false, requesterId: userId, status: { $nin: ['CLOSED', 'EXPIRED'] } }).exec(),
          ]);

          const totalPages = Math.ceil(totalCount / pageSize);

          return res.status(STATUS_CODE.SERVER_SUCCESS).json({
            rfqs: rfqs,
            totalPages,
            totalCount,
            currentPage: currentPage,
            error: false,
            message: STATUS_CODE.ADD_SUPPLIER_IN_RFQ_SUCCESS,
          });
        }
      } else {
        logger.warn("RFQsController.addSupplierToRfqAndSend() No supplier details found");
      }

      return res.status(STATUS_CODE.SERVER_SUCCESS).json({
        error: false,
        message: STATUS_CODE.ADD_SUPPLIER_IN_RFQ_SUCCESS,
      });
    } catch (error) {
      logger.error("RFQsController.addSupplierToRfqAndSend() error", error);
      return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: true,
        message: STATUS_CODE.FAILED_ADD_SUPPLIER_IN_RFQ,
      });
    }
  }


  async submitRFQ(req, resp) {
    logger.info("RFQsController.submitRFQ()", req.body);

    try {
      const payload = req.body.payload;

      RFQ.findOne({ isDeleted: false, rfqId: payload.rfqId }, (err, rfq) => {
        if (err) {
          logger.info("RFQsController.addSuppliersToRFQ() cannot find rfq with Id: ", payload.rfqId);
          return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
            message: STATUS_CODE.RFQ_FETCHE_FAILED,
          });
        }

        logger.info("RFQsController.submitRFQ() found rfq with Id: ", payload.rfqId, " rfq:", rfq);
        rfq.status = "SUBMITTED";

        rfq.save(async (err, rfq) => {
          if (err) {
            logger.info("RFQsController.submitRFQ() err=", err);

            return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
              message: STATUS_CODE.RFQ_SUBMIT_FAILED,
            });
          }

          logger.info("RFQsController.submitRFQ() saved rfq ", rfq);

          resp.status(STATUS_CODE.SERVER_SUCCESS).json({
            message: STATUS_CODE.RFQ_SUBMIT_SUCCESS,
            payload: {
              rfq: rfq,
            }
          });
        });

      });

    } catch (err) {
      logger.error("ERROR RFQsController.submitRFQ() :", err.message);
      return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: false,
        message: STATUS_CODE.RFQ_SUBMIT_FAILED,
      });
    }
  }

  async closeRFQ(req, resp) {
    logger.info("RFQsController.closeRFQ()", req.body);

    try {
      const payload = req.body.payload;

      RFQ.findOne({ isDeleted: false, rfqId: payload.rfqId }, (err, rfq) => {

        rfq.status = "CLOSED";

        rfq.save(async (err, rfq) => {
          if (err) {
            logger.info("RFQsController.closeRFQ() err=", err);

            return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
              message: STATUS_CODE.RFQ_CLOSE_FAILED,
            });
          }

          logger.info("RFQsController.closeRFQ() saved rfq ", rfq);

          resp.status(STATUS_CODE.SERVER_SUCCESS).json({
            message: STATUS_CODE.RFQ_CLOSE_SUCCESS,
            payload: {
              rfq: rfq,
            }
          });
        });
      });
    } catch (err) {
      logger.error(err.message);
      return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: false,
        message: STATUS_CODE.RFQ_CLOSE_FAILED,
      });
    }
  }

  // File upload handler function
  async fileUpload(req, res) {
    // console.log("this is a rfq***", req.body);
    // const filesToUpload = req.files['files[]']
    const filesToUpload = req.body
    logger.log("req.files", req.files)
    try {
      if (!filesToUpload || filesToUpload.length === 0) {
        return res.status(400).json({ error: 'No files uploaded.' });
      }

      const uploadedFilesInfo = [];

      // Iterate through each file and upload them to Azure Blob Storage
      if (typeof filesToUpload === 'object' && !Array.isArray(filesToUpload)) {// when attchment is only one then send only one fileer8sd

        const fileInfo = await uploadFileToAzureBlobStorage(filesToUpload);
        uploadedFilesInfo.push(fileInfo);
      } else { // if file is selected more than 1 attachments so run array
        for (const file of filesToUpload) {
          const fileInfo = await uploadFileToAzureBlobStorage(file);
          uploadedFilesInfo.push(fileInfo);
        }
      }

      // You can perform further processing here if needed, such as storing the URLs in a database or sending them to the client, etc.

      // Return the array of fileInfo as a response
      res.json(uploadedFilesInfo);
    } catch (error) {
      console.error('Error during file upload:', error);
      logger.log('Error during file upload:', error);
      res.status(500).json({ error: 'Failed to upload the files.' });
    }
  }

  async resendRFQ(req, resp) {
    try {
      const payload = req.body;
      var rfqId = payload.rfqId;
      const supplierId = payload.supplierId
      const requesterId = payload.userId;
      const additonalData = payload.additionalNote

      const rfq = await RFQ.findOne({ rfqId: rfqId });

      if (!rfq) {
        return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
          message: STATUS_CODE.RFQ_FETCHE_FAILED,
        });
      }

      const selectedSupplier = rfq.suppliers.filter((supplier) => supplier.supplierId === supplierId);
      if (selectedSupplier.length > 0) {
        console.log("IN THE SUPPLIER SERVICE")
        var suppliersDetails = await Publisher.getSupplierContacts({ suppliers: selectedSupplier });
      }
      // let recipient = [];
      let basicRecipient = [];
      let premiumRecipient = [];

      if (suppliersDetails.length > 0) {
        suppliersDetails.forEach((supplier) => {
          if (supplier.isPremium === true) {
            premiumRecipient = premiumRecipient.concat(additonalData.emails);
          } else {
            basicRecipient = basicRecipient.concat(additonalData.emails);
          }
        });
      }

      const finalRfq = { ...rfq.toObject() };
      finalRfq.suppliers = suppliersDetails;
      finalRfq.requesterName = additonalData.senderName;
      finalRfq.requestedBy = additonalData.sentByEmail;
      finalRfq.newCcEmails = additonalData.ccEmails;


      // Assuming suppliersDetails is an array
      const lastSupplierIndex = finalRfq.suppliers.length - 1;

      // Assuming additonalData is an object to be pushed into noteDescriptions
      finalRfq.suppliers[lastSupplierIndex].noteDescriptions.push(additonalData);

      let respData = await RFQMailer.sendResendRFQMail(basicRecipient, premiumRecipient, finalRfq);
      logger.info("RFQsController.resendRFQ() respData from mailer: ", respData);
      if (respData == null) {
        resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
          error: false,
          message: `Failed to resend requirement`,
        });
      } else {

        const currentDate = new Date();
        var formattedDateIST = new Date(currentDate);

        if (respData.payload.error === false) {
          const selectedSupplier = rfq.suppliers.find((supplier) => supplier.supplierId === supplierId);

          if (selectedSupplier) {
            selectedSupplier.resendCount += 1;
            selectedSupplier.reminderDate = formattedDateIST;
            selectedSupplier.noteDescriptions.push(additonalData);
          }

          await rfq.save();

          const page = payload.page ? parseInt(payload.page) : 1;
          var pageSize = 10;
          const skip = (page - 1) * pageSize;

          var [rfqs, totalCount] = await Promise.all([
            RFQ.find({ isDeleted: false, requesterId: requesterId, status: { $nin: ['CLOSED', 'EXPIRED'] } })
              .sort({ createdAt: -1 }) // sorting by createdAt in descending order
              .limit(pageSize)
              .skip(skip)
              .exec(),
            RFQ.countDocuments({ isDeleted: false, requesterId: requesterId, status: { $nin: ['CLOSED', 'EXPIRED'] } }).exec(),
          ]);
        }
        const totalPages = Math.ceil(totalCount / pageSize);
        resp.status(STATUS_CODE.SERVER_SUCCESS).json({
          payload: {
            rfqs,
            totalCount,
            currentPage: 1,
            totalPages: totalPages === 0 ? 1 : totalPages,
            error: false,
            message: "The requirement has been resend successfully to vendor",
          },
        });
      }
    } catch (error) {
      logger.error(error.message);
      return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        message: `Failed to resend requirement with rfqId: ${rfqId}`,
      });
    }
  }

  async healthCheck(req, resp) {
    resp.status(STATUS_CODE.SERVER_SUCCESS).json({ message: "Health Ok" });
  }

  async sendExcelSheet(req, res) {
    try {
      const userId = req.query.userId;
      const range = Number(req.query.range);

      if (isNaN(range)) {
        return res.status(400).send('Invalid or missing range parameter');
      }
      const IST = 'Asia/Kolkata';
      let startDate;
      if (range === 0) {
        startDate = moment().tz(IST).startOf('day'); // Today
      } else {
        startDate = moment().tz(IST).startOf('day').subtract(range, 'days'); // Last 'range' days
      }

      const rfqs = await RFQ.find({ requesterId: userId, createdAt: { $gte: startDate } }).sort({ createdAt: -1 });
      if (rfqs.length === 0) {
        return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({ message: 'No requirements found for today' });
      }

      const workbook = new exceljs.Workbook();
      const worksheet = workbook.addWorksheet('RFQs');

      worksheet.columns = [
        { header: 'RFQ Number', key: 'rfqId', width: 15 },
        { header: 'Business Name', key: 'businessName', width: 20 },
        { header: 'Credit Period', key: 'creditPeriod', width: 15 },
        { header: 'Location', key: 'location', width: 15 },
        { header: 'Name', key: 'name', width: 15 },
        { header: 'Created Date', key: 'createdAt', width: 15 },
        // Add other columns as needed
      ];

      rfqs.forEach((rfq) => {
        if (rfq.suppliers && rfq.suppliers.length > 0) {
          rfq.suppliers.forEach((supplier) => {
            if (supplier && supplier.businessName !== null && supplier.businessName !== undefined) {
              worksheet.addRow({
                rfqId: rfq.rfqId,
                businessName: supplier.businessName || '',
                creditPeriod: rfq.creditPeriod,
                location: rfq.location,
                name: rfq.name,
                createdAt: moment(rfq.createdAt).tz(IST).format('DD-MM-YYYY'),
                // Add other columns as needed
              });
            }
          });
        }
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=rfqs.xlsx');

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error(error);
      res.status(500).send(`Internal Server Error: ${error.message}`);
    }
  };

  async updateRepeatOrder(req, res) {
    logger.info("RFQsController.updateRepeatOrder()", req.body);

    try {
        const payload = req.body;
        const {
            repeatRfqId,
            orderName,
            vendorName,
            typeOfOrder,
            vendorId,
            orderValue,
            description,
            projectName,
            projectId,
            orderCategory,
            poDetails,
        } = payload;

        const updateFields = {
            orderName,
            vendorName,
            typeOfOrder,
            vendorId,
            orderValue,
            description,
            projectName,
            projectId,
            orderCategory
        };

        Object.keys(updateFields).forEach(key => updateFields[key] === undefined && delete updateFields[key]);

        if (poDetails && poDetails.length > 0) {
            // Check for duplicate PO numbers in other documents
            const existingOrders = await RepeatFixedRFQ.find(
                { repeatRfqId: { $ne: repeatRfqId }, 'poDetails.poNumber': { $exists: true, $ne: null } },
                { 'poDetails.poNumber': 1 }
            );

            console.log("EXISTINGOREDRS", existingOrders);

            const existingPoNumbers = existingOrders.flatMap(doc =>
                doc.poDetails.map(detail => detail.poNumber)
            ).filter(Boolean);

            const newPoNumbers = poDetails.map(detail => detail.poNumber);
            const duplicatePoNumbers = newPoNumbers.filter(poNumber => existingPoNumbers.includes(poNumber));

            if (duplicatePoNumbers.length > 0) {
                return res.status(409).json({
                    error: true,
                    message: `PO number(s) already exist: ${duplicatePoNumbers.join(', ')}`,
                });
            }
        }

        const updatedRepeatOrder = await RepeatFixedRFQ.findOneAndUpdate(
            { repeatRfqId: repeatRfqId },
            { $set: updateFields },
            { new: true }
        );

        if (!updatedRepeatOrder) {
            return res.status(404).json({
                error: true,
                message: `Order not found with id ${repeatRfqId}`,
            });
        }

        if (poDetails && poDetails.length > 0) {
            // Update poDetails
            updatedRepeatOrder.poDetails = poDetails;
        }

        await updatedRepeatOrder.save();

        return res.status(200).json({
            error: false,
            message: `Repeat Order updated Successfully`,
            payload: updatedRepeatOrder
        });
    } catch (err) {
        logger.error(err.message);
        return res.status(500).json({
            error: true,
            message: err.message,
        });
    }
}


  async deleteRepeatOrder(req, res) {
    logger.info("RFQsController.deleteRepeatOrder()", req.query);

    try {
      const { repeatRfqId, userId } = req.query;

      if (!repeatRfqId) {
        return res.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
          error: true,
          message: "Please provide a repeatRfqId to delete the order",
        });
      }

      const orderToDelete = await RepeatFixedRFQ.findOne({ repeatRfqId });

      if (!orderToDelete) {
        return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
          error: true,
          message: `Order not found with id ${repeatRfqId}`,
        });
      }

      console.log(typeof orderToDelete.createdBy, typeof userId, orderToDelete.createdBy, userId);


      if (orderToDelete.createdBy !== Number(userId)) {
        return res.status(STATUS_CODE.SERVER_UNAUTHORIZED).json({
          error: true,
          message: "This order was not created by you. You cannot delete it.",
        });
      }

      const deletedOrder = await RepeatFixedRFQ.findOneAndDelete({ repeatRfqId, createdBy: userId });

      if (!deletedOrder) {
        return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
          error: true,
          message: `Failed to delete order with id ${repeatRfqId}`,
        });
      }

      const page = parseInt(req.query.page) || 1;
      const pageSize = 10;
      const skip = (page - 1) * pageSize;

      const [rfqs, totalRepeatRfqs] = await Promise.all([
        RepeatFixedRFQ.find({ createdBy: userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .exec(),
        RepeatFixedRFQ.countDocuments({ createdBy: userId }).exec(),
      ]);

      return res.status(STATUS_CODE.SERVER_SUCCESS).json({
        error: false,
        message: "Repeat Order deleted successfully.",
        payload: {
          rfqs,
          totalRepeatRfqs,
          currentPage: page,
          totalPages: Math.ceil(totalRepeatRfqs / pageSize),
        },
      });

    } catch (err) {
      logger.error(err.message);
      return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: true,
        message: err.message,
      });
    }
  }


  async SearchInRepeatOrder(req, res) {
    logger.info("RFQsController.SearchInRepeatOrder()", req.body);

    try {
      const { userIds, searchParam } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
          error: true,
          message: "Please provide an array of userIds in the request body",
        });
      }

      const page = parseInt(req.body.page) || 1;
      const pageSize = 10;
      const skip = (page - 1) * pageSize;

      const searchCriteria = {
        createdBy: { $in: userIds },
        $or: [
          { orderName: { $regex: searchParam, $options: 'i' } },
          { repeatRfqId: { $regex: searchParam, $options: 'i' } },
          { vendorName: { $regex: searchParam, $options: 'i' } },
          { typeOfOrder: { $regex: searchParam, $options: 'i' } },
          { vendorId: { $regex: searchParam, $options: 'i' } },
          { orderValue: { $regex: searchParam, $options: 'i' } },
          { description: { $regex: searchParam, $options: 'i' } },
          { addedBy: { $regex: searchParam, $options: 'i' } },
          { projectName: { $regex: searchParam, $options: 'i' } },
          { 'poDetails.poNumber': { $regex: searchParam, $options: 'i' } }
        ]
      };

      const [rfqs, totalRepeatRfqs] = await Promise.all([
        RepeatFixedRFQ.find(searchCriteria)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .exec(),
        RepeatFixedRFQ.countDocuments(searchCriteria).exec(),
      ]);

      return res.status(STATUS_CODE.SERVER_SUCCESS).json({
        error: false,
        message: "Repeat Order search successful.",
        payload: {
          rfqs,
          totalRepeatRfqs,
          currentPage: page,
          totalPages: Math.ceil(totalRepeatRfqs / pageSize),
        },
      });

    } catch (err) {
      logger.error(err.message);
      return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
        error: true,
        message: err.message,
      });
    }
  }

  async updateEmailStatus(req, resp) {
    try {
     // logger.info("Received Postmark webhook data: HEADERS", req.headers)
     const webhookData = req.body;
     const data = webhookData.Metadata
     const status = webhookData.RecordType
     const emailToUpdate = webhookData.Recipient
     if (data?.rfqId) {
       const emailUpdateResult = await updateEmailStatusInRFQ(data, emailToUpdate,status)
       logger.info('Received Postmark webhook tracking emailUpdateResult', emailUpdateResult);
     }
     logger.info('Received Postmark webhook tracking webhookData:', webhookData);
     resp.sendStatus(200);
    } catch (error) {
     logger.info('error', error);
    }
   }



}

module.exports = new RFQsController();
