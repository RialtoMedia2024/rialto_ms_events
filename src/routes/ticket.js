const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/ticket");

router.post("/create", ticketController.createTicket);
router.put("/update/:id", ticketController.updateTicket);
router.delete("/delete/:id", ticketController.deleteTicket);
router.get("/single/:id", ticketController.getTicketById);
router.get("/all", ticketController.getAllTickets);
router.get("/events/:eventId/tickets", ticketController.getTicketsByEventId);

module.exports = router;
