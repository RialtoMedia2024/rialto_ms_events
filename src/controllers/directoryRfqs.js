const RFQ = require("../models/rfqs");
const entityProjects = require("../models/entityProjects.js")
const STATUS_CODE = require("../configs/errors");
const logger = require("../logger/logger.js")
const RFQMailer = require("../helpers/rfqMailer");
const updateSupplierLeads = require("../helpers/addSupplierLeads.js");
const Publisher = require("./../utilities/publisher");
const path = require('path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const { htmlToText } = require('html-to-text');


class DirectoryRfqController {

    async saveRfq(req, res) {
        try {
            logger.info("DirectoryRfqController.saveRfq", req.body);

            const {
                name,
                entityId,
                estimatedValue,
                rfqType,
                validityDate,
                newCcEmails,
                projectName,
                location,
                creditPeriod,
                description,
                selectedFilesBase,
                requesterName,
                requesterMobile,
                userBusinessName,
                requestedBy,
                requesterId,
                isEntityUser,
                workStartDate,
                projectId,
                indentId
            } = req.body;

            if (!description) {
                logger.error("DirectoryRfqController.saveRfq- Description is required")
                return res.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
                    error: true,
                    message: "Description is required to save RFQ"
                });
            }

            const rfqToSave = {
                name,
                entityId,
                estimatedValue,
                rfqType,
                validityDate,
                newCcEmails,
                projectName,
                location,
                creditPeriod,
                description,
                selectedFilesBase,
                requesterName,
                requesterContact: requesterMobile,
                requesterMobile,
                userBusinessName,
                requestedBy,
                requesterId,
                isEntityUser,
                workStartDate,
                projectId,
                indentId
            };


            // Fetch project details if projectId is provided
            if (projectId) {
                try {
                    const projectDetails = await entityProjects.findById(
                        { _id: projectId },
                        { name: 1, location: 1, engineerDetails: 1 }
                    );

                    if (projectDetails) {
                        rfqToSave.projectName = projectDetails.name;
                        rfqToSave.location = `${projectDetails.location.city}, ${projectDetails.location.state}`;
                    }
                } catch (error) {
                    logger.error("Error fetching project details:", error);
                }
            }

            try {
                await Publisher.addCcEmailsEntity({ entityId, emailsToAdd: newCcEmails });
            } catch (error) {
                logger.error("Error adding CC emails to entity:", error);
            }

            const newRFQ = new RFQ(rfqToSave);
            const createdRFQ = await newRFQ.save();

            logger.info("DirectoryRfqController.save saved rfq-", createdRFQ);

            res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: STATUS_CODE.RFQ_CREATE_SUCCESS,
                payload: createdRFQ
            });
        } catch (error) {
            logger.error('Error creating RFQ:', error);
            res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: STATUS_CODE.RFQ_CREATE_FAILED
            });
        }
    }

    async addSuppliersToRfq(req, res) {
        try {
            logger.info("DirectoryRfqController.addSuppliersToRfq", req.body);

            const { rfqId, suppliers } = req.body;

            const rfq = await RFQ.findOne({ rfqId });

            // Check if RFQ exists
            if (!rfq) {
                logger.error("DirectoryRfqController.addSuppliersToRfq - RFQ not found");
                return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
                    error: true,
                    message: `RFQ not found with rfqId ${rfqId}`
                });
            }
            const existingVendorIds = rfq.suppliers.map(supplier => supplier.supplierId);
            const newSuppliers = suppliers.filter(supplier => !existingVendorIds.includes(supplier.supplierId));

            // Add new suppliers to the RFQ
            rfq.suppliers.push(...newSuppliers);

            // Update the RFQ status to "DRAFT"
            if (newSuppliers.length > 0) {
                rfq.status = "DRAFT";
            }

            // Save the updated RFQ to the database
            const updatedRFQ = await rfq.save({ new: true });
            let invitationResult;
            if (newSuppliers.length > 0) {
                invitationResult = await inviteVendorsToRfq(updatedRFQ, newSuppliers);
            }

            logger.info("DirectoryRfqController.addSuppliersToRfq - Suppliers added to RFQ and status updated to 'DRAFT'");
            // Respond with the updated RFQ and the existing vendor IDs

            res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: invitationResult === undefined ? STATUS_CODE.RFQ_ADD_SUPPLIERS_DUPLICATE : STATUS_CODE.RFQ_ADD_INVITE_SUPPLIERS_SUCCESS,
                payload: {
                    updatedRFQ: invitationResult && invitationResult.rfq || updatedRFQ,
                    invalidEmailAddresses: invitationResult && invitationResult.invalidEmailAddresses,
                    whatsAppInviteStatus: invitationResult && invitationResult.whatsAppInviteStatus,
                    existingVendorIds
                }
            });
        } catch (error) {
            logger.error('DirectoryRfqController.addSuppliersToRfq, Error adding suppliers to RFQ:', error);
            res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: STATUS_CODE.RFQ_ADD_SUPPLIERS_FAILED
            });
        }
    }


    async removeSupplierFromRfq(req, res) {
        try {
            logger.info("DirectoryRfqController.removeSupplierFromRfq", req.body)
            const { rfqId, supplierId } = req.query

            // Find the RFQ by ID
            const rfq = await RFQ.findOne({ rfqId });

            // Check if RFQ exists
            if (!rfq) {
                logger.error("DirectoryRfqController.addSuppliersToRfq - RFQ not found");
                return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
                    error: true,
                    message: `RFQ not found with rfqId ${rfqId}`
                });
            }

            // Remove each supplier with the given supplierIds from the RFQ's suppliers array
            if (supplierId) {
                const index = rfq.suppliers.findIndex(supplier => supplier.supplierId === supplierId);
                if (index !== -1) {
                    rfq.suppliers.splice(index, 1);
                }
            }

            // Save the updated RFQ to the database
            const updatedRFQ = await rfq.save();

            logger.info("DirectoryRfqController.addSuppliersToRfq - Success");

            // Respond with success message
            res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: "Suppliers deleted from RFQ",
                payload: updatedRFQ
            });
        } catch (error) {
            logger.error("DirectoryRfqController.addSuppliersToRfq - Error", error);
            res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: "Failed to delete suppliers from RFQ"
            });
        }
    }

    async inviteAllVendorsToRfq(req, res) {
        try {
            logger.info("DirectoryRfqController.inviteVendorsToRfq", req.body);

            const { rfqId } = req.body;

            const rfq = await RFQ.findOne({ rfqId });

            if (!rfq) {
                logger.error("RFQ not found");
                return res.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
                    error: true,
                    message: "RFQ not found"
                });
            }

            // Call the sendRFQMail function from helper.js with basicRecipients and premiumRecipients
            const respData = await RFQMailer.sendRFQMailToSupplier(rfq);

            logger.info("DirectoryRfqController.inviteVendorsToRfq- respData from MAILER:", respData);

            // If the email was sent successfully, update the rfq status and supplier state
            let updatedRfq;
            if (!respData.error) {
                rfq.status = "OPEN";
                rfq.suppliers.forEach(supplier => {
                    supplier.state = "INVITED";
                });
                // Save the updated rfq
                updatedRfq = await rfq.save({ new: true });

                // Adding the RFQ id in the supplier leads collection for leads  
                await updateSupplierLeads(updatedRfq);

                // Increasing the count of the contracts Sent in the vendors

                const toUpdate = "contractsSent";
                try {
                    const updateContractsAwardedResp = await Publisher.updateContractsAwarded(updatedRfq.suppliers, updatedRfq.entityId, toUpdate);
                    console.log("updateContractsAwardedResp", updateContractsAwardedResp);
                } catch (error) {
                    // Log the error
                    logger.error("Error updating contracts awarded:", error);
                    // Continue with the response without modifying it
                }


            }

            if (respData.email) {
                var invalidEmailAddresses = respData.email.reduce((acc, item) => {
                    if (typeof item === 'string') {
                        const emailRegex = /Illegal email address '([^']+)'/;
                        const match = item.match(emailRegex);
                        if (match) {
                            acc.push(match[1]);
                        }
                    }
                    return acc;
                }, []);

            }


            // Respond with the appropriate message or data
            res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: respData?.message,
                invalidEmailAddresses: invalidEmailAddresses,
                whatsAppInviteStatus: respData.whatsAppInviteStatus ? respData.whatsAppInviteStatus : false,
                rfq: updatedRfq
            });
        } catch (error) {
            logger.error("Error sending RFQ invitation email:", error);
            res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: "Failed to send RFQ invitation email"
            });
        }
    }


    async inviteSelectedVendorsToRfq(req, res) {
        try {
            logger.info("DirectoryRfqController.inviteVendorsToRfq", req.body);
            const { rfqId, supplierIds } = req.body;
            const rfq = await RFQ.findOne({ rfqId });
            if (!rfq) {
                logger.error("RFQ not found");
                return res.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
                    error: true,
                    message: "RFQ not found"
                });
            }
            const invitedSuppliers = rfq.suppliers.filter((supplier) =>
                supplierIds.includes(supplier.supplierId)
            );
            if (invitedSuppliers.length === 0) {
                logger.error("No valid supplier IDs provided");
                return res.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
                    error: true,
                    message: "No valid supplier IDs provided"
                });
            }

            if (rfq.projectId) {
                try {
                    var projectDetails = await entityProjects.findById({ _id: rfq.projectId }, { name: 1, location: 1, engineerDetails: 1 });
                } catch (error) {
                    console.error("Error fetching project details:", error);
                }
            }

            // Update `invitedSuppliers` property within `rfq`:
            const finalRfq = { ...rfq.toObject() };
            finalRfq.suppliers = invitedSuppliers;
            finalRfq.projectDetails = projectDetails;

            // Call the sendRFQMail function from helper.js with basicRecipients and premiumRecipients
            const respData = await RFQMailer.sendRFQMailToSupplier(finalRfq);

            logger.info("DirectoryRfqController.inviteVendorsToRfq- respData from MAILER:", respData);

            // If the email was sent successfully, update the rfq status and supplier state
            let updatedRfq;
            if (!respData.error) {
                // rfq.status = "OPEN";
                rfq.suppliers.forEach((supplier) => {
                    if (supplierIds.includes(supplier.supplierId)) {
                        supplier.state = "INVITED";
                    }
                });
                updatedRfq = await rfq.save({ new: true });
                const allSuppliersInvited = updatedRfq.suppliers.every((supplier) => {
                    return supplier.state === "INVITED";
                });
                // Update RFQ status to "OPEN" if all suppliers are invited
                if (allSuppliersInvited) {
                    updatedRfq.status = "OPEN";
                    // Save the RFQ with updated status
                    await updatedRfq.save({ new: true });
                }
                // Adding the RFQ id in the supplier leads collection for leads  
                await updateSupplierLeads(finalRfq);
                // Increasing the count of the contracts Sent in the vendors
                const toUpdate = "contractsSent";
                try {
                    const updateContractsAwardedResp = await Publisher.updateContractsAwarded(finalRfq.suppliers, updatedRfq.entityId, toUpdate);
                    console.log("updateContractsAwardedResp", updateContractsAwardedResp);
                } catch (error) {
                    // Log the error
                    logger.error("Error updating contracts awarded:", error);
                    // Continue with the response without modifying it
                }
            }

            if (respData.email) {
                var invalidEmailAddresses = respData.email.reduce((acc, item) => {
                    if (typeof item === 'string') {
                        const emailRegex = /Illegal email address '([^']+)'/;
                        const match = item.match(emailRegex);
                        if (match) {
                            acc.push(match[1]);
                        }
                    }
                    return acc;
                }, []);

            }

            // Respond with the appropriate message or data
            res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: respData?.message,
                invalidEmailAddresses: invalidEmailAddresses,
                whatsAppInviteStatus: respData.whatsAppInviteStatus ? respData.whatsAppInviteStatus : false,
                rfq: updatedRfq
            });
        } catch (error) {
            logger.error("Error sending RFQ invitation email:", error);
            res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: "Failed to send RFQ invitation email"
            });
        }
    }


    // async getEntityRfqs(req, res) {
    //     try {
    //         logger.info("DirectoryRfqController.getEntityRfqs", req.query);

    //         const { entityId, userId } = req.query;
    //         const page = req.query.page ? parseInt(req.query.page) : 1;
    //         const limit = 100; // Number of RFQs per page
    //         const skip = (page - 1) * limit;

    //         const [rfqs, totalCount, statusWiseCounts] = await Promise.all([
    //             RFQ.find({ entityId: entityId, requesterId: userId, status: { $ne: "TRASHED" } })
    //                 .sort({ createdAt: -1 })
    //                 .skip(skip)
    //                 .limit(limit)
    //                 .exec(),

    //             // Count total documents without any filtering:
    //             RFQ.countDocuments({ entityId: entityId, requesterId: userId, status: { $ne: "TRASHED" } }).exec(),

    //             // Use aggregation to get status-wise counts:
    //             RFQ.aggregate([
    //                 { $match: { entityId: entityId, requesterId: userId } },
    //                 {
    //                     $group: {
    //                         _id: "$status",
    //                         count: { $sum: 1 }
    //                     }
    //                 }
    //             ]).exec() // Don't forget to include .exec() for execution
    //         ]);

    //         const totalPages = Math.ceil(totalCount / limit);

    //         return res.status(STATUS_CODE.SERVER_SUCCESS).json({
    //             error: false,
    //             message: STATUS_CODE.RFQ_FETCHED_SUCCESS,
    //             rfqs: rfqs,
    //             totalCount: totalCount,
    //             statusWiseCounts: statusWiseCounts,
    //             currentPage: page,
    //             totalPages: totalPages === 0 ? 1 : totalPages
    //         });

    //     } catch (error) {
    //         logger.error("DirectoryRfqController.getEntityRfqs Error", error);
    //         res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
    //             error: true,
    //             message: STATUS_CODE.RFQ_FETCHED_FAILED
    //         })

    //     }
    // }

    async getEntityRfqs(req, res) {
        try {
            logger.info("DirectoryRfqController.getEntityRfqs", req.body);

            const { entityId, userIds } = req.body;
            const page = req.body.page ? parseInt(req.body.page) : 1;
            const limit = 100;
            const skip = (page - 1) * limit;

            const [rfqs, totalCount, statusWiseCounts] = await Promise.all([
                RFQ.find({ entityId: entityId, requesterId: { $in: userIds }, status: { $ne: "DELETED" }, isDeleted: false })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .exec(),

                RFQ.countDocuments({ entityId: entityId, requesterId: { $in: userIds }, status: { $ne: "DELETED" }, isDeleted: false }).exec(),

                RFQ.aggregate([
                    { $match: { entityId: entityId, requesterId: { $in: userIds }, isDeleted: false } },
                    {
                        $group: {
                            _id: "$status",
                            count: { $sum: 1 }
                        }
                    }
                ]).exec()
            ]);

            const totalPages = Math.ceil(totalCount / limit);

            return res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: STATUS_CODE.RFQ_FETCHED_SUCCESS,
                rfqs: rfqs,
                totalCount: totalCount,
                statusWiseCounts: statusWiseCounts,
                currentPage: page,
                totalPages: totalPages === 0 ? 1 : totalPages
            });

        } catch (error) {
            logger.error("DirectoryRfqController.getEntityRfqs Error", error);
            res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: STATUS_CODE.RFQ_FETCHED_FAILED
            })

        }
    }


    async getEntityRfqsWithStatus(req, res) {
        try {
            logger.info("DirectoryRfqController.getEntityRfqs", req.body);

            const { entityId, userIds, status } = req.body;

            const page = req.body.page ? parseInt(req.body.page) : 1;
            const limit = 100; // Number of RFQs per page
            const skip = (page - 1) * limit;

            const query = { entityId: entityId, requesterId: { $in: userIds }, isDeleted: false, status: status };
            // if (status) {
            //     query.status = { $ne: "DELETED", $eq: status };
            // } else {
            //     query.status = { $ne: "DELETED" };
            // }

            const [rfqs, totalCount, statusWiseCounts] = await Promise.all([
                RFQ.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .exec(),

                // Count total documents without any filtering:
                RFQ.countDocuments({ entityId: entityId, requesterId: { $in: userIds }, status: { $ne: "DELETED" }, isDeleted: false }).exec(),

                // Use aggregation to get status-wise counts:
                RFQ.aggregate([
                    { $match: { entityId: entityId, requesterId: { $in: userIds }, isDeleted: false } },
                    {
                        $group: {
                            _id: "$status",
                            count: { $sum: 1 }
                        }
                    }
                ]).exec() // Don't forget to include .exec() for execution
            ]);

            const totalPages = Math.ceil(totalCount / limit);

            return res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: STATUS_CODE.RFQ_FETCHED_SUCCESS,
                rfqs: rfqs,
                totalCount: totalCount,
                statusWiseCounts: statusWiseCounts,
                currentPage: page,
                totalPages: totalPages === 0 ? 1 : totalPages
            });

        } catch (error) {
            logger.error("DirectoryRfqController.getEntityRfqs Error", error);
            res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: STATUS_CODE.RFQ_FETCHED_FAILED
            })

        }
    }

    async getEntityRfq(req, res) {
        try {
            logger.info("DirectoryRfqController.getEntityRfqs", req.query);

            const { entityId, rfqId } = req.query;

            var rfq = await RFQ.findOne({ entityId, rfqId });

            let finalRfq;

            if (rfq.projectId) {
                try {
                    var projectDetails = await entityProjects.findById({ _id: rfq.projectId }, { name: 1, location: 1, engineerDetails: 1 });
                    finalRfq = {
                        ...rfq.toObject(),
                        projectName: projectDetails.name,
                        location: projectDetails.location.city + "," + projectDetails.location.state,
                        engineerDetails: projectDetails.engineerDetails
                    };
                } catch (error) {
                    console.error("Error fetching project details:", error);
                }
            }

            return res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: STATUS_CODE.RFQ_FETCHED_SUCCESS,
                rfq: finalRfq || rfq.toObject(),
            });

        } catch (error) {
            logger.error("DirectoryRfqController.getEntityRfqs Error", error);
            res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: STATUS_CODE.RFQ_FETCHED_FAILED
            });
        }
    }


    async closeRfq(req, res) {
        try {
            logger.info("DirectoryRfqController.closeRfq", req.body);

            const { rfqId, status, rfqAwarded } = req.body;

            const updateQuery = { status: status };
            if (rfqAwarded) {
                updateQuery.rfqAwarded = rfqAwarded;
            }

            const updatedRfq = await RFQ.findOneAndUpdate(
                { rfqId: rfqId },
                { $set: updateQuery },
                { new: true }
            );

            let contractsAwardedError = false;

            if (updatedRfq && rfqAwarded) {
                try {
                    const toUpdate = "contractsAwarded";
                    const updateContractsAwardedResp = await Publisher.updateContractsAwarded(updatedRfq.rfqAwarded, updatedRfq.entityId, toUpdate);
                    console.log("updateContractsAwardedResp", updateContractsAwardedResp);
                } catch (error) {
                    contractsAwardedError = true;
                }
            }

            if (updatedRfq) {
                if (contractsAwardedError) {
                    return res.status(STATUS_CODE.SERVER_SUCCESS).json({
                        error: false,
                        message: "RFQ closed successfully but failed to award to vendors",
                        rfq: updatedRfq
                    });
                } else {
                    return res.status(STATUS_CODE.SERVER_SUCCESS).json({
                        error: false,
                        message: STATUS_CODE.RFQ_CLOSE_SUCCESS,
                        rfq: updatedRfq
                    });
                }
            } else {
                return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
                    error: true,
                    message: STATUS_CODE.RFQ_NOT_FOUND_WITH_RFQ_ID
                });
            }
        } catch (error) {
            logger.error("DirectoryRfqController.closeRfq- error", error);
            res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: STATUS_CODE.RFQ_CLOSE_FAILED
            });
        }
    }



    async updateRFQ(req, resp) {
        logger.info("RFQsController.updateRFQ()", req.body);

        try {
            const payload = req.body;
            const updateFields = {
                name: payload.name,
                estimatedValue: payload.estimatedValue,
                rfqType: payload.rfqType,
                validityDate: payload.validityDate,
                newCcEmails: payload.newCcEmails,
                projectName: payload.projectName,
                location: payload.location,
                creditPeriod: payload.creditPeriod,
                description: payload.description,
                selectedFilesBase: payload.selectedFilesBase,
                projectId: payload.projectId,
                indentId: payload.indentId
            };

            // Removing any fields with undefined values from the updateFields object
            Object.keys(updateFields).forEach(key => updateFields[key] === undefined && delete updateFields[key]);

            // If projectId is provided, fetch project details and update projectName and location
            if (payload.projectId) {
                try {
                    const projectDetails = await entityProjects.findById(
                        { _id: payload.projectId },
                        { name: 1, location: 1 }
                    );

                    if (projectDetails) {
                        updateFields.projectName = projectDetails.name;
                        updateFields.location = `${projectDetails.location.city}, ${projectDetails.location.state}`;
                    }
                } catch (error) {
                    logger.error("Error fetching project details:", error);
                    return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                        error: true,
                        message: "Error fetching project details",
                    });
                }
            }

            // Find and update the RFQ with only the fields present in the updateFields object
            const updatedRFQ = await RFQ.findOneAndUpdate(
                { rfqId: payload.rfqId },
                { $set: updateFields },
                { new: true }
            );

            if (!updatedRFQ) {
                return resp.status(STATUS_CODE.SERVER_NOT_FOUND).json({
                    error: true,
                    message: STATUS_CODE.RFQ_UPDATE_FAILED,
                });
            }

            return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: STATUS_CODE.RFQ_UPDATE_SUCCESS,
                payload: updatedRFQ
            });
        } catch (err) {
            logger.error(err.message);
            return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: STATUS_CODE.RFQ_UPDATE_FAILED,
            });
        }
    }


    async reInviteVendor(req, resp) {
        try {
            logger.info("DirectoryRfqController.reInviteVendor", req.body);
            const { rfqId, supplierId, additionalNote } = req.body;

            const rfq = await RFQ.findOne({ rfqId });

            if (!rfq) {
                return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
                    message: STATUS_CODE.RFQ_FETCHE_FAILED,
                });
            }

            const supplierToReInvite = rfq.suppliers.filter((supplier) => supplier.supplierId == supplierId);

            let basicRecipients = [];
            let premiumRecipients = [];
            let cdRecipients = [];

            supplierToReInvite.forEach((supplier) => {
                if (!supplier.isNeevayVendor) {
                    cdRecipients = cdRecipients.concat(additionalNote.emails);
                } else if (supplier.isPremium) {
                    premiumRecipients = premiumRecipients.concat(additionalNote.emails);
                } else {
                    basicRecipients = basicRecipients.concat(additionalNote.emails);
                }
            });

            const finalRfq = { ...rfq.toObject() };
            finalRfq.suppliers = supplierToReInvite;
            finalRfq.requesterName = additionalNote.senderName;
            finalRfq.requestedBy = additionalNote.sentByEmail;
            finalRfq.newCcEmails = additionalNote.ccEmails;

            const lastSupplierIndex = finalRfq.suppliers.length - 1;
            finalRfq.suppliers[lastSupplierIndex].noteDescriptions.push(additionalNote);

            const respData = await RFQMailer.ReInviteSupplierToRfq(basicRecipients, premiumRecipients, cdRecipients, finalRfq);

            logger.info("DirectoryRfqController.reInviteVendor respData from mailer: ", respData);

            if (respData == null || respData.error) {
                return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                    error: false,
                    message: "Failed to resend requirement",
                });
            }

            const currentDate = new Date();
            const formattedDateIST = new Date(currentDate);

            const selectedSupplier = rfq.suppliers.find((supplier) => supplier.supplierId === supplierId);

            if (selectedSupplier) {
                selectedSupplier.resendCount += 1;
                selectedSupplier.reminderDate = formattedDateIST;
                // selectedSupplier.noteDescriptions.push(additionalNote);
            }

            await rfq.save();

            const updatedRfq = await RFQ.findOne({ rfqId });

            return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
                payload: {
                    error: false,
                    message: "The requirement has been resent successfully to the vendor",
                    updatedRfq,
                },
            });
        } catch (error) {
            logger.error("Error in reInviteVendor:", error.message);
            return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: "Failed to reinvite vendor",
            });
        }
    }


    /**
     * Resends the RFQ to multiple vendors.
     *
     * @param {object} req - The request object
     * @param {object} resp - The response object
    */
    async reInviteMultipleVendor(req, resp) {
        try {
            logger.info("DirectoryRfqController.reInviteVendor", req.body);
            const { rfqId, suppliers, additionalNote } = req.body;

            const rfq = await RFQ.findOne({ rfqId });

            if (!rfq) {
                return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
                    message: STATUS_CODE.RFQ_FETCHE_FAILED,
                });
            }

            const currentDate = new Date();
            const formattedDateIST = new Date(currentDate);

            const suppliersToReInvite = rfq.suppliers.filter((supplier) => suppliers.some((s) => s.supplierId === supplier.supplierId));


            if (suppliersToReInvite.length === 0) {
                return resp.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
                    message: "No valid supplier IDs provided",
                });
            }

            const basicRecipients = [];
            const premiumRecipients = [];
            const cdRecipients = [];

            suppliersToReInvite.forEach((supplier) => {
                const matchingSupplier = suppliers.find((s) => s.supplierId === supplier.supplierId);
                const emails = matchingSupplier ? matchingSupplier.emails : [];
                if (!supplier.isNeevayVendor) {
                    cdRecipients.push(...emails);
                } else if (supplier.isPremium) {
                    premiumRecipients.push(...emails);
                } else {
                    basicRecipients.push(...emails);
                }
                supplier.noteDescriptions.push({ ...additionalNote, emails });
                supplier.resendCount += 1;
                supplier.reminderDate = formattedDateIST;
            });

            const finalRfq = {
                ...rfq.toObject(),
                suppliers: suppliersToReInvite,
                requesterName: additionalNote.senderName,
                requestedBy: additionalNote.sentByEmail,
                newCcEmails: additionalNote.ccEmails,
            };

            console.log(finalRfq)

            const respData = await RFQMailer.ReInviteSupplierToRfq(basicRecipients, premiumRecipients, cdRecipients, finalRfq);

            logger.info("DirectoryRfqController.reInviteVendor respData from mailer: ", respData);

            if (!respData || respData.error) {
                return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                    error: false,
                    message: "Failed to resend requirement",
                });
            }

            const updatedRfq = await rfq.save({ new: true });

            return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
                payload: {
                    error: false,
                    message: "The requirement has been resent successfully to the vendors",
                    updatedRfq,
                },
            });
        } catch (error) {
            logger.error("Error in reInviteVendor:", error.message);
            return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: "Failed to reinvite vendors",
            });
        }
    }

    async addEmailsToSupplier(req, resp) {
        try {
            const { entityId, rfqId, supplierId, emails } = req.body;
            logger.info("DirectoryRfqController.addEmailsToSupplier", req.body);

            const rfq = await RFQ.findOne({ entityId: entityId, rfqId: rfqId });

            if (!rfq) {
                return resp.status(STATUS_CODE.SERVER_NOT_FOUND).json({
                    error: true,
                    message: "RFQ not found"
                });
            }

            const supplierIndex = rfq.suppliers.findIndex(supplier => supplier.supplierId === supplierId);
            if (supplierIndex === -1) {
                return resp.status(STATUS_CODE.SERVER_NOT_FOUND).json({
                    error: true,
                    message: "Supplier not found in the RFQ"
                });
            }

            const supplier = rfq.suppliers[supplierIndex];
            const existingEmails = new Set(supplier.contactDetails.map(contact => contact.email));
            const newEmails = emails.filter(email => !existingEmails.has(email));

            if (newEmails.length === 0) {
                return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
                    error: false,
                    message: "No new emails added",
                    updatedRfq: rfq
                });
            }

            supplier.contactDetails.push(...newEmails.map(email => ({ email })));
            await rfq.save();

            return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: STATUS_CODE.VENDOR_EMAILS_ADD_SUCCESS,
                updatedRfq: rfq
            });
        } catch (error) {
            logger.error("ERROR - DirectoryRfqController.addEmailsToSupplier", error.message);
            return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: STATUS_CODE.VENDOR_EMAILS_ADD_FAILED
            });
        }
    }


    /*
    quotation details old function which updates rank only and not position

     async rfqQuotationDetails(req, res) {
        try {
            logger.info("DirectoryRfqController.rfqQuotationDetails()", req.body);
            const { rfqId, supplierId, quotationDetails } = req.body;
    
            const rfq = await RFQ.findOne({ rfqId: rfqId });
    
            if (!rfq) {
                return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
                    error: true,
                    message: `RFQ not found with the rfqId ${rfqId}`
                });
            }
    
            const supplierIndex = rfq.suppliers.findIndex(supplier => supplier.supplierId === supplierId);
    
            if (supplierIndex === -1) {
                return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
                    error: true,
                    message: `Supplier not found with the supplierId ${supplierId}`
                });
            }
    
            rfq.suppliers[supplierIndex].quotationDetails = quotationDetails;
    
            if (quotationDetails.amount) {
                const sortedSuppliers = rfq.suppliers
                    .filter(supplier => supplier.quotationDetails.amount) 
                    .sort((a, b) => parseFloat(a.quotationDetails.amount) - parseFloat(b.quotationDetails.amount));
    
                sortedSuppliers.forEach((supplier, index) => {
                    const prevSupplier = sortedSuppliers[index - 1];
                    if (prevSupplier && prevSupplier.quotationDetails.amount === supplier.quotationDetails.amount) {
                        supplier.quotationDetails.rank = prevSupplier.quotationDetails.rank;
                    } else {
                        supplier.quotationDetails.rank = `L${index + 1}`;
                    }
                });
            }
    
            const updatedRfq = await rfq.save({new:true});
    
            return res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: `RFQ quotation details updated successfully`,
                updatedRfq
            });
        } catch (error) {
            logger.error("Error updating rfqQuotationDetails:", error.message);
            return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: `Failed to update the rfqQuotationDetails`
            });
        }
    }
    */

    async rfqQuotationDetails(req, res) {
        try {
            logger.info("DirectoryRfqController.rfqQuotationDetails()", req.body);
            const { rfqId, supplierId, quotationDetails } = req.body;

            const quotationDetailsToAdd = Object.entries(quotationDetails)
                .filter(([key, value]) => value !== undefined && key !== 'rank')
                .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

            const rfq = await RFQ.findOne({ rfqId: rfqId });

            if (!rfq) {
                return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
                    error: true,
                    message: `RFQ not found with the rfqId ${rfqId}`,
                });
            }

            const supplierIndex = rfq.suppliers.findIndex(
                (supplier) => supplier.supplierId === supplierId
            );

            if (supplierIndex === -1) {
                return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
                    error: true,
                    message: `Supplier not found with the supplierId ${supplierId}`,
                });
            }

            rfq.suppliers[supplierIndex].quotationDetails = quotationDetailsToAdd;

            rfq.suppliers.sort((a, b) => {
                if (a.quotationDetails && a.quotationDetails.amount && a.quotationDetails.alignedToTerms &&
                    b.quotationDetails && b.quotationDetails.amount && b.quotationDetails.alignedToTerms) {
                    return parseFloat(a.quotationDetails.amount) - parseFloat(b.quotationDetails.amount);
                } else if (a.quotationDetails && a.quotationDetails.amount && a.quotationDetails.alignedToTerms) {
                    return -1;
                } else {
                    return 1;
                }
            });

            let currentRank = 1;
            let prevAmount = Infinity;
            let prevRank = null;

            rfq.suppliers.forEach((supplier) => {
                const amount = parseFloat(supplier.quotationDetails?.amount);
                const alignedToTerms = supplier.quotationDetails?.alignedToTerms;

                if (amount && alignedToTerms) {
                    if (amount !== prevAmount) {
                        supplier.quotationDetails.rank = `L${currentRank}`;
                        prevRank = `L${currentRank}`;
                        currentRank++;
                    } else {
                        supplier.quotationDetails.rank = prevRank;
                    }

                    prevAmount = amount;
                }
            });

            const savedRfq = await rfq.save({ new: true });

            return res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: `RFQ quotation details updated successfully`,
                rfq: savedRfq,
            });
        } catch (error) {
            logger.error("Error updating rfqQuotationDetails:", error.message);
            return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: `Failed to update the rfqQuotationDetails`,
            });
        }
    }

    async rfqClosingDetails(req, res) {
        try {
            logger.info("DirectoryRfqController.rfqClosingDetails()", req.body);
            const { rfqId, supplierClosingDetails, entityId } = req.body;

            if (!rfqId || !entityId) {
                return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                    error: true,
                    message: "RFQ ID and Entity ID are required.",
                });
            }

            const rfq = await RFQ.findOne({ rfqId, entityId });
            const userId = req.headers['userid'];
            const userName = req.headers['name'];

            if (!rfq) {
                return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
                    error: true,
                    message: `RFQ not found with the rfqId ${rfqId}`,
                });
            }

            // Check for duplicate PO numbers
            const existingRfqDocs = await RFQ.find({ entityId, rfqId: { $ne: rfqId } }, { 'suppliers.closingDetails.poNumber': 1 });

            const existingPoNumbers = existingRfqDocs.flatMap(doc =>
                doc.suppliers.flatMap(supplier =>
                    (supplier.closingDetails || []).map(closingDetail => closingDetail.poNumber)
                )
            ).filter(Boolean);

            const newPoNumbers = supplierClosingDetails.flatMap(detail =>
                detail.closingDetails.map(closingDetail => closingDetail.poNumber)
            );

            const duplicatePoNumbers = newPoNumbers.filter(poNumber => existingPoNumbers.includes(poNumber));

            if (duplicatePoNumbers.length > 0) {
                return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
                    error: true,
                    message: `PO number(s) already exist: ${duplicatePoNumbers.join(', ')}`,
                });
            }

            rfq.suppliers.forEach(supplier => {
                supplier.closingDetails = [];
                supplier.isAwarded = false;
            });

            // Update supplier closing details
            let foundAllSuppliers = true;
            for (const supplierDetail of supplierClosingDetails) {
                const supplierIndex = rfq.suppliers.findIndex(supplier => supplier.supplierId === supplierDetail.supplierId);

                if (supplierIndex !== -1) {
                    // for (const closingDetail of supplierDetail.closingDetails) {
                    // const supplierClosingDetail = {
                    //     amount: closingDetail.amount,
                    //     poNumber: closingDetail.poNumber,
                    //     poDate: closingDetail.poDate,
                    //     remark: closingDetail.remark || ""
                    // };

                    // rfq.suppliers[supplierIndex].closingDetails.push(supplierClosingDetail);
                    rfq.suppliers[supplierIndex].closingDetails = supplierDetail.closingDetails;
                    rfq.suppliers[supplierIndex].isAwarded = true;
                    // }
                } else {
                    foundAllSuppliers = false;
                    break;
                }
            }

            if (!foundAllSuppliers) {
                return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
                    error: true,
                    message: `Not all suppliers found in the RFQ`,
                });
            }

            
            rfq.rfqClosingDetails = {
                userId,
                name: userName,
                date: new Date()
            };
            
            const statusLogs = {
                changedStatusFrom: rfq?.status,
                changedStatusTo: "CLOSED",
                userId: userId,
                name: userName
            }
            
            rfq.statusLogs.push(statusLogs);
            rfq.status = "CLOSED";
            const updatedRfq = await rfq.save({new:true});

            logger.info("Sending email to RFQ awardee with RFQ details:", rfq);
            
            const emailToRfqAwardee = await sendEmailToRfqAwardee(rfq)
            return res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: `RFQ closing details updated successfully`,
                updatedRfq,
            });
        } catch (error) {
            logger.error("Error updating rfqClosingDetails:", error.message);
            return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: `Failed to update the RFQ closing details`,
            });
        }
    }



    async closeRfqWithoutVendors(req, res) {
        try {
            logger.info("DirectoryRfqController.closeRfqWithoutVendors()", req.body);
            const rfqId = req.body.rfqId;
            const userId = req.headers['userid'];
            const name = req.headers['name'];

            const rfq = await RFQ.findOne({ rfqId });

            if (!rfq) {
                return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
                    error: true,
                    message: `RFQ not found with the rfqId ${rfqId}`
                });
            }

            const statusLogs = {
                changedStatusFrom: rfq?.status,
                changedStatusTo: "CLOSED",
                userId: userId,
                name: name
            }

            rfq.statusLogs.push(statusLogs);

            rfq.status = "CLOSED";
            rfq.rfqClosingDetails = {
                userId: userId,
                name: name,
                date: new Date()
            };

            rfq.suppliers.forEach(supplier => {
                supplier.closingDetails = [];
                supplier.isAwarded = false;
            });

            const updatedRfq = await rfq.save({ new: true });

            return res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: `RFQ closed successfully`,
                updatedRfq
            });
        } catch (error) {
            logger.error("Error closing RFQ without vendors:", error.message);
            return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: `Failed to close the RFQ without vendors`
            });
        }
    }


    async searchInRfqs(req, resp) {
        logger.info("RFQsController.getAllRFQs()", req.body);
        try {
            const { entityId, status, userIds, startDate, endDate } = req.body;

            if (!entityId) {
                return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                    error: true,
                    message: "Entity ID is required.",
                });
            }

            let query = {
                isDeleted: false,
                entityId: entityId,
                requesterId: { $in: userIds },
            };

            let dateFilter = {};
    
            if (startDate && endDate) {
                const startDateObj = new Date(startDate);
                const endDateObj = new Date(endDate);
                
                endDateObj.setHours(23, 59, 59, 999);
    
                dateFilter = { $gte: startDateObj, $lte: endDateObj };
            } else if (startDate) {
                const startDateObj = new Date(startDate);
                dateFilter = { $gte: startDateObj };
            } else if (endDate) {
                const endDateObj = new Date(endDate);
                endDateObj.setHours(23, 59, 59, 999);
                dateFilter = { $lte: endDateObj };
            }

            if(startDate || endDate){
                query.createdAt = dateFilter;
            }

            if (status && status !== "") {
                query.status = { $ne: "DELETED", $eq: status };
            } else {
                query.status = { $ne: "DELETED" };
            }

            if (req.body.searchParam) {
                const searchParam = req.body.searchParam;
                const searchRegex = new RegExp(searchParam, 'i');

                const poNumberQuery = {
                    $or: [
                        { description: { $regex: searchRegex } },
                        { name: { $regex: searchRegex } },
                        { 'suppliers.closingDetails.poNumber': { $regex: searchRegex } },
                        { 'suppliers.businessName': { $regex: searchRegex } },
                        { indentId: { $regex: searchRegex } },
                        ...(isNaN(searchParam) ? [] : [{ rfqId: parseInt(searchParam) }]),
                    ]
                };

                query = {
                    ...query,
                    ...poNumberQuery
                };
            }

            const page = req.query.page ? parseInt(req.query.page) : 1;
            const pageSize = 100;
            const skip = (page - 1) * pageSize;

            const [rfqs, totalCount, statusWiseCounts ] = await Promise.all([
                RFQ.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(pageSize)
                    .exec(),
                RFQ.countDocuments(query).exec(),

                RFQ.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: "$status",
                            count: { $sum: 1 }
                        }
                    }
                ]).exec()

            ]);

            logger.info("RFQsController.getAllRFQs() rfqs[]");
            const totalPages = Math.ceil(totalCount / pageSize);
            return resp.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: STATUS_CODE.RFQ_FETCHED_SUCCESS,
                payload: {
                    rfqs,
                    totalCount,
                    currentPage: page,
                    totalPages: totalPages === 0 ? 1 : totalPages,
                    statusWiseCounts: statusWiseCounts
                },
            });
        } catch (err) {
            logger.error(err.message);
            return resp.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: STATUS_CODE.RFQ_FETCHE_FAILED,
            });
        }
    }



    async trashRfq(req, res) {
        try {
            logger.info("RFQsController.trashRfq()", req.query);
            const { rfqId, entityId, currentStatus } = req.query;
            const { userIds, actionBy,startDate, endDate } = req.body;
            const page = req.query.page ? parseInt(req.query.page) : 1;
            const limit = 100;
            const skip = (page - 1) * limit;

            const rfq = await RFQ.findOne({ rfqId: rfqId, requesterId: { $in: userIds }, isDeleted: false });

            if (!rfq) {
                return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
                    error: true,
                    message: "RFQ not found",
                });
            }

            const previousStatus = rfq.status;

            rfq.previousStatus = previousStatus;

            rfq.status = "DELETED";

            const statusLogs = {
                changedStatusFrom: previousStatus,
                changedStatusTo: "DELETED",
                userId: actionBy?.userId,
                name: actionBy?.name
            }

            rfq.statusLogs.push(statusLogs);

            await rfq.save();

            let dateFilter = {};
    
            if (startDate && endDate) {
                const startDateObj = new Date(startDate);
                const endDateObj = new Date(endDate);
                
                endDateObj.setHours(23, 59, 59, 999);
    
                dateFilter = { $gte: startDateObj, $lte: endDateObj };
            } else if (startDate) {
                const startDateObj = new Date(startDate);
                dateFilter = { $gte: startDateObj };
            } else if (endDate) {
                const endDateObj = new Date(endDate);
                endDateObj.setHours(23, 59, 59, 999);
                dateFilter = { $lte: endDateObj };
            }

            let query = { entityId: entityId, requesterId: { $in: userIds }, isDeleted: false };

            if(startDate || endDate){
                query = { requesterId: { $in: userIds }, entityId: entityId, isDeleted: false, createdAt:dateFilter }
            } else{
                query = { requesterId: { $in: userIds }, entityId: entityId, isDeleted: false }
            }
             
            if (currentStatus) {
                query.status = { $ne: "DELETED", $eq: currentStatus };
            } else {
                query.status = { $ne: "DELETED" };
            }

            let secondQuery = { requesterId: { $in: userIds }, status:{$ne:"DELETED"}, entityId: entityId, isDeleted: false }

            if(startDate || endDate){
                secondQuery.createdAt = dateFilter
            }

            let thirdQuery = { requesterId: { $in: userIds }, entityId: entityId, isDeleted: false }

            if(startDate || endDate){
                thirdQuery.createdAt = dateFilter
            }

            const [rfqs, totalCount, statusWiseCounts] = await Promise.all([
                RFQ.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .exec(),

                RFQ.countDocuments(secondQuery).exec(),

                RFQ.aggregate([
                    { $match: thirdQuery },
                    {
                        $group: {
                            _id: "$status",
                            count: { $sum: 1 }
                        }
                    }
                ]).exec()
            ]);

            const totalPages = Math.ceil(totalCount / limit);

            return res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: "RFQ status changed to DELETED",
                previousStatus: previousStatus,
                rfqs: rfqs,
                totalCount: totalCount,
                statusWiseCounts: statusWiseCounts,
                currentPage: page,
                totalPages: totalPages === 0 ? 1 : totalPages
            });
        } catch (error) {
            logger.error(error.message);
            return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: STATUS_CODE.FAILED_RFQ_TRASHED,
            });
        }
    }

    async trashSingleRfq(req, res) {
        try {
            logger.info("RFQsController.trashRfq()", req.query);
            const { rfqId, userId } = req.query;
            const actionBy = req.body.actionBy;
            const rfq = await RFQ.findOne({ rfqId: rfqId, requesterId: userId });

            if (!rfq) {
                return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
                    error: true,
                    message: "RFQ not found",
                });
            }

            const previousStatus = rfq.status;

            rfq.previousStatus = previousStatus;

            rfq.status = "DELETED";

            const statusLogs = {
                changedStatusFrom: previousStatus,
                changedStatusTo: "DELETED",
                userId: actionBy?.userId,
                name: actionBy?.name
            }

            rfq.statusLogs.push(statusLogs);

            const updatedRfq = await rfq.save({ new: true });

            return res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: "RFQ status changed to DELETED",
                previousStatus: previousStatus,
                rfq: updatedRfq
            });
        } catch (error) {
            logger.error(error.message);
            return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: STATUS_CODE.FAILED_RFQ_TRASHED,
            });
        }
    }




    async restoreRfq(req, res) {
        try {
            logger.info("RFQsController.restoreRfq()", req.query);
            const { rfqId, entityId } = req.query;
            const { userIds, actionBy, startDate, endDate } = req.body;
            const page = req.query.page ? parseInt(req.query.page) : 1;
            const pageSize = 100;
            const skip = (page - 1) * pageSize;

            const rfq = await RFQ.findOne({ rfqId: rfqId, requesterId: { $in: userIds }, entityId: entityId, isDeleted: false });

            if (!rfq) {
                return res.status(STATUS_CODE.RFQ_NOT_FOUND_WITH_RFQ_ID).json({
                    error: true,
                    message: "RFQ not found",
                });
            }

            if (rfq.status !== "DELETED") {
                return res.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
                    error: true,
                    message: "RFQ is not in DELETED status",
                });
            }

            if (!rfq.previousStatus) {
                return res.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
                    error: true,
                    message: "Previous status is not available for this RFQ",
                });
            }

            rfq.status = rfq.previousStatus;
            const statusLogs = {
                changedStatusFrom: "DELETED",
                changedStatusTo: rfq.previousStatus,
                userId: actionBy?.userId,
                name: actionBy?.name
            }
            rfq.statusLogs.push(statusLogs)
            rfq.previousStatus = null;
            await rfq.save();

            let query = { requesterId: { $in: userIds }, status: "DELETED", entityId: entityId, isDeleted: false }

            let dateFilter = {};
    
            if (startDate && endDate) {
                const startDateObj = new Date(startDate);
                const endDateObj = new Date(endDate);
                
                endDateObj.setHours(23, 59, 59, 999);
    
                dateFilter = { $gte: startDateObj, $lte: endDateObj };
            } else if (startDate) {
                const startDateObj = new Date(startDate);
                dateFilter = { $gte: startDateObj };
            } else if (endDate) {
                const endDateObj = new Date(endDate);
                endDateObj.setHours(23, 59, 59, 999);
                dateFilter = { $lte: endDateObj };
            }

            if(startDate || endDate) {
                query.createdAt = dateFilter
            }

            let secondQuery = { requesterId: { $in: userIds }, status:{$ne:"DELETED"}, entityId: entityId, isDeleted: false }

            if(startDate || endDate){
                secondQuery.createdAt = dateFilter
            }

            let thirdQuery = { requesterId: { $in: userIds }, entityId: entityId, isDeleted: false }

            if(startDate || endDate){
                thirdQuery.createdAt = dateFilter
            }

            const [rfqs, totalCount, statusWiseCounts] = await Promise.all([
                RFQ.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(pageSize)
                    .exec(),

                RFQ.countDocuments(secondQuery).exec(),

                RFQ.aggregate([
                    { $match: thirdQuery },
                    {
                        $group: {
                            _id: "$status",
                            count: { $sum: 1 }
                        }
                    }
                ]).exec()
            ]);

            const totalPages = Math.ceil(totalCount / pageSize);

            return res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: "RFQ status restored",
                currentStatus: rfq.status,
                rfqs,
                totalCount,
                currentPage: page,
                totalPages: totalPages === 0 ? 1 : totalPages,
                statusWiseCounts: statusWiseCounts
            });
        } catch (error) {
            logger.error(error.message);
            return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: "Failed to restore RFQ status",
            });
        }
    }

    async deleteRfq(req, res) {
        try {
            logger.info("RFQsController.deleteRfq()", req.query);
            const { rfqId, entityId } = req.query;
            const { userIds, actionBy, startDate, endDate } = req.body;

            const statusLogs = {
                changedStatusFrom: "DELETED",
                changedStatusTo: "PERMANENT DELETED",
                userId: actionBy?.userId,
                name: actionBy?.name,
                date: new Date()
            };


            const updatedRfq = await RFQ.findOneAndUpdate(
                { rfqId: rfqId, entityId: entityId, requesterId: { $in: userIds } },
                {
                    $set: {
                        isDeleted: true,
                    },
                    $push: {
                        statusLogs: statusLogs
                    }
                },
                { new: true }
            );

            if (!updatedRfq) {
                return res.status(STATUS_CODE.RFQ_NOT_FOUND_WITH_RFQ_ID).json({
                    error: true,
                    message: `RFQ not found with ID: ${rfqId}`,
                });
            }

            const page = req.query.page ? parseInt(req.query.page) : 1;
            const pageSize = 100;
            const skip = (page - 1) * pageSize;

            let dateFilter = {};
    
            if (startDate && endDate) {
                const startDateObj = new Date(startDate);
                const endDateObj = new Date(endDate);
                
                endDateObj.setHours(23, 59, 59, 999);
    
                dateFilter = { $gte: startDateObj, $lte: endDateObj };
            } else if (startDate) {
                const startDateObj = new Date(startDate);
                dateFilter = { $gte: startDateObj };
            } else if (endDate) {
                const endDateObj = new Date(endDate);
                endDateObj.setHours(23, 59, 59, 999);
                dateFilter = { $lte: endDateObj };
            }

            let query;

            if(startDate || endDate){
                query = { requesterId: { $in: userIds }, status: "DELETED", entityId: entityId, isDeleted: false, createdAt:dateFilter }
            } else{
                query = { requesterId: { $in: userIds }, status: "DELETED", entityId: entityId, isDeleted: false }
            }

            let secondQuery = { requesterId: { $in: userIds }, status:{$ne:"DELETED"}, entityId: entityId, isDeleted: false }

            if(startDate || endDate){
                secondQuery.createdAt = dateFilter
            }

            let thirdQuery = { requesterId: { $in: userIds }, entityId: entityId, isDeleted: false }

            if(startDate || endDate){
                thirdQuery.createdAt = dateFilter
            }

            const [rfqs, totalCount, statusWiseCounts] = await Promise.all([
                RFQ.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(pageSize)
                    .exec(),

                RFQ.countDocuments(secondQuery).exec(),

                RFQ.aggregate([
                    { $match: thirdQuery},
                    {
                        $group: {
                            _id: "$status",
                            count: { $sum: 1 }
                        }
                    }
                ]).exec()
            ]);

            const totalPages = Math.ceil(totalCount / pageSize);

            return res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: "RFQ marked as deleted successfully",
                rfqs,
                totalCount,
                currentPage: page,
                totalPages: totalPages === 0 ? 1 : totalPages,
                statusWiseCounts: statusWiseCounts
            });
        } catch (error) {
            logger.error("Error marking RFQ as deleted:", error.message);
            return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: "Failed to mark RFQ as deleted",
            });
        }
    }


    async updateClosedRfq(req, res) {
        try {
            logger.info("RFQsController.updateClosingDetails()", req.body);

            const { rfqId, entityId, supplierUpdates } = req.body;

            if (!rfqId || !entityId || !supplierUpdates) {
                return res.status(STATUS_CODE.BAD_REQUEST).json({
                    error: true,
                    message: "RFQ ID, Entity ID, and supplier updates are required.",
                });
            }

            const rfq = await RFQ.findOne({ rfqId, entityId });
            const userId = req.headers['userid'];
            const userName = req.headers['name'];

            if (!rfq) {
                return res.status(STATUS_CODE.NOT_FOUND).json({
                    error: true,
                    message: `RFQ not found with ID: ${rfqId} and Entity ID: ${entityId}`,
                });
            }

            // Check for duplicate PO numbers, excluding the current RFQ
            const existingRfqDocs = await RFQ.find({ entityId, rfqId: { $ne: rfqId } }, { 'suppliers.closingDetails.poNumber': 1 });

            const existingPoNumbers = existingRfqDocs.flatMap(doc =>
                doc.suppliers.flatMap(supplier =>
                    (supplier.closingDetails || []).map(closingDetail => closingDetail.poNumber)
                )
            ).filter(Boolean);

            const newPoNumbers = supplierUpdates.flatMap(detail =>
                detail.closingDetails.map(closingDetail => closingDetail.poNumber)
            );

            const duplicatePoNumbers = newPoNumbers.filter(poNumber => existingPoNumbers.includes(poNumber));

            if (duplicatePoNumbers.length > 0) {
                return res.status(STATUS_CODE.CONFLICT).json({
                    error: true,
                    message: `PO number(s) already exist: ${duplicatePoNumbers.join(', ')}`,
                });
            }

            // Track suppliers that originally had closing details
            const originalSuppliersWithClosingDetails = rfq.suppliers.filter(supplier => supplier.closingDetails.length > 0).map(supplier => supplier.supplierId);

            // Update supplier closing details
            let foundAllSuppliers = true;
            const updatedSupplierIds = supplierUpdates.map(detail => detail.supplierId);

            for (const supplierDetail of supplierUpdates) {
                const supplierIndex = rfq.suppliers.findIndex(supplier => supplier.supplierId === supplierDetail.supplierId);

                if (supplierIndex !== -1) {
                    rfq.suppliers[supplierIndex].closingDetails = supplierDetail.closingDetails;
                    rfq.suppliers[supplierIndex].isAwarded = supplierDetail.closingDetails.length > 0;
                } else {
                    foundAllSuppliers = false;
                    break;
                }
            }

            if (!foundAllSuppliers) {
                return res.status(STATUS_CODE.NOT_FOUND).json({
                    error: true,
                    message: `Not all suppliers found in the RFQ`,
                });
            }

            // Remove closing details and set isAwarded to false for suppliers not in the update list
            for (const supplierId of originalSuppliersWithClosingDetails) {
                if (!updatedSupplierIds.includes(supplierId)) {
                    const supplierIndex = rfq.suppliers.findIndex(supplier => supplier.supplierId === supplierId);
                    if (supplierIndex !== -1) {
                        rfq.suppliers[supplierIndex].closingDetails = [];
                        rfq.suppliers[supplierIndex].isAwarded = false;
                    }
                }
            }

            rfq.rfqClosingDetails = {
                userId,
                name: userName,
                date: new Date()
            };

            const statusLogs = {
                changedStatusFrom: rfq?.status,
                changedStatusTo: "CLOSED",
                userId: userId,
                name: userName,
                date: new Date()
            };

            rfq.statusLogs.push(statusLogs);
            const updatedRfq = await rfq.save();

            return res.status(STATUS_CODE.SUCCESS).json({
                error: false,
                message: `RFQ closing details updated successfully`,
                updatedRfq,
            });
        } catch (error) {
            logger.error("RFQsController.updateClosingDetails()", error.message);
            return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: "Failed to update closing details.",
            });
        }
    }




    async updateRfqStatus(req, res) {
        try {
            logger.info("RFQsController.updateRfqStatus()", req.body);

            const { rfqId, entityId, statusToChange } = req.body;
            const actionBy = req.body.actionBy;

            if (!rfqId || !entityId || !statusToChange) {
                return res.status(STATUS_CODE.BAD_REQUEST).json({
                    error: true,
                    message: "RFQ ID, Entity ID, and new status are required.",
                });
            }

            const rfq = await RFQ.findOne({ rfqId, entityId });

            if (!rfq) {
                return res.status(STATUS_CODE.RFQ_NOT_FOUND_WITH_RFQ_ID).json({
                    error: true,
                    message: `RFQ not found with ID: ${rfqId}`,
                });
            }

            const previousStatus = rfq.status;
            rfq.previousStatus = previousStatus;
            rfq.status = statusToChange;

            const statusLogs = {
                changedStatusFrom: previousStatus,
                changedStatusTo: statusToChange,
                userId: actionBy?.userId,
                name: actionBy?.name,
                date: new Date(),
            };

            rfq.statusLogs.push(statusLogs);

            const updatedRfq = await rfq.save();

            return res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: `RFQ status updated successfully to ${statusToChange}`,
                updatedRfq,
            });
        } catch (error) {
            logger.error("Error updating RFQ status:", error.message);
            return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: "Failed to update RFQ status",
            });
        }
    }


    async getRfqsByDateRange(req, res) {
        try {
            logger.info("RFQsController.getRfqsByDateRange()", req.body);
            const { entityId, userIds, status, startDate, endDate } = req.body;
            const page = req.body.page ? parseInt(req.body.page) : 1;
            const limit = 100;
            const skip = (page - 1) * limit;


            let dateFilter = {};
    
            if (startDate && endDate) {
                const startDateObj = new Date(startDate);
                const endDateObj = new Date(endDate);
                
                endDateObj.setHours(23, 59, 59, 999);
    
                dateFilter = { $gte: startDateObj, $lte: endDateObj };
            } else if (startDate) {
                const startDateObj = new Date(startDate);
                dateFilter = { $gte: startDateObj };
            } else if (endDate) {
                const endDateObj = new Date(endDate);
                endDateObj.setHours(23, 59, 59, 999);
                dateFilter = { $lte: endDateObj };
            }


            const query = { entityId: entityId, requesterId: { $in: userIds }, createdAt:dateFilter, isDeleted: false };
            if (status) {
                query.status = { $eq: status };
            } else {
                query.status = { $ne: "DELETED" };
            }


            const [rfqs, totalCount, statusWiseCounts] = await Promise.all([
                RFQ.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .exec(),

                RFQ.countDocuments({ entityId: entityId, requesterId: { $in: userIds }, status:{$ne: "DELETED"}, isDeleted: false, createdAt:dateFilter }).exec(),

                RFQ.aggregate([
                    { $match: { entityId: entityId, requesterId: { $in: userIds }, isDeleted: false, createdAt:dateFilter } },
                    {
                        $group: {
                            _id: "$status",
                            count: { $sum: 1 }
                        }
                    }
                ]).exec()
            ]);

            const totalPages = Math.ceil(totalCount / limit);

            return res.status(STATUS_CODE.SERVER_SUCCESS).json({
                error: false,
                message: STATUS_CODE.RFQ_FETCHED_SUCCESS,
                rfqs: rfqs,
                totalCount: totalCount,
                statusWiseCounts: statusWiseCounts,
                currentPage: page,
                totalPages: totalPages === 0 ? 1 : totalPages
            });
        } catch (error) {
            logger.error("DirectoryRfqController.getRfqsByDateRange Error",error.message);
            return res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: STATUS_CODE.RFQ_FETCHED_FAILED
            });
        }
    }


    async getEntityRfqPdf(req, res) {
        try {
            logger.info("DirectoryRfqController.getEntityRfqPdf", req.query);
            const { rfqId, entityId } = req.query;
    
            // Fetch the RFQ data from the database
            const rfq = await RFQ.findOne({ rfqId, entityId });
    
            if (!rfq) {
                return res.status(404).json({
                    error: true,
                    message: 'RFQ not found'
                });
            }
    
            // Convert the HTML description to plain text while preserving formatting
            const descriptionText = htmlToText(rfq.description, {
                wordwrap: 130
            });
    
            // Prepare data for the template
            const data = {
                rfqId: rfq.rfqId,
                name: rfq.name,
                createDate: rfq.createdAt.toISOString().split('T')[0],
                indentId: rfq.indentId,
                status: rfq.status,
                requesterName: rfq.requesterName,
                projectName: rfq.projectName,
                location: rfq.location,
                rfqType: rfq.rfqType,
                creditPeriod: rfq.creditPeriod,
                validityDate: rfq.validityDate.toISOString().split('T')[0],
                suppliers: rfq.suppliers,
                description: descriptionText,
            };
    
            // console.log("DATA", data);
    
            // Render the HTML using EJS
            const html = await ejs.renderFile(path.join(__dirname, '../pdfTemplates/rfqPdf.ejs'), data);
            // console.log("HTML", html);
    
            // Launch Puppeteer to convert HTML to PDF
            const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            const page = await browser.newPage();
    
            try {
                await page.setContent(html, { waitUntil: 'networkidle2', timeout: 120000 }); // Increased timeout
            } catch (error) {
                console.error('Error setting content:', error);
                await browser.close();
                return res.status(500).json({
                    error: true,
                    message: 'Failed to generate PDF, please try again.'
                });
            }
    
            try {
                const pdf = await page.pdf({ format: 'A4', printBackground: true });
    
                await browser.close();
    
                res.setHeader('Content-Disposition', `attachment; filename=rfq-${rfq.rfqId}.pdf`);
                res.contentType('application/pdf');
                res.send(pdf);
            } catch (pdfError) {
                console.error('Error generating PDF:', pdfError);
                await browser.close();
                res.status(500).json({
                    error: true,
                    message: 'Failed to generate PDF, please try again.'
                });
            }
    
        } catch (error) {
            logger.error("DirectoryRfqController.getEntityRfqPdf Error", error);
            res.status(500).json({
                error: true,
                message: "Failed to generate PDF, please try again."
            });
        }
    }

    async getRfqsByProjectId(req, res) {
        try {
            logger.info("DirectoryRfqController.getRfqsByProjectId", req.query);
    
            const { projectid, page = 1 } = req.query;
    
            if (!projectid) {
                return res.status(STATUS_CODE.SERVER_BAD_REQUEST).json({
                    error: true,
                    message: "Project ID is required.",
                });
            }
    
            const limit = 100;
            const skip = (page - 1) * limit;
    
            const matchCondition = {
                projectId: projectid,
                isDeleted: false
            };
    
            const [rfqs, totalCount] = await Promise.all([
                RFQ.find(matchCondition)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .exec(),
    
                RFQ.countDocuments(matchCondition).exec()
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
            logger.error("DirectoryRfqController.getRfqsByProjectId Error", error);
            res.status(STATUS_CODE.SERVER_INTERNAL_ERROR_CODE).json({
                error: true,
                message: STATUS_CODE.RFQ_FETCHED_FAILED
            });
        }
    }
    
    async updateVendorEmailAndInvite(req, res) {
        try {
          logger.info("DirectoryRfqController.updateVendorEmailAndInvite", req.body);
          const { rfqId, supplierId, oldEmail, newEmail } = req.body;
      
          if (!supplierId || !oldEmail || !newEmail || !rfqId) {
            return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
              error: true,
              message: "Missing required fields: rfqId, supplierId, oldEmail, newEmail"
            });
          }
      
          const rfq = await RFQ.findOne({ rfqId });
      
          if (!rfq) {
            return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
              error: true,
              message: "RFQ not found"
            });
          }
      
          const supplier = rfq.suppliers.find(supplier => supplier.supplierId === supplierId);
      
          if (!supplier) {
            return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
              error: true,
              message: "Supplier not found in RFQ"
            });
          }
      
          const contactDetail = supplier.contactDetails.find(contact => contact.email === oldEmail);
      
          if (!contactDetail) {
            return res.status(STATUS_CODE.SERVER_NOT_FOUND).json({
              error: true,
              message: "Contact details not found for the old email"
            });
          }
      
          // Update the email in the specific contact detail
          contactDetail.email = newEmail;
      
          // Save the updated RFQ to the database
          await rfq.save();
      
          // Convert the updated supplier to a plain object
          const updatedSupplier = {
            ...supplier.toObject(),
            contactDetails: supplier.contactDetails.map(contact => {
              if (contact.email === newEmail) {
                return { ...contact.toObject(), email: newEmail };
              }
              return contact.toObject();
            })
          };
      
      
          // Log the updatedSupplier before sending the invitation
          logger.info("updatedSupplier after email update", updatedSupplier);
      
          const invitationResult = await inviteVendorsToRfq(rfq, [updatedSupplier]);
      
          // Update the vendor email in the publisher
          try {
              
          await Publisher.updateVendorEmail({ vendorId: supplierId, oldEmail, newEmail });
          } catch (error) {
            console.error(error);
          }
      
          res.status(STATUS_CODE.SERVER_SUCCESS).json({
            error: false,
            message: invitationResult === undefined ? "Failed To send Invitation" : "Invitation sent successfully",
            payload: {
              updatedRFQ: rfq,
            }
          });
      
        } catch (error) {
          logger.error("DirectoryRfqController.updateVendorEmailAndInvite Error", error);
          return res.status(STATUS_CODE.INTERNAL_ERROR_CODE).json({
            error: true,
            message: error.message
          });
        }
      }
      
      

}

