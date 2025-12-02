import * as THREE from 'three';
import { NetworkManager } from './network.js';
import { World } from './world.js';
import { LocalPlayer, RemotePlayer } from './entities.js';

class Game {
    constructor() {
        this.remotePlayers = {};
        
        this.initThree();
        this.world = new World(this.scene);
        this.network = new NetworkManager(this);

        // UI Helpers
        this.ui = {
            log: (msg) => {
                const el = document.getElementById('log');
                const line = document.createElement('div');
                line.innerText = msg;
                el.appendChild(line);
                el.scrollTop = el.scrollHeight;
            }
        };

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.setupInputs();
        this.start();
    }

    initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 20, 100);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 15, 15);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    setupInputs() {
        const onPointerDown = (event) => {
            // Normalize mouse/touch coordinates
            let x, y;
            if (event.changedTouches) {
                x = event.changedTouches[0].clientX;
                y = event.changedTouches[0].clientY;
            } else {
                x = event.clientX;
                y = event.clientY;
            }

            // Convert to -1 to +1 range
            this.mouse.x = (x / window.innerWidth) * 2 - 1;
            this.mouse.y = -(y / window.innerHeight) * 2 + 1;

            // Raycast
            this.raycaster.setFromCamera(this.mouse, this.camera);
            
            // Intersect with ground
            const intersects = this.raycaster.intersectObject(this.world.groundPlane);

            if (intersects.length > 0 && this.localPlayer) {
                const point = intersects[0].point;
                this.localPlayer.setTarget(point);
                
                // create small splash effect
                // (omitted for brevity, but easy to add here)
            }
        };

        // Handle both mouse and touch
        window.addEventListener('pointerdown', onPointerDown);
    }

    async start() {
        this.world.init();
        await this.network.init();

        // Create local player once connected
        // Get my own info
        const myInfo = this.network.room.peers[this.network.clientId] || { username: 'Player' };
        
        this.localPlayer = new LocalPlayer(this.scene, this.world, this.network, myInfo.username);
        
        // Resolve names immediately to handle potential duplicates with existing peers
        this.resolvePlayerNames();

        document.getElementById('loading').style.opacity = 0;
        
        this.lastTime = performance.now();
        this.animate();
    }

    addRemotePlayer(id, data, info) {
        // Merge presence data with peer info (username)
        const combinedData = { ...data, username: info ? info.username : 'Unknown' };
        const player = new RemotePlayer(this.scene, id, combinedData);
        this.remotePlayers[id] = player;
        this.ui.log(`${combinedData.username} joined.`);
        this.resolvePlayerNames();
    }

    removeRemotePlayer(id) {
        if (this.remotePlayers[id]) {
            this.remotePlayers[id].destroy();
            delete this.remotePlayers[id];
            this.resolvePlayerNames();
        }
    }

    resolvePlayerNames() {
        // Gather all players
        const allPlayers = [];
        if (this.localPlayer) allPlayers.push(this.localPlayer);
        Object.values(this.remotePlayers).forEach(p => allPlayers.push(p));

        // Sort by ID to ensure consistent naming order across all clients
        allPlayers.sort((a, b) => a.id.localeCompare(b.id));

        const nameCounts = {};

        // Assign names
        allPlayers.forEach(p => {
            const raw = p.rawUsername;
            if (!nameCounts[raw]) nameCounts[raw] = 0;
            nameCounts[raw]++;
            
            const count = nameCounts[raw];
            if (count > 1) {
                p.username = `${raw} (${count - 1})`;
            } else {
                p.username = raw;
            }
        });
    }

    updateCamera() {
        if (this.localPlayer) {
            // Smooth camera follow
            const targetX = this.localPlayer.mesh.position.x;
            const targetZ = this.localPlayer.mesh.position.z + 15; // Offset Z
            
            this.camera.position.x += (targetX - this.camera.position.x) * 0.1;
            this.camera.position.z += (targetZ - this.camera.position.z) * 0.1;
            this.camera.lookAt(this.localPlayer.mesh.position);
        }
    }
    
    updateNameTags() {
        // Update label positions
        const labelsContainer = document.getElementById('labels');
        labelsContainer.innerHTML = ''; // Clear and redraw is simplest for small numbers. 
        // Optimized approach: update existing DOM elements.
        
        const allPlayers = [this.localPlayer, ...Object.values(this.remotePlayers)].filter(p => p);

        allPlayers.forEach(p => {
            if(!p.username) return;
            
            // Project 3D pos to 2D screen
            const pos = p.mesh.position.clone();
            pos.y += 2.5; // Above head
            pos.project(this.camera);

            const x = (pos.x * .5 + .5) * window.innerWidth;
            const y = (-(pos.y * .5) + .5) * window.innerHeight;

            // Only draw if visible and in front of camera
            if (pos.z < 1) {
                const el = document.createElement('div');
                el.className = 'name-tag';
                el.innerText = p.username;
                el.style.left = `${x}px`;
                el.style.top = `${y}px`;
                labelsContainer.appendChild(el);
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const time = performance.now();
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        this.world.update(time);

        if (this.localPlayer) this.localPlayer.update(dt);
        
        Object.values(this.remotePlayers).forEach(p => p.update(dt));

        this.updateCamera();
        this.updateNameTags();

        this.renderer.render(this.scene, this.camera);
    }
}

new Game();