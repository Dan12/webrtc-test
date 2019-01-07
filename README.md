# WebRTC test

This repo is intented to test out the messaging capabilities of webrtc.

The code uses a simply websocket broadcast server which broadcasts all incoming websocket messages to all connected clients.

On the client side, the code displays all recently connected uuids and allows a simple console based ping-ponging.

One can test that the webrtc protocol is working as expected by shutting down the server after the clients have connected to each other and observe that the ping-pong messages are still received.