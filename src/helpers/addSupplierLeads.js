const SupplierLeads = require("../models/supplierLeads.js")


async function updateSupplierLeads(updatedRfq) {
    const supplierIdsToUpdate = updatedRfq.suppliers.map(supplier => supplier.supplierId);
    const existingSupplierLeads = await SupplierLeads.find({ supplierId: { $in: supplierIdsToUpdate } });
    const existingSupplierLeadsMap = existingSupplierLeads.reduce((acc, lead) => {
        acc[lead.supplierId] = lead;
        return acc;
    }, {});

    for (const supplier of updatedRfq.suppliers) {
        if (supplier.state === "INVITED") {
            const supplierLead = existingSupplierLeadsMap[supplier.supplierId];
            const rfqId = updatedRfq.rfqId;
            const currentDate = new Date();

            if (supplierLead) {
                const rfqIndex = supplierLead.rfqIds.findIndex(item => item.rfqId === rfqId);
                if (rfqIndex === -1) {
                    supplierLead.rfqIds.push({ rfqId, date: currentDate });
                    await supplierLead.save();
                }
            } else {
                const newSupplierLead = new SupplierLeads({
                    supplierId: supplier.supplierId,
                    rfqIds: [{ rfqId, date: currentDate }]
                });
                await newSupplierLead.save();
            }
        }
    }
}

module.exports = updateSupplierLeads;