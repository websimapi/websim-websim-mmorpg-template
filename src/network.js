import { throttle } from './utils.js';

export class NetworkManager {
    constructor(game) {
        this.game = game;
        this.room = new WebsimSocket();
        this.peers = {};
        this.lastUpdate = 0;
        this.updateRate = 100; // ms (10 updates per second)
    }

    async init() {
        await this.room.initialize();
        
        // Subscribe to presence changes (players moving)
        this.room.subscribePresence((presence) => {
            this.handlePresenceUpdate(presence);
        });

        // Subscribe to room state (world changes)
        this.room.subscribeRoomState((state) => {
            this.handleRoomStateUpdate(state);
        });

        // Handle events (emotes, attacks, etc)
        this.room.onmessage = (event) => {
            const data = event.data;
            if (data.type === 'chat') {
                this.game.ui.log(`${data.username}: ${data.message}`);
            }
        };

        // Initial setup
        this.clientId = this.room.clientId;
        this.updateUI();

        console.log("Network initialized. Client ID:", this.clientId);
        
        // Throttled function to send updates
        this.broadcastPresence = throttle((data) => {
            this.room.updatePresence(data);
        }, this.updateRate);
    }

    handlePresenceUpdate(presence) {
        // Iterate through all connected clients in the presence object
        Object.keys(presence).forEach(clientId => {
            if (clientId === this.clientId) return; // Skip self

            const data = presence[clientId];
            
            // If we don't know this peer yet, add them
            if (!this.game.remotePlayers[clientId]) {
                const peerInfo = this.room.peers[clientId];
                this.game.addRemotePlayer(clientId, data, peerInfo);
            } else {
                // Update existing peer target for interpolation
                this.game.remotePlayers[clientId].updateTarget(data);
            }
        });

        // Cleanup disconnected players
        Object.keys(this.game.remotePlayers).forEach(clientId => {
            if (!presence[clientId]) {
                this.game.removeRemotePlayer(clientId);
            }
        });

        this.updateUI();
    }

    handleRoomStateUpdate(state) {
        // Handle shared world state (e.g. dynamic obstacles)
        // For this template, we mostly use static world generation
    }

    sendPosition(x, y, z, rotation) {
        this.broadcastPresence({
            x, y, z, rotation,
            timestamp: Date.now()
        });
    }

    updateUI() {
        const count = Object.keys(this.room.peers).length;
        document.getElementById('peers').innerText = `Peers: ${count}`;
    }
}