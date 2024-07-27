const mongoose = require("mongoose");
const autoIncrement = require("mongoose-sequence")(mongoose);

const entityProjectsSchema = new mongoose.Schema({
    projectId: {
        type: Number,
        auto: true,
        unique: true
    },
    name: {
        type: String,
    },
    estimateValue: {
        type: String
    },
    location: {
        area: { type: String },
        city: { type: String },
        state: { type: String },
        region: { type: String }
    },
    engineerDetails: [{
        name: { type: String },
        mobile: { type: String }
    }],
    isDeleted: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: Number
    }
},
    { timestamps: true },
)

entityProjectsSchema.plugin(autoIncrement, { id: "entityprojectsSeq", inc_field: "projectId" });

module.exports = entityProjects = mongoose.model("entityProjects", entityProjectsSchema);