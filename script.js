import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

document.addEventListener('DOMContentLoaded', () => {
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true 
    });
    
    // Initialize arrays
    const activeFireworks = [];
    const cubes = [];  // Initialize cubes array
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = false;  // Important for rendering background
    document.body.appendChild(renderer.domElement);

    // Enable shadow mapping
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Create background shader
    const backgroundShader = {
        uniforms: {
            'time': { value: 0 },
            'resolution': { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec2 resolution;
            varying vec2 vUv;

            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                vec2 pos = (uv * 2.0 - 1.0);
                pos.x *= resolution.x / resolution.y;
                
                vec3 color = vec3(0.02, 0.02, 0.05); // Darker base color
                
                // Create multiple moving waves
                for(float i = 1.0; i < 4.0; i++) {
                    float t = time * 0.4 / i;
                    
                    // Rotating position
                    vec2 rotPos = vec2(
                        pos.x * cos(t) - pos.y * sin(t),
                        pos.x * sin(t) + pos.y * cos(t)
                    );
                    
                    // Wave pattern
                    float wave = sin(dot(rotPos, vec2(cos(t), sin(t))) * 3.0 * i + time) * 0.5 + 0.5;
                    wave *= smoothstep(1.5, 0.5, length(pos));
                    
                    // Add colors with phase shift
                    color += vec3(
                        wave * sin(time * 0.3 + i * 1.0) * 0.3,
                        wave * sin(time * 0.4 + i * 1.1) * 0.2,
                        wave * sin(time * 0.5 + i * 1.2) * 0.5
                    );
                }
                
                // Add subtle pulsing glow
                float glow = sin(time) * 0.1 + 0.1;
                color += vec3(0.1, 0.2, 0.4) * glow;
                
                gl_FragColor = vec4(color, 1.0);
            }
        `
    };

    // Create background plane with new material settings
    const backgroundMaterial = new THREE.ShaderMaterial({
        uniforms: backgroundShader.uniforms,
        vertexShader: backgroundShader.vertexShader,
        fragmentShader: backgroundShader.fragmentShader,
        depthWrite: false,
        depthTest: false,
        transparent: true,
        side: THREE.DoubleSide
    });

    const backgroundPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        backgroundMaterial
    );

    const backgroundScene = new THREE.Scene();
    const backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    backgroundScene.add(backgroundPlane);

    // Handle window resize
    window.addEventListener('resize', () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        camera.aspect = width / height;
        setupCamera();  // Reconfigure camera and controls on resize
        
        renderer.setSize(width, height);
        backgroundShader.uniforms.resolution.value.set(width, height);
    });

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minDistance = 7;
    controls.maxDistance = 7;
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: null,
        RIGHT: null
    };

    // Track mouse movement for click vs. drag
    let mouseDownTime = 0;
    let mouseDownPosition = { x: 0, y: 0 };
    let isDragging = false;
    let isRotating = false;

    window.addEventListener('mousedown', (event) => {
        if (event.button === 0) { // Left click only
            mouseDownTime = Date.now();
            mouseDownPosition = { x: event.clientX, y: event.clientY };
            isDragging = false;
            isRotating = false;
        }
    });

    window.addEventListener('mousemove', (event) => {
        if (mouseDownTime !== 0) {
            const deltaX = Math.abs(event.clientX - mouseDownPosition.x);
            const deltaY = Math.abs(event.clientY - mouseDownPosition.y);
            if (deltaX > 5 || deltaY > 5) {
                isDragging = true;
                isRotating = true;
                controls.enabled = true;
            }
        }
    });

    // Lighting setup with shadows
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);  // Slightly brighter ambient
    scene.add(ambientLight);

    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 8, 6);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 40;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-6, 3, -4);
    scene.add(fillLight);

    // Rim light for depth
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
    rimLight.position.set(0, -4, -5);
    scene.add(rimLight);

    // Top light for better coverage
    const topLight = new THREE.DirectionalLight(0xffffff, 0.2);
    topLight.position.set(0, 10, 0);
    scene.add(topLight);

    // Game state
    const gameState = {
        board: Array(3).fill().map(() => Array(3).fill().map(() => Array(3).fill(null))),
        currentPlayer: 'X',
        isGameOver: false
    };

    // Create game board
    const cubeSize = 0.4;  // Smaller cube size
    const offset = cubeSize * 3.0;  // More space between cubes
    const centerOffset = offset * 1;  // Since we're going from -1 to 1 in each dimension

    // Add physics properties to cubes
    function addPhysicsProperties(cube) {
        cube.velocity = new THREE.Vector3(0, 0, 0);
        cube.angularVelocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1
        );
        cube.isPhysicsEnabled = false;
    }

    // Load beveled box model
    const loader = new GLTFLoader();
    let boxModel;
    
    loader.load(
        '/3D-Tic-Tac-Toe/beveled_box_2.glb',
        (gltf) => {
            boxModel = gltf.scene.children[0];
            boxModel.scale.set(cubeSize, cubeSize, cubeSize);  // Scale down the model
            initializeGame(boxModel);
        },
        undefined,
        (error) => {
            console.error('Error loading model:', error);
        }
    );

    function initializeGame(boxModel) {
        // Initialize cubes with physics
        for (let z = 0; z < 3; z++) {
            for (let y = 0; y < 3; y++) {
                for (let x = 0; x < 3; x++) {
                    const cube = boxModel.clone();
                    
                    const material = new THREE.MeshPhysicalMaterial({ 
                        color: 0xffffff,
                        transparent: true,
                        opacity: 0.6,
                        metalness: 0.3,
                        roughness: 0.2,
                        clearcoat: 0.5,
                        clearcoatRoughness: 0.3,
                        side: THREE.DoubleSide
                    });

                    cube.material = material;
                    
                    // Center the board by offsetting from center
                    cube.position.set(
                        (x * offset - centerOffset),
                        (y * offset - centerOffset),
                        (z * offset - centerOffset)
                    );
                    
                    cube.userData = { x, y, z };
                    cube.callback = handleCellClick;
                    
                    cubes.push(cube);
                    scene.add(cube);

                    // Create hitbox
                    const hitboxGeometry = new THREE.BoxGeometry(cubeSize * 1.2, cubeSize * 1.2, cubeSize * 1.2);
                    const hitboxMaterial = new THREE.MeshBasicMaterial({ 
                        visible: false,
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 0
                    });
                    const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
                    hitbox.userData = cube.userData;
                    hitbox.callback = cube.callback;
                    cube.hitbox = hitbox;
                    scene.add(hitbox);
                    hitbox.position.copy(cube.position);

                    // Add subtle wireframe
                    const wireframe = new THREE.LineSegments(
                        new THREE.EdgesGeometry(hitboxGeometry),
                        new THREE.LineBasicMaterial({ 
                            color: 0x000000,
                            transparent: true,
                            opacity: 0.2,
                            linewidth: 1
                        })
                    );
                    wireframe.scale.set(0.95, 0.95, 0.95);
                    cube.add(wireframe);

                    addPhysicsProperties(cube);
                }
            }
        }
    }

    function createPlayerSymbol(type) {
        // Symbol configuration - easy to adjust values
        const config = {
            // Position offset from cube center to face
            faceOffset: 1.0,
            
            // X symbol configuration
            x: {
                size: 2.0,        // Length of X lines
                thickness: 0.2,   // Thicker lines
                depth: 0.2       // Keep thin depth
            },
            
            // O symbol configuration
            o: {
                radius: 0.8,      // Much larger radius
                thickness: 0.1,   // Thicker ring
                segments: 32      // More segments for smoother circle
            }
        };

        // Common face positions using config
        const positions = [
            { pos: [0, 0, config.faceOffset], rot: [0, 0, 0] },           // front
            { pos: [0, 0, -config.faceOffset], rot: [0, Math.PI, 0] },    // back
            { pos: [config.faceOffset, 0, 0], rot: [0, Math.PI/2, 0] },   // right
            { pos: [-config.faceOffset, 0, 0], rot: [0, -Math.PI/2, 0] }, // left
            { pos: [0, config.faceOffset, 0], rot: [-Math.PI/2, 0, 0] },  // top
            { pos: [0, -config.faceOffset, 0], rot: [Math.PI/2, 0, 0] }   // bottom
        ];

        if (type === 'X') {
            const group = new THREE.Group();
            
            positions.forEach(({pos, rot}) => {
                const xGeometry = new THREE.BoxGeometry(
                    config.x.size, 
                    config.x.thickness, 
                    config.x.depth
                );
                const xMaterial = new THREE.MeshPhysicalMaterial({ 
                    color: 0xff0000,
                    metalness: 0.8,
                    roughness: 0.2,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    reflectivity: 1.0,
                    emissive: 0xff0000,
                    emissiveIntensity: 0.5
                });
                
                const line1 = new THREE.Mesh(xGeometry, xMaterial);
                line1.rotation.z = Math.PI / 4;
                
                const line2 = new THREE.Mesh(xGeometry, xMaterial);
                line2.rotation.z = -Math.PI / 4;
                
                const faceGroup = new THREE.Group();
                faceGroup.add(line1);
                faceGroup.add(line2);
                
                faceGroup.position.set(...pos);
                faceGroup.rotation.set(...rot);
                
                group.add(faceGroup);
            });

            return group;
        } else {
            const group = new THREE.Group();
            
            positions.forEach(({pos, rot}) => {
                const geometry = new THREE.TorusGeometry(
                    config.o.radius,
                    config.o.thickness,
                    config.o.segments,
                    config.o.segments
                );
                const material = new THREE.MeshPhysicalMaterial({ 
                    color: 0x0000ff,
                    metalness: 0.8,
                    roughness: 0.2,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    reflectivity: 1.0,
                    emissive: 0x0000ff,
                    emissiveIntensity: 0.5
                });
                const torus = new THREE.Mesh(geometry, material);
                torus.position.set(...pos);
                torus.rotation.set(...rot);
                group.add(torus);
            });
            
            return group;
        }
    }

    // Sound setup
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    function createClickSound() {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    }
    
    function createWinSound() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create multiple oscillators for a richer sound
        const frequencies = [440, 554.37, 659.25, 880];
        const oscillators = frequencies.map(() => audioContext.createOscillator());
        const gainNodes = frequencies.map(() => audioContext.createGain());
        
        oscillators.forEach((osc, i) => {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequencies[i], audioContext.currentTime);
            osc.connect(gainNodes[i]);
            gainNodes[i].connect(audioContext.destination);
            
            // Create an ascending arpeggio effect
            gainNodes[i].gain.setValueAtTime(0, audioContext.currentTime);
            gainNodes[i].gain.linearRampToValueAtTime(0.2, audioContext.currentTime + i * 0.1);
            gainNodes[i].gain.linearRampToValueAtTime(0, audioContext.currentTime + i * 0.1 + 0.3);
            
            osc.start();
            osc.stop(audioContext.currentTime + 1);
        });
    }

    function createFireworkSound(frequency = 440, volume = 0.3) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Pop sound
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        // Add noise burst for more realistic pop
        const bufferSize = audioContext.sampleRate * 0.1;
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
            data[i] *= 1 - i / bufferSize; // Fade out
        }
        
        const noise = audioContext.createBufferSource();
        const noiseGain = audioContext.createGain();
        noise.buffer = buffer;
        noiseGain.gain.setValueAtTime(volume * 0.5, audioContext.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
        
        oscillator.connect(gainNode);
        noise.connect(noiseGain);
        gainNode.connect(audioContext.destination);
        noiseGain.connect(audioContext.destination);
        
        oscillator.start();
        noise.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    }

    function createParticleTrail(position, color) {
        const trailGeometry = new THREE.SphereGeometry(0.01, 8, 8);
        const trailMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.5
        });
        const trail = new THREE.Mesh(trailGeometry, trailMaterial);
        trail.position.copy(position);
        trail.birthTime = Date.now();
        trail.lifetime = 500; // Shorter lifetime for trails
        return trail;
    }

    function createFirework(position, color = null) {
        const shellCount = 8;
        const linesPerShell = 25;
        const colors = [
            0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff,
            0xff8800, 0xff0088, 0x8800ff, 0xffffff, 0xffcc00, 0x00ffcc
        ];
        const mainColor = color || colors[Math.floor(Math.random() * colors.length)];
        
        const firework = new THREE.Group();
        
        // Create quick, bright flash
        const flashGeometry = new THREE.SphereGeometry(1.0, 16, 16);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: mainColor,
            transparent: true,
            opacity: 0.6,  // More transparent
            emissive: mainColor,
            emissiveIntensity: 1
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        flash.scale.set(0.3, 0.3, 0.3);
        flash.userData.isFlash = true;
        flash.userData.birthTime = Date.now();
        firework.add(flash);

        // Create shell groups
        for (let s = 0; s < shellCount; s++) {
            const shellGroup = new THREE.Group();
            const shellAngle = (s / shellCount) * Math.PI * 2;
            const shellElevation = Math.random() * Math.PI;
            
            for (let i = 0; i < linesPerShell; i++) {
                const curvePoints = 30;
                const lineLength = 0.8 + Math.random() * 0.3;  // Smaller lines
                
                const curve = new THREE.CubicBezierCurve3(
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(
                        (Math.random() - 0.5) * 0.5,
                        lineLength * 0.33,
                        (Math.random() - 0.5) * 0.5
                    ),
                    new THREE.Vector3(
                        (Math.random() - 0.5) * 0.8,
                        lineLength * 0.66,
                        (Math.random() - 0.5) * 0.8
                    ),
                    new THREE.Vector3(
                        (Math.random() - 0.5) * 1.0,
                        lineLength,
                        (Math.random() - 0.5) * 1.0
                    )
                );
                
                const curvePoints3D = curve.getPoints(curvePoints);
                const positions = new Float32Array(curvePoints3D.length * 3);
                
                curvePoints3D.forEach((point, index) => {
                    positions[index * 3] = point.x;
                    positions[index * 3 + 1] = point.y;
                    positions[index * 3 + 2] = point.z;
                });
                
                const lineGeometry = new THREE.BufferGeometry();
                lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

                // Create color variation within the same burst
                const colorVariation = 0.2;
                const lineColor = new THREE.Color(mainColor);
                lineColor.r = Math.min(1, lineColor.r + (Math.random() - 0.5) * colorVariation);
                lineColor.g = Math.min(1, lineColor.g + (Math.random() - 0.5) * colorVariation);
                lineColor.b = Math.min(1, lineColor.b + (Math.random() - 0.5) * colorVariation);
                
                const lineMaterial = new THREE.LineBasicMaterial({
                    color: lineColor,
                    transparent: true,
                    opacity: 1,
                    linewidth: 1.5  // Thinner lines
                });

                const line = new THREE.Line(lineGeometry, lineMaterial);
                
                const lineAngle = shellAngle + (i / linesPerShell) * Math.PI * 0.5 + Math.random() * 0.2;
                const lineElevation = shellElevation + (Math.random() - 0.5) * 0.5;
                
                const direction = new THREE.Vector3(
                    Math.cos(lineAngle) * Math.sin(lineElevation),
                    Math.cos(lineElevation),
                    Math.sin(lineAngle) * Math.sin(lineElevation)
                );
                
                line.position.copy(position);
                
                line.quaternion.setFromUnitVectors(
                    new THREE.Vector3(0, 1, 0), 
                    direction
                );
                
                // Faster initial velocity for better spread
                const speed = 5 + Math.random() * 3;
                line.velocity = direction.multiplyScalar(speed);
                
                line.angularVelocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2
                );

                line.gravity = -0.15;  // Keep same gravity
                line.drag = 0.98;      // Keep same drag
                line.birthTime = Date.now();
                line.lifetime = 800 + Math.random() * 400; // Shorter lifetime
                
                shellGroup.add(line);
            }
            
            firework.add(shellGroup);
        }

        try {
            createFireworkSound(440 + Math.random() * 220, 0.8);
        } catch (e) {
            console.log('Sound playback failed:', e);
        }
        
        scene.add(firework);
        return firework;
    }

    function createFireworkGroup(centerPosition, pattern = 'circle') {
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        switch (pattern) {
            case 'circle':
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2;
                    const radius = 2;
                    const position = new THREE.Vector3(
                        centerPosition.x + Math.cos(angle) * radius,
                        centerPosition.y,
                        centerPosition.z + Math.sin(angle) * radius
                    );
                    setTimeout(() => {
                        const firework = createFirework(position, color);
                        activeFireworks.push(firework);
                    }, i * 100);
                }
                break;
                
            case 'cascade':
                for (let i = 0; i < 5; i++) {
                    const position = new THREE.Vector3(
                        centerPosition.x + (Math.random() - 0.5) * 4,
                        centerPosition.y - i,
                        centerPosition.z + (Math.random() - 0.5) * 4
                    );
                    setTimeout(() => {
                        const firework = createFirework(position, color);
                        activeFireworks.push(firework);
                    }, i * 200);
                }
                break;
        }
    }

    function updateFireworks() {
        const now = Date.now();
        
        activeFireworks.forEach((firework, index) => {
            let shouldRemove = true;
            
            firework.children.forEach((child) => {
                if (child.userData.isFlash) {
                    const age = now - child.userData.birthTime;
                    if (age < 100) {  // Shorter flash duration (was 200)
                        const scale = Math.min(1 + age / 30, 1.5);  // Faster expansion
                        child.scale.set(scale, scale, scale);
                        child.material.opacity = 0.6 * (1 - (age / 100));  // Start more transparent
                        shouldRemove = false;
                    }
                    return;
                }

                if (child instanceof THREE.Line) {
                    // Apply gravity
                    child.velocity.y += child.gravity * 0.016;
                    child.velocity.multiplyScalar(child.drag);
                    child.position.add(child.velocity);
                    
                    // Update rotation
                    child.rotation.x += child.angularVelocity.x;
                    child.rotation.y += child.angularVelocity.y;
                    child.rotation.z += child.angularVelocity.z;
                    
                    // Update opacity based on lifetime
                    const age = now - child.birthTime;
                    if (age < child.lifetime) {
                        shouldRemove = false;
                        const fadeStart = child.lifetime * 0.5;  // Start fading earlier
                        if (age > fadeStart) {
                            const fadeProgress = (age - fadeStart) / (child.lifetime - fadeStart);
                            child.material.opacity = 1 - fadeProgress;
                        }
                    } else {
                        child.material.opacity = 0;
                    }
                }
            });
            
            if (shouldRemove) {
                scene.remove(firework);
                activeFireworks.splice(index, 1);
            }
        });
    }

    function startVictoryAnimation() {
        cubes.forEach((cube, index) => {
            cube.isPhysicsEnabled = true;
            cube.isOrbiting = true;
            // Set different orbit radiuses and speeds for each cube
            cube.orbitRadius = 2 + (index % 3);
            cube.orbitSpeed = 0.5 + (Math.random() * 0.5);
            cube.orbitOffset = (Math.PI * 2 * index) / cubes.length;
            cube.orbitHeight = -1 + Math.random() * 2;  // Random height offset
            // Initial position in orbit
            cube.orbitAngle = cube.orbitOffset;
        });
        showRestartButton();
    }

    function updateCubePhysics() {
        if (!cubes.length) return;  // Skip if no cubes exist yet
        
        cubes.forEach(cube => {
            if (cube.isPhysicsEnabled) {
                // Calculate vector to center (gravity point)
                const toCenter = new THREE.Vector3(0, 0, 0).sub(cube.position);
                const distanceToCenter = toCenter.length();
                
                // Even weaker gravity effect
                const gravityForce = toCenter.normalize().multiplyScalar(0.01);
                
                // Add tangential velocity for orbital motion
                const tangent = new THREE.Vector3(
                    -cube.position.z,
                    0,
                    cube.position.x
                ).normalize();
                
                // Apply forces
                cube.velocity.add(gravityForce);
                
                // Much slower orbital velocity
                if (cube.velocity.length() < 0.05) {
                    const orbitalSpeed = 0.02 + Math.random() * 0.02;
                    cube.velocity.add(tangent.multiplyScalar(orbitalSpeed));
                }
                
                // More damping for even slower movement
                cube.velocity.multiplyScalar(0.99);
                cube.position.add(cube.velocity);
                
                // Gentler boundary forces
                if (distanceToCenter < 2) {
                    const pushOut = toCenter.normalize().multiplyScalar(-0.02);
                    cube.velocity.add(pushOut);
                } else if (distanceToCenter > 4) {
                    const pullIn = toCenter.normalize().multiplyScalar(0.02);
                    cube.velocity.add(pullIn);
                }
                
                // Much slower rotation
                cube.rotation.x += cube.velocity.length() * 0.02;
                cube.rotation.y += cube.velocity.length() * 0.02;
                cube.rotation.z += cube.velocity.length() * 0.02;
                
                // Update hitbox
                if (cube.hitbox) {
                    cube.hitbox.position.copy(cube.position);
                    cube.hitbox.rotation.copy(cube.rotation);
                }
            }
        });
    }

    function showRestartButton() {
        const restartButton = document.createElement('button');
        restartButton.textContent = 'Play Again';
        restartButton.style.position = 'fixed';
        restartButton.style.top = window.innerWidth <= 768 ? '80%' : '70%';
        restartButton.style.left = '50%';
        restartButton.style.transform = 'translate(-50%, -50%)';
        restartButton.style.padding = window.innerWidth <= 768 ? '12px 24px' : '15px 30px';
        restartButton.style.fontSize = window.innerWidth <= 768 ? '20px' : '24px';
        restartButton.style.backgroundColor = '#4CAF50';
        restartButton.style.color = 'white';
        restartButton.style.border = 'none';
        restartButton.style.borderRadius = '5px';
        restartButton.style.cursor = 'pointer';
        restartButton.style.zIndex = '1000';
        restartButton.style.transition = 'background-color 0.3s';
        
        restartButton.onmouseover = () => {
            restartButton.style.backgroundColor = '#45a049';
        };
        
        restartButton.onmouseout = () => {
            restartButton.style.backgroundColor = '#4CAF50';
        };
        
        restartButton.onclick = () => {
            resetGame();
            restartButton.remove();
        };
        
        document.body.appendChild(restartButton);
    }

    function resetGame() {
        // Reset game state
        gameState.board = Array(3).fill().map(() => Array(3).fill().map(() => Array(3).fill(null)));
        gameState.currentPlayer = 'X';
        gameState.isGameOver = false;

        // Reset cubes
        cubes.forEach((cube, index) => {
            // Calculate original position
            const z = Math.floor(index / 9);
            const y = Math.floor((index % 9) / 3);
            const x = index % 3;
            
            // Reset position and rotation
            cube.position.set(
                (x * offset - centerOffset),
                (y * offset - centerOffset),
                (z * offset - centerOffset)
            );
            cube.rotation.set(0, 0, 0);
            
            // Reset physics properties
            cube.isPhysicsEnabled = false;
            cube.velocity = new THREE.Vector3(0, 0, 0);
            
            // Reset hitbox
            if (cube.hitbox) {
                cube.hitbox.position.copy(cube.position);
                cube.hitbox.rotation.set(0, 0, 0);
            }
            
            // Remove all children except wireframe
            cube.children = cube.children.filter(child => child instanceof THREE.LineSegments);
            
            // Reset material
            cube.material.color.set(0xffffff);
            cube.material.opacity = 0.8;
        });

        // Reset UI
        updateStatus();
        winnerOverlay.style.opacity = '0';
    }

    function celebrateWin() {
        createWinSound();
        showWinnerMessage(gameState.currentPlayer);
        startVictoryAnimation();
    }

    function checkWin(lastX, lastY, lastZ) {
        const player = gameState.currentPlayer;
        const board = gameState.board;

        // Helper function to check a line
        const checkLine = (coords) => {
            return coords.every(([x, y, z]) => board[z][y][x] === player);
        };

        // All possible lines through the last played position
        const lines = [
            // Row
            [[0, lastY, lastZ], [1, lastY, lastZ], [2, lastY, lastZ]],
            // Column
            [[lastX, 0, lastZ], [lastX, 1, lastZ], [lastX, 2, lastZ]],
            // Depth
            [[lastX, lastY, 0], [lastX, lastY, 1], [lastX, lastY, 2]],
            
            // Diagonals in the XY plane
            [[0, 0, lastZ], [1, 1, lastZ], [2, 2, lastZ]],
            [[2, 0, lastZ], [1, 1, lastZ], [0, 2, lastZ]],
            
            // Diagonals in the XZ plane
            [[0, lastY, 0], [1, lastY, 1], [2, lastY, 2]],
            [[2, lastY, 0], [1, lastY, 1], [0, lastY, 2]],
            
            // Diagonals in the YZ plane
            [[lastX, 0, 0], [lastX, 1, 1], [lastX, 2, 2]],
            [[lastX, 2, 0], [lastX, 1, 1], [lastX, 0, 2]],
            [[0, 2, 0], [1, 1, 1], [2, 0, 2]],
            [[2, 2, 0], [1, 1, 1], [0, 0, 2]],

            // 3D diagonals across the cube
            [[0, 0, 0], [1, 1, 1], [2, 2, 2]],
            [[2, 0, 0], [1, 1, 1], [0, 2, 2]]
        ];

        return lines.some(checkLine);
    }

    // Add winner overlay
    const winnerOverlay = document.createElement('div');
    winnerOverlay.id = 'winner-overlay';
    winnerOverlay.style.position = 'fixed';
    winnerOverlay.style.top = '50%';
    winnerOverlay.style.left = '50%';
    winnerOverlay.style.transform = 'translate(-50%, -50%)';
    winnerOverlay.style.padding = window.innerWidth <= 768 ? '15px 30px' : '20px 40px';
    winnerOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    winnerOverlay.style.color = '#fff';
    winnerOverlay.style.borderRadius = '10px';
    winnerOverlay.style.fontSize = window.innerWidth <= 768 ? '24px' : '32px';
    winnerOverlay.style.fontWeight = 'bold';
    winnerOverlay.style.opacity = '0';
    winnerOverlay.style.transition = 'opacity 0.5s ease-in-out';
    winnerOverlay.style.pointerEvents = 'none';
    winnerOverlay.style.textAlign = 'center';
    winnerOverlay.style.zIndex = '1000';
    winnerOverlay.style.margin = '0';
    winnerOverlay.style.width = 'auto';
    winnerOverlay.style.height = 'auto';
    document.body.appendChild(winnerOverlay);

    function showWinnerMessage(winner) {
        winnerOverlay.textContent = `Player ${winner} Wins!`;
        winnerOverlay.style.color = winner === 'X' ? '#ff6666' : '#6666ff';
        winnerOverlay.style.opacity = '1';
        
        // Fade out after 3 seconds
        setTimeout(() => {
            winnerOverlay.style.opacity = '0';
        }, 3000);
    }

    function showDrawMessage() {
        winnerOverlay.textContent = 'It\'s a Draw!';
        winnerOverlay.style.color = '#ffffff';
        winnerOverlay.style.opacity = '1';
        
        // Fade out after 3 seconds
        setTimeout(() => {
            winnerOverlay.style.opacity = '0';
        }, 3000);
    }

    function handleCellClick(cube) {
        const { x, y, z } = cube.userData;
        
        // Check if cell is already taken or game is over
        if (gameState.board[z][y][x] !== null || gameState.isGameOver) {
            return;
        }

        // Play click sound
        createClickSound();

        // Update game state
        gameState.board[z][y][x] = gameState.currentPlayer;
        
        // Remove any existing symbols (keeping wireframe)
        cube.children = cube.children.filter(child => child instanceof THREE.LineSegments);
        
        // Add player symbol
        const symbol = createPlayerSymbol(gameState.currentPlayer);
        cube.add(symbol);

        // Keep cube transparent
        cube.material.opacity = 0.6;

        // Check for win
        if (checkWin(x, y, z)) {
            celebrateWin();
            showWinnerMessage(gameState.currentPlayer);
            gameState.isGameOver = true;
            startCubePhysics(); // Start physics when game is won
            return;
        }

        // Check for draw
        if (checkDraw()) {
            showDrawMessage();
            gameState.isGameOver = true;
            return;
        }

        // Switch player
        gameState.currentPlayer = (gameState.currentPlayer === 'X') ? 'O' : 'X';
        updateStatus();
    }

    function checkDraw() {
        return gameState.board.flat(2).every(cell => cell !== null);
    }

    function updateStatus() {
        const status = document.getElementById('status');
        status.textContent = `Current Player: ${gameState.currentPlayer}`;
        status.style.color = gameState.currentPlayer === 'X' ? '#ff0000' : '#0000ff';
        status.style.fontSize = '24px';
        status.style.fontWeight = 'bold';
    }

    function animate() {
        requestAnimationFrame(animate);
        
        const time = performance.now() / 1000;
        
        // Update shader time
        backgroundShader.uniforms.time.value = time;
        
        // Update physics
        updateCubePhysics();
        
        // Update fireworks
        updateFireworks();
        
        // Clear everything
        renderer.clear();
        
        // Render background first
        renderer.render(backgroundScene, backgroundCamera);
        
        // Then render the scene without clearing
        renderer.render(scene, camera);
        
        controls.update();
    }

    animate();

    // Add click event listener
    window.addEventListener('mouseup', (event) => {
        if (event.button !== 0) return; // Only handle left click

        // If it was a quick click (not a drag), try to place a marker
        if (!isDragging && Date.now() - mouseDownTime < 200) {
            const mouse = new THREE.Vector2();
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            raycaster.params.Line.threshold = 0.1;
            raycaster.params.Points.threshold = 0.1;
            raycaster.params.Mesh.threshold = 0.1;

            // First, try to intersect with hitboxes
            const hitboxIntersects = raycaster.intersectObjects(cubes.map(cube => cube.hitbox));
            if (hitboxIntersects.length > 0) {
                const targetCube = cubes.find(cube => 
                    cube.userData.x === hitboxIntersects[0].object.userData.x &&
                    cube.userData.y === hitboxIntersects[0].object.userData.y &&
                    cube.userData.z === hitboxIntersects[0].object.userData.z
                );
                if (targetCube && targetCube.callback) {
                    targetCube.callback(targetCube);
                }
                return;
            }

            // If no hitbox was hit, try the regular cubes
            const intersects = raycaster.intersectObjects(cubes, true);
            if (intersects.length > 0) {
                let targetCube = intersects[0].object;
                while (targetCube && !targetCube.userData.hasOwnProperty('x')) {
                    targetCube = targetCube.parent;
                }
                if (targetCube && targetCube.callback) {
                    targetCube.callback(targetCube);
                }
            }
        }

        mouseDownTime = 0;
        isDragging = false;
        isRotating = false;
    });

    // Modify the mousemove event listener for better hover detection
    window.addEventListener('mousemove', (event) => {
        const mouse = new THREE.Vector2();
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        raycaster.params.Line.threshold = 0.1;
        raycaster.params.Points.threshold = 0.1;
        raycaster.params.Mesh.threshold = 0.1;

        // First check hitboxes for hover
        const hitboxIntersects = raycaster.intersectObjects(cubes.map(cube => cube.hitbox));
        
        // Reset all cube colors
        cubes.forEach(cube => {
            if (!cube.children.find(child => child.type !== 'LineSegments')) {
                cube.material.color.set(0xffffff);
                cube.material.opacity = 0.8;
            }
        });

        // Highlight hovered cube using hitbox detection
        if (hitboxIntersects.length > 0) {
            const targetCube = cubes.find(cube => 
                cube.userData.x === hitboxIntersects[0].object.userData.x &&
                cube.userData.y === hitboxIntersects[0].object.userData.y &&
                cube.userData.z === hitboxIntersects[0].object.userData.z
            );
            if (targetCube && !targetCube.children.find(child => child.type !== 'LineSegments')) {
                targetCube.material.color.set(0xe0e0e0);
                targetCube.material.opacity = 1.0;
            }
        }
    });

    // Add status display
    const status = document.createElement('div');
    status.id = 'status';
    status.style.position = 'fixed';
    status.style.top = '20px';
    status.style.left = '50%';
    status.style.transform = 'translateX(-50%)';
    status.style.padding = '10px 20px';
    status.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    status.style.borderRadius = '5px';
    status.style.zIndex = '1000';
    status.style.fontFamily = 'Arial, sans-serif';
    document.body.appendChild(status);
    updateStatus();

    function startCubePhysics() {
        cubes.forEach((cube, index) => {
            cube.isPhysicsEnabled = true;
            
            // Calculate initial position on a sphere
            const phi = Math.acos(-1 + (2 * index) / cubes.length);
            const theta = Math.sqrt(cubes.length * Math.PI) * phi;
            
            // Set initial velocity tangent to the sphere (much slower)
            const tangent = new THREE.Vector3(
                -Math.sin(theta) * Math.sin(phi),
                Math.cos(theta),
                -Math.sin(theta) * Math.cos(phi)
            );
            
            // Minimal initial velocity
            cube.velocity = tangent.multiplyScalar(0.05 + Math.random() * 0.02);
            cube.velocity.add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.02,
                (Math.random() - 0.5) * 0.02,
                (Math.random() - 0.5) * 0.02
            ));
        });
    }

    // Adjust camera for perfect centering
    function setupCamera() {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            camera.position.set(7, 6, 9);  // Adjusted for better mobile view
            camera.fov = 55;  // Slightly reduced FOV for better depth perception
        } else {
            camera.position.set(4, 3.5, 5.5);
            camera.fov = 45;
        }
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        // Adjust controls based on device
        controls.minDistance = isMobile ? 12 : 7;
        controls.maxDistance = isMobile ? 12 : 7;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.rotateSpeed = isMobile ? 0.8 : 0.5;
        controls.enablePan = false;
        controls.enableZoom = false;
    }

    setupCamera();

    // Add touch event handling for mobile
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    window.addEventListener('touchstart', (event) => {
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        touchStartTime = Date.now();
        isDragging = false;
    }, { passive: true });

    window.addEventListener('touchmove', (event) => {
        const deltaX = event.touches[0].clientX - touchStartX;
        const deltaY = event.touches[0].clientY - touchStartY;
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            isDragging = true;
        }
    }, { passive: true });

    window.addEventListener('touchend', (event) => {
        if (!isDragging && (Date.now() - touchStartTime) < 200) {
            // Convert touch to mouse coordinates
            const touch = event.changedTouches[0];
            const mouseEvent = new MouseEvent('mouseup', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                button: 0
            });
            window.dispatchEvent(mouseEvent);
        }
    }, { passive: true });

    // Adjust winner overlay for mobile
    winnerOverlay.style.fontSize = window.innerWidth <= 768 ? '24px' : '32px';
    winnerOverlay.style.padding = window.innerWidth <= 768 ? '15px 30px' : '20px 40px';
}); 