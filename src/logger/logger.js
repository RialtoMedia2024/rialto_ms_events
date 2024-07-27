const log4js = require('log4js');
const { getLogger, configure } = log4js;
require('dotenv').config();

configure({
    appenders: {
        app: { type: "file", filename: process.env.LOG_LOCATION },
        out: { type: 'stdout' },
        multi: {
            type: 'multiFile',
            base: './logs',
            property: 'categoryName',
            extension: '.log',
            maxLogSize: 20000000, //20MB
            backup: 2,
            compress: true
        }
    },
    categories: {
        default: {
            appenders: ["app", "out", "multi"],
            level: 'debug'
        }
    }
});

const logger = getLogger();

module.exports = logger;