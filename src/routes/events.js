const express = require("express");
const router = express.Router();

const eventController = require("../controllers/event");

// Create an event
router.post("/create", eventController.createEvent);

// Update an event
router.put("/update/:id", eventController.updateEvent);

// Delete an event
router.delete("/events/:id", eventController.deleteEvent);

// Get a single event by ID
router.get("/events/:id", eventController.getEventById);

// Get all events
router.get("/events", eventController.getAllEvents);

// Get all events for a specific organizer
router.get(
  "/events/organizer/:organizerId",
  eventController.getEventsByOrganizer
);

module.exports = router;
