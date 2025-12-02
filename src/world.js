import * as THREE from 'three';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.colliders = []; // Array of objects with position and radius
        this.groundPlane = null;

        const loader = new THREE.TextureLoader();
        this.textures = {
            ground: loader.load('ground_texture.png'),
            water: loader.load('water_texture.png'),
            obstacle: loader.load('obstacle_texture.png')
        };

        this.textures.ground.wrapS = THREE.RepeatWrapping;
        this.textures.ground.wrapT = THREE.RepeatWrapping;
        this.textures.ground.repeat.set(10, 10);

        this.textures.water.wrapS = THREE.RepeatWrapping;
        this.textures.water.wrapT = THREE.RepeatWrapping;
        this.textures.water.repeat.set(5, 5);
    }

    init() {
        this.createTerrain();
        this.createWater();
        this.createObstacles();
        this.createLighting();
    }

    getHeightAt(x, z) {
        return Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2;
    }

    createLighting() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffffff, 0.8);
        sun.position.set(50, 100, 50);
        sun.castShadow = true;
        sun.shadow.camera.left = -50;
        sun.shadow.camera.right = 50;
        sun.shadow.camera.top = 50;
        sun.shadow.camera.bottom = -50;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        this.scene.add(sun);
    }

    createTerrain() {
        // Simple flat ground for logic, but visual bumps
        const geometry = new THREE.PlaneGeometry(200, 200, 64, 64);

        // Add some noise to vertices
        const posAttribute = geometry.attributes.position;
        for (let i = 0; i < posAttribute.count; i++) {
            const x = posAttribute.getX(i);
            const y = posAttribute.getY(i);
            
            // Map local plane coords to world coords to get consistent height
            // Local X = World X
            // Local Y = -World Z (rotated -90 deg X)
            const height = this.getHeightAt(x, -y);
            
            posAttribute.setZ(i, height);
        }

        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ 
            map: this.textures.ground,
            roughness: 0.8 
        });

        this.groundPlane = new THREE.Mesh(geometry, material);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.receiveShadow = true;
        this.scene.add(this.groundPlane);
    }

    createWater() {
        const geometry = new THREE.PlaneGeometry(200, 200);
        const material = new THREE.MeshStandardMaterial({
            map: this.textures.water,
            transparent: true,
            opacity: 0.7,
            color: 0x44aaff,
            roughness: 0.1
        });

        this.water = new THREE.Mesh(geometry, material);
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = -1.5; // Slightly below ground 0
        this.scene.add(this.water);
    }

    createObstacles() {
        // Create random rocks/trees
        const geometry = new THREE.CylinderGeometry(1, 1.5, 4, 8);
        const material = new THREE.MeshStandardMaterial({ map: this.textures.obstacle });

        for(let i=0; i<30; i++) {
            const mesh = new THREE.Mesh(geometry, material);

            // Random position
            const angle = Math.random() * Math.PI * 2;
            const radius = 10 + Math.random() * 80; // Keep spawn area (0,0) clear

            mesh.position.x = Math.cos(angle) * radius;
            mesh.position.z = Math.sin(angle) * radius;
            mesh.position.y = 2; // Half height

            mesh.castShadow = true;
            mesh.receiveShadow = true;

            this.scene.add(mesh);

            // Add to collision list
            this.colliders.push({
                x: mesh.position.x,
                z: mesh.position.z,
                radius: 2.0 // Physical radius slightly larger than visual
            });
        }
    }

    update(time) {
        if(this.water) {
            this.water.position.y = -1.5 + Math.sin(time * 0.001) * 0.2;
            this.textures.water.offset.x = time * 0.0001;
            this.textures.water.offset.y = time * 0.0001;
        }
    }

    // Check if a point collides with any static object
    checkCollision(x, z) {
        for (let obj of this.colliders) {
            const dx = x - obj.x;
            const dz = z - obj.z;
            const distSq = dx*dx + dz*dz;
            if (distSq < obj.radius * obj.radius) {
                return true;
            }
        }
        return false;
    }
}