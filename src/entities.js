import * as THREE from 'three';
import { lerp, stringToColor } from './utils.js';

class BasePlayer {
    constructor(scene, id, data) {
        this.id = id;
        this.scene = scene;
        this.mesh = this.createMesh(data);
        this.scene.add(this.mesh);

        // Initial position
        if (data && data.x) {
            this.mesh.position.set(data.x, data.y, data.z);
        }
    }

    createMesh(data) {
        const group = new THREE.Group();

        // Body
        const color = data.username ? stringToColor(data.username) : 0xffaa00;
        const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
        const material = new THREE.MeshStandardMaterial({ color: color });
        const body = new THREE.Mesh(geometry, material);
        body.position.y = 1;
        body.castShadow = true;
        group.add(body);

        // Eyes (to see rotation)
        const eyeGeo = new THREE.BoxGeometry(0.6, 0.2, 0.2);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const eyes = new THREE.Mesh(eyeGeo, eyeMat);
        eyes.position.set(0, 1.3, 0.4);
        group.add(eyes);

        // Name Tag
        if (data.username) {
            this.createNameTag(data.username, group);
        }

        return group;
    }

    createNameTag(name, parent) {
        // We'll update the HTML name tag position in the main loop
        // Here we just store the reference name
        this.username = name;
    }

    destroy() {
        this.scene.remove(this.mesh);
    }
}

export class LocalPlayer extends BasePlayer {
    constructor(scene, world, network) {
        super(scene, 'local', { username: 'You' });
        this.world = world;
        this.network = network;

        this.targetPosition = new THREE.Vector3();
        this.isMoving = false;
        this.speed = 8.0;

        // Visual indicator for click target
        const ringGeo = new THREE.RingGeometry(0.3, 0.4, 16);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        this.targetIndicator = new THREE.Mesh(ringGeo, ringMat);
        this.targetIndicator.rotation.x = -Math.PI/2;
        this.targetIndicator.visible = false;
        this.scene.add(this.targetIndicator);
    }

    setTarget(point) {
        this.targetPosition.copy(point);
        this.isMoving = true;

        // Show indicator slightly above ground
        this.targetIndicator.position.copy(point);
        this.targetIndicator.position.y += 0.1;
        this.targetIndicator.visible = true;

        // Play sound
        const audio = new Audio('click_sound.mp3');
        audio.volume = 0.3;
        audio.play().catch(e => {}); // Ignore autoplay errors
    }

    update(dt) {
        if (!this.isMoving) return;

        const currentPos = this.mesh.position;
        const direction = new THREE.Vector3().subVectors(this.targetPosition, currentPos);
        direction.y = 0; // Keep movement horizontal

        const dist = direction.length();

        if (dist < 0.1) {
            this.isMoving = false;
            this.targetIndicator.visible = false;
            return;
        }

        direction.normalize();

        // Calculate next position
        const moveDist = this.speed * dt;
        const nextX = currentPos.x + direction.x * moveDist;
        const nextZ = currentPos.z + direction.z * moveDist;

        // Collision Check
        if (!this.world.checkCollision(nextX, nextZ)) {
            this.mesh.position.x = nextX;
            this.mesh.position.z = nextZ;

            // Rotate to face movement
            const targetRotation = Math.atan2(direction.x, direction.z);
            // Smooth rotation
            let rot = this.mesh.rotation.y;
            // Shortest angle interpolation could be added here, basic set for now
            this.mesh.rotation.y = targetRotation;

            // Send update to server
            this.network.sendPosition(
                this.mesh.position.x,
                this.mesh.position.y,
                this.mesh.position.z,
                this.mesh.rotation.y
            );
        } else {
            // Simple slide or stop. Stopping is safer for this template to prevent getting stuck.
            this.isMoving = false;
            this.targetIndicator.visible = false;
        }

        // Update UI debug
        document.getElementById('coords').innerText = `Pos: (${Math.round(nextX)}, ${Math.round(nextZ)})`;
    }
}

export class RemotePlayer extends BasePlayer {
    constructor(scene, id, data) {
        super(scene, id, data);

        // Interpolation buffers
        this.targetPos = new THREE.Vector3(data.x || 0, data.y || 0, data.z || 0);
        this.targetRot = data.rotation || 0;

        this.mesh.position.copy(this.targetPos);
        this.mesh.rotation.y = this.targetRot;
    }

    updateTarget(data) {
        if (data.x !== undefined) this.targetPos.set(data.x, data.y, data.z);
        if (data.rotation !== undefined) this.targetRot = data.rotation;
    }

    update(dt) {
        // Smoothly interpolate position (Lerp factor 10 * dt roughly means catch up quickly)
        this.mesh.position.lerp(this.targetPos, 10 * dt);

        // Interpolate rotation
        // Note: Basic lerp for rotation has wrap-around issues (359 -> 1), 
        // strictly for template simplicity we just set it or use simple lerp
        this.mesh.rotation.y = lerp(this.mesh.rotation.y, this.targetRot, 10 * dt);
    }
}