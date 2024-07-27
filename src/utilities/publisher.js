const axios = require("axios");
const logger = require("../logger/logger.js");

class Publisher {


  constructor() {
    this.supplierService = process.env.MS_SUPPLIER_SERVICE_URL;
    this.directoryService = process.env.MS_DIRECTORY_SERVICE_URL;
    this.entityService = process.env.MS_ENTITY_SERVICE_URL;
    this.getSupplierContactUrl = `${this.supplierService}/contacts`;
    this.isOwnerOfBusinessUrl = `${this.supplierService}/isowner`;
    this.isOwnerOfSupplierUrl = `${this.supplierService}/owners/supplierid`;
    this.updateContractsAwardedUrlCd = `${this.directoryService}/update/contracts-awarded`
    this.updateContractsAwardedUrlNeevay = `${this.supplierService}/update/contracts-awarded`
    this.addCCEmailsTOEntityUrl = `${this.entityService}/member/emails`
    this.updateDirectoryVendorEmailUrl = `${this.directoryService}/update/bounced/email`
  }


  // method : post or get
  async publish(url, method, payload ){

    logger.info("Publisher.publish() []", url, " ", method, " ", payload);

    return await axios({
      method: method,
      url: url,
      headers: {
        "content-type": "application/json",
      },
      data: payload
    });
  }

  async getSupplierContacts(payload){
    let response = await this.publish(this.getSupplierContactUrl , "get", payload);
    logger.info("Publisher.getSupplierContacts()", response.data);
    return response.data.payload;
  }

  async isOwnerOfBusiness(payload){
    let response = await this.publish(this.isOwnerOfBusinessUrl , "get", payload);
    logger.info("Publisher.isOwnerOfBusinessUrl()", response.data);
    return response.data.payload;
  }

  async supplierData(payload){
    let response = await this.publish(this.isOwnerOfSupplierUrl , "get", payload);
    logger.info("Publisher.isOwnerOfBusinessUrl()", response.data);
    return response.data.supplierId;
  }

  async addCcEmailsEntity(payload){
    let response = await this.publish(this.addCCEmailsTOEntityUrl , "post", payload);
    logger.info("Publisher.addCcEmailsEntity()", response.data);
    return response.data;
  }

  async updateVendorEmail(payload){
    let response = await this.publish(this.updateDirectoryVendorEmailUrl , "patch", payload);
    logger.info("Publisher.addCcEmailsEntity()", response.data);
    return response.data;
  }

  async updateContractsAwarded(payload, entityId,toUpdate) {
    const nonNeevayVendors = {
      entityId,
      toUpdate,
      vendorIds: payload.filter(supplier => !supplier.isNeevayVendor).map(supplier => supplier.supplierId)
    };

    const neevayVendors = payload.filter(supplier => supplier.isNeevayVendor === true).map(supplier => supplier.supplierId);

    const responses = [];

    if (nonNeevayVendors) {
      const nonNeevayResponse = await this.publish(this.updateContractsAwardedUrlCd, "patch", nonNeevayVendors);
      responses.push(nonNeevayResponse.data);
    }

    if (neevayVendors.length > 0) {
      const neevayResponse = await this.publish(this.updateContractsAwardedUrlNeevay, "patch", {neevayVendors,toUpdate});
      responses.push(neevayResponse.data);
    }

    return responses;
  }


}

module.exports = new Publisher();
