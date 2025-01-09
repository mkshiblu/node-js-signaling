const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Object to track connected clients
const connectedClients = {};

wss.on('connection', (ws) => {
    // Generate a unique ID for the new client
    const clientId = uuidv4();
    connectedClients[clientId] = ws;

    console.log(`Client ${clientId} connected`);
    broadcastClients(clientId); // Notify all clients of the updated client list

    // Handle incoming messages
    ws.on('message', (data) => {
        const message = JSON.parse(data);
        console.log(`Message received: ${message} from client ${clientId}`);
        broadcastMessage(clientId, message);
    });

    // Handle WebSocket errors
    ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}: ${error.message}`);
    });

    // Handle client disconnect
    ws.on('close', () => {
        delete connectedClients[clientId];
        console.log(`Client ${clientId} disconnected`);
        broadcastClients(clientId); // Notify all clients of the updated client list
    });
});

/**
 * Notify all connected clients with the updated list of peers.
 * @param {string} currentClientId - The ID of the client whose connection triggered the update.
 */
function broadcastClients(currentClientId) {
    const peerList = Object.keys(connectedClients).map(clientId => ({ id: clientId }));
    const payload = JSON.stringify({
        type: 'client_list',
        current_client_id: currentClientId,
        clients: peerList,
        connection_number: Object.keys(connectedClients).length
    });

    for (const ws of Object.values(connectedClients)) {
        try {
            ws.send(payload);
        } catch (error) {
            console.error(`Error sending client list: ${error.message}`);
        }
    }
}

/**
 * Broadcast a signaling message to a specific recipient or all clients except the sender.
 * @param {string} senderId - The ID of the client sending the message.
 * @param {string} message - The message to broadcast.
 */
function broadcastMessage(senderId, message) {
    let msgObj = message;

    if (msgObj.recipient) {
        console.log(`Sending message to ${msgObj.recipient}`);
        const recipientWs = connectedClients[msgObj.recipient];
        if (recipientWs) {
            recipientWs.send(JSON.stringify({
                type: 'signal',
                sender: senderId,
                message: msgObj
            }));
        } else {
            console.error(`Recipient ${msgObj.recipient} not found`);
        }
    } else {
        for (const [clientId, ws] of Object.entries(connectedClients)) {
            if (clientId !== senderId) {
                try {
                    ws.send(JSON.stringify({
                        type: 'signal',
                        sender: senderId,
                        message: msgObj
                    }));
                } catch (error) {
                    console.error(`Error broadcasting message to client ${clientId}: ${error.message}`);
                }
            }
        }
    }
}

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Signaling server is running on http://localhost:${PORT}..`);
});
