const Event = require("../models/event");



class EventController {

    async createEvent(req, res) {
        try {
            const { name, category, dateAndTime, banner, description, location, address, organizer } = req.body;

            // Create a new event instance
            const newEvent = new Event({
                name,
                category,
                dateAndTime,
                banner,
                description,
                location,
                address,
                organizer
            });

            // Save the event to the database
            const savedEvent = await newEvent.save();

            // Send a success response
            res.status(201).json({
                message: 'Event created successfully',
                event: savedEvent
            });
        } catch (error) {
            // Handle errors and send an error response
            res.status(500).json({
                message: 'Error creating event',
                error: error.message
            });
        }
    }

    async updateEvent(req, res) {
        try {
            const { id } = req.params; // this is the eventId from the URL parameters
            const updateData = req.body;
    
            // Find the event by eventId and update it
            const updatedEvent = await Event.findOneAndUpdate({ eventId: id }, updateData, { new: true });
    
            if (!updatedEvent) {
                return res.status(404).json({
                    message: 'Event not found'
                });
            }
    
            // Send a success response
            res.status(200).json({
                message: 'Event updated successfully',
                event: updatedEvent
            });
        } catch (error) {
            // Handle errors and send an error response
            res.status(500).json({
                message: 'Error updating event',
                error: error.message
            });
        }
    }
    

    async deleteEvent(req, res) {
        try {
            const { id } = req.params;

            // Find the event by ID and delete it
            const deletedEvent = await Event.findByIdAndDelete(id);

            if (!deletedEvent) {
                return res.status(404).json({
                    message: 'Event not found'
                });
            }

            // Send a success response
            res.status(200).json({
                message: 'Event deleted successfully',
                event: deletedEvent
            });
        } catch (error) {
            // Handle errors and send an error response
            res.status(500).json({
                message: 'Error deleting event',
                error: error.message
            });
        }
    }

    async getEventById(req, res) {
        try {
            const { id } = req.params;

            const event = await Event.findById(id);

            if (!event) {
                return res.status(404).json({
                    message: 'Event not found'
                });
            }

            res.status(200).json({
                message: 'Event retrieved successfully',
                event
            });
        } catch (error) {
            res.status(500).json({
                message: 'Error retrieving event',
                error: error.message
            });
        }
    }

    async getAllEvents(req, res) {
        try {
            const events = await Event.find();

            res.status(200).json({
                message: 'Events retrieved successfully',
                events
            });
        } catch (error) {
            res.status(500).json({
                message: 'Error retrieving events',
                error: error.message
            });
        }
    }

    async getEventsByOrganizer(req, res) {
        try {
            const organizerId = req.params.organizerId;
            const events = await Event.find({ organizer: organizerId });
            if (!events.length) {
                return res.status(404).json({ message: 'No events found for this organizer' });
            }
            res.status(200).json(events);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}



module.exports = new EventController();