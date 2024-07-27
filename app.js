const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const expressValidator = require('express-validator');
const fileUpload = require('express-fileupload');
const logger = require('./src/logger/logger.js');
//require('dotenv').config();
require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` })
logger.info(`./.env.${process.env.NODE_ENV}`)



// import routes
const eventsRoutes = require('./src/routes/events');
const ticketsRoutes = require('./src/routes/ticket');
const rfqsRoutes = require('./src/routes/rfqs');
const leadsRoutes = require('./src/routes/leads');
const rfqCountRoutes = require('./src/routes/meterCount.js');

const cron = require("node-cron");
const Crons = require('./src/utilities/crons.js');
const STATUS_CODE = require("./src/configs/errors");
const rfqMailer = require('./src/helpers/rfqMailer.js');

// app
const app = express();

// db
logger.info("Database : ", process.env.DATABASE);
mongoose
    .connect(process.env.DATABASE, {
        useNewUrlParser: true,
        useCreateIndex: true,
        useUnifiedTopology: true
    })
    .then(() => logger.info('DB Connected'))
    .catch(err => logger.info(err));



// middlewares

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.json());
app.use(fileUpload());
//app.use(expressValidator());  // TODO_SP check how to use validator
//app.use(cors());



// routes middleware
app.use('/api/rfqs', rfqsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/rfqs/lead', leadsRoutes);
// app.use('/api/rfqs/', rfqCountRoutes);

// Start cron to check every midnight - To update RFQ status OPEN->EXPIRED
// cron.schedule('10 0 * * *', async () => {
//     logger.info(`startRfqOpenToExpired() :: Schedule the job to run every day at midnight`);

//     const dbResponse = await Crons.startRfqOpenToExpired();
//     if (dbResponse) {
//         logger.info(`cron.schedule :: dbResponse: `, dbResponse);
//     }

//     const cronResponse = {
//         error: false,
//         message: STATUS_CODE.CRON_JOB_START_SUCCESS,
//         payload: "Done",
//     };
//     logger.info(`cron.schedule :: cronResponse: `, cronResponse);
// });


// commenting the code of cron job which sends lead reminder to user 
/*cron.schedule('30 5,10 * * *', async () => {
    logger.info(`1. Scheduled the job to run every day at 11am and 4pm for lead reminder`);
        
    const recipients = await Crons.getRFQSForLeadReminder();
    // console.log("********",recipients)
    if (recipients) {
        logger.info(`cron.schedule :: filteredRFQS: six days older rfqs fetched successfully`);

        let respData = await rfqMailer.sendLeadReminder(recipients)

        logger.info(`cron.schedule leadReminder: response from communication service***`,respData.message, respData.response);
    }
    const cronResponse = {
        error: false,
        message: STATUS_CODE.SERVER_SUCCESS,
        payload: "Done",
    };
    logger.info(`cron.schedule :: cronResponse: `, cronResponse);
});*/

const port = process.env.MS_RFQS_PORT || 5000;
const host = process.env.MS_RFQS_HOST || 'localhost';

app.listen(port, host, () => {
    logger.info(`RFQs Service is running on http://${host}:${port}`);
});
