const Ticket = require("../models/ticket");

class TicketController {

    async createTicket(req, res) {
        try {
            const ticketData = req.body;
            const newTicket = new Ticket(ticketData);
            await newTicket.save();
            res.status(201).json({
                message: 'Ticket created successfully',
                ticket: newTicket
            });
        } catch (error) {
            res.status(500).json({
                message: 'Error creating ticket',
                error: error.message
            });
        }
    }

    async updateTicket(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const updatedTicket = await Ticket.findByIdAndUpdate(id, updateData, { new: true });

            if (!updatedTicket) {
                return res.status(404).json({
                    message: 'Ticket not found'
                });
            }

            res.status(200).json({
                message: 'Ticket updated successfully',
                ticket: updatedTicket
            });
        } catch (error) {
            res.status(500).json({
                message: 'Error updating ticket',
                error: error.message
            });
        }
    }

    async deleteTicket(req, res) {
        try {
            const { id } = req.params;
            const deletedTicket = await Ticket.findByIdAndDelete(id);

            if (!deletedTicket) {
                return res.status(404).json({
                    message: 'Ticket not found'
                });
            }

            res.status(200).json({
                message: 'Ticket deleted successfully',
                ticket: deletedTicket
            });
        } catch (error) {
            res.status(500).json({
                message: 'Error deleting ticket',
                error: error.message
            });
        }
    }

    async getTicketById(req, res) {
        try {
            const { id } = req.params;
            const ticket = await Ticket.findById(id);

            if (!ticket) {
                return res.status(404).json({
                    message: 'Ticket not found'
                });
            }

            res.status(200).json({
                message: 'Ticket retrieved successfully',
                ticket
            });
        } catch (error) {
            res.status(500).json({
                message: 'Error retrieving ticket',
                error: error.message
            });
        }
    }

    async getAllTickets(req, res) {
        try {
            const tickets = await Ticket.find();
            res.status(200).json({
                message: 'Tickets retrieved successfully',
                tickets
            });
        } catch (error) {
            res.status(500).json({
                message: 'Error retrieving tickets',
                error: error.message
            });
        }
    }

    async getTicketsByEventId(req, res) {
        try {
            const { eventId } = req.params;
            const tickets = await Ticket.find({ eventId });

            if (!tickets.length) {
                return res.status(404).json({
                    message: 'No tickets found for this event'
                });
            }

            res.status(200).json({
                message: 'Tickets retrieved successfully',
                tickets
            });
        } catch (error) {
            res.status(500).json({
                message: 'Error retrieving tickets',
                error: error.message
            });
        }
    }
}

module.exports = new TicketController();