module.exports = new DirectoryRfqController();

async function inviteVendorsToRfq(rfq, newSuppliers) {
    try {

        let projectDetails;
        if (rfq.projectId) {
            try {
                projectDetails = await entityProjects.findById({ _id: rfq.projectId }, { name: 1, location: 1, engineerDetails: 1 });
            } catch (error) {
                console.error("Error fetching project details:", error);
            }
        }

        const finalRfq = { ...rfq.toObject() };
        finalRfq.suppliers = newSuppliers;
        finalRfq.projectDetails = projectDetails;

        console.log("####", finalRfq.suppliers)


        const respData = await RFQMailer.sendRFQMailToSupplier(finalRfq);


        let updatedRfq;
        if (!respData.error) {
            rfq.suppliers.forEach((supplier) => {
                const matchingSupplier = newSuppliers.find((newSupplier) => newSupplier.supplierId.toString() === supplier.supplierId.toString());
                if (matchingSupplier) {
                    supplier.state = "INVITED";
                }
            });
            updatedRfq = await rfq.save({ new: true });
            const allSuppliersInvited = updatedRfq.suppliers.every((supplier) => {
                return supplier.state === "INVITED";
            });
            if (allSuppliersInvited) {
                updatedRfq.status = "OPEN";
                await updatedRfq.save({ new: true });
            }
            await updateSupplierLeads(finalRfq);
            // const toUpdate = "contractsSent";
            // try {
            //     const updateContractsAwardedResp = await Publisher.updateContractsAwarded(finalRfq.suppliers, updatedRfq.entityId, toUpdate);
            //     console.log("updateContractsAwardedResp", updateContractsAwardedResp);
            // } catch (error) {
            //     console.error("Error updating contracts awarded:", error);
            // }
        }

        let invalidEmailAddresses = [];
        if (respData.email) {
            invalidEmailAddresses = respData.email.reduce((acc, item) => {
                if (typeof item === 'string') {
                    const emailRegex = /Illegal email address '([^']+)'/;
                    const match = item.match(emailRegex);
                    if (match) {
                        acc.push(match[1]);
                    }
                }
                return acc;
            }, []);
        }

        return {
            error: false,
            message: respData?.message,
            invalidEmailAddresses: invalidEmailAddresses,
            whatsAppInviteStatus: respData.whatsAppInviteStatus ? respData.whatsAppInviteStatus : false,
            rfq: updatedRfq
        };
    } catch (error) {
        console.error("Error sending RFQ invitation email:", error);
        throw new Error("Failed to send RFQ invitation email");
    }
}

async function sendEmailToRfqAwardee(rfq){
    try {
        const payload =  {
            userBusinessName : rfq.userBusinessName,
            rfqName : rfq.name,
            suppliers : (rfq.suppliers.filter((supplier)=>supplier.isAwarded)),
        }

        const emailResponse = await RFQMailer.sendAwardeeEmail(payload)
        // Add your email sending logic here
    } catch (error) {
        console.error("Error sending email:", error.message);
    }
}

