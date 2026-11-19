// =====================================================================
// SIMULATION.JS - MUNCHIES 3D FRANCHISE SIMULATOR
// ALL EVENT LISTENERS INSIDE DOMContentLoaded - GUARANTEED NO RACE CONDITIONS
// =====================================================================

let scene, camera, renderer;
let currentModel = null;
let currentMode = 'walkthrough';
let isPointerLocked = false;
let yaw = 0, pitch = 0;
let lastTime = performance.now();

const STATE = {
    eyeHeight: 1.65,
    playerPos: new THREE.Vector3(0, 0, 8),
    moveSpeed: 4.5,
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    grabItem: null,
    currentOutlet: 'outlet_3'
};

const OUTLETS = {
    'outlet_1': { name: 'Kontainer', file: 'outlet_1.glb', spawn: new THREE.Vector3(0, 1.65, -4.5) },
    'outlet_2': { name: 'Ruko', file: 'outlet_2.glb', spawn: new THREE.Vector3(0, 1.65, -5.5) },
    'outlet_3': { name: 'Restoran', file: 'outlet_3.glb', spawn: new THREE.Vector3(0, 1.65, -14) }
};

const HOTSPOTS = [
    { name: 'reception', title: 'Resepsionis', desc: 'Area penyambutan franchise Premium dengan brand ambassador terlatih.' },
    { name: 'umkm', title: 'UMKM Lokal', desc: 'Kemitraan dengan UMKM lokal untuk bahan baku berkualitas.' },
    { name: 'export', title: 'Ekspor', desc: 'Sertifikasi halal & HACCP untuk ekspansi ASEAN.' },
    { name: 'consult_a', title: 'Konsultasi A', desc: 'Perencanaan usaha & proyeksi finansial 5 tahun.' },
    { name: 'consult_b', title: 'Konsultasi B', desc: 'Pelatihan operasional lengkap & standardisasi produk.' },
    { name: 'presentation', title: 'Presentasi', desc: 'Pitch deck visi brand Munchies dengan paket franchise.' }
];

let walkableRamp = null;
let collidableObjects = [];
let grabableObjects = [];
const raycaster = new THREE.Raycaster();

// =====================================================================
// CORE FUNCTIONS - NO DOM DEPENDENCY
// =====================================================================

function initScene() {
    const container = document.getElementById('canvas-container');
    if (!container) {
        console.error('❌ canvas-container tidak ditemukan');
        return false;
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF8F2E6);
    scene.fog = new THREE.Fog(0xF8F2E6, 50, 150);

    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(STATE.playerPos.x, STATE.eyeHeight, STATE.playerPos.z);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xFFF5E4, 0.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xFFEECC, 1.2);
    keyLight.position.set(30, 40, 25);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.far = 100;
    keyLight.shadow.camera.left = -50;
    keyLight.shadow.camera.right = 50;
    keyLight.shadow.camera.top = 50;
    keyLight.shadow.camera.bottom = -50;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x9AD1D4, 0.4);
    fillLight.position.set(-20, 20, -20);
    scene.add(fillLight);

    console.log('✅ Scene initialized successfully');
    return true;
}

function loadOutlet(outletKey) {
    const loading = document.getElementById('loadingOverlay');
    const error = document.getElementById('errorOverlay');
    loading.style.display = 'flex';
    error.style.display = 'none';

    const loader = new GLTFLoader();
    const outlet = OUTLETS[outletKey];

    loader.load(
        outlet.file,
        (gltf) => {
            if (currentModel) scene.remove(currentModel);
            
            currentModel = gltf.scene;
            scene.add(currentModel);

            walkableRamp = null;
            collidableObjects = [];
            grabableObjects = [];

            currentModel.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;

                    if (node.name.includes('WALKABLE_Stair_Smooth_Ramp')) {
                        walkableRamp = node;
                    }
                    if (node.name.includes('Dinding') || node.name.includes('Tiang') || node.name.includes('Pilar') || node.name.includes('Counter')) {
                        collidableObjects.push(node);
                    }
                    if (node.name.includes('GRAB_')) {
                        grabableObjects.push(node);
                    }
                }
            });

            STATE.playerPos.copy(outlet.spawn);
            camera.position.copy(STATE.playerPos);
            STATE.grabItem = null;
            closeInspection();

            loading.style.display = 'none';
            updateOutletButtons(outletKey);
            console.log(`✅ Loaded outlet: ${outlet.name}`);
        },
        (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            document.querySelector('.loading-overlay p').textContent = `Memuat ${outlet.name}... ${percent}%`;
        },
        (error) => {
            console.error('❌ Model load error:', error);
            document.getElementById('errorMessage').textContent = `Gagal memuat ${outlet.file}. Pastikan file ada di folder yang sama dengan simulation.html`;
            document.getElementById('errorOverlay').style.display = 'flex';
            loading.style.display = 'none';
        }
    );
}

function checkCollision(position, direction) {
    if (!currentModel) return false;
    raycaster.set(position, direction.normalize());
    const intersects = raycaster.intersectObjects(collidableObjects, true);
    return intersects.length > 0 && intersects[0].distance < 0.5;
}

function checkWalkableHeight(position) {
    if (!walkableRamp) return null;
    raycaster.set(position, new THREE.Vector3(0, -1, 0));
    const intersects = raycaster.intersectObject(walkableRamp, true);
    if (intersects.length > 0) {
        return intersects[0].point.y;
    }
    return null;
}

function raycastForGrab() {
    if (!camera) return null;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(grabableObjects, true);
    if (intersects.length > 0) {
        return intersects[0].object;
    }
    return null;
}

function grabItemAction() {
    const item = raycastForGrab();
    if (item) {
        STATE.grabItem = item;
        showInspection(item);
    }
}

function setCameraMode(mode) {
    currentMode = mode;
    
    if (mode === 'walkthrough') {
        STATE.playerPos.copy(OUTLETS[STATE.currentOutlet].spawn);
        camera.position.copy(STATE.playerPos);
    } else if (mode === 'orbit') {
        isPointerLocked = false;
        if (document.exitPointerLock) document.exitPointerLock();
        camera.position.set(10, 10, 10);
        camera.lookAt(0, 0, 2);
    } else if (mode === 'topdown') {
        isPointerLocked = false;
        if (document.exitPointerLock) document.exitPointerLock();
        camera.position.set(0, 50, 0);
        camera.lookAt(0, 0, 0);
    }

    updateModeButtons(mode);
}

function updateOutletButtons(active) {
    document.querySelectorAll('.outlet-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.outlet === active);
    });
}

function updateModeButtons(active) {
    document.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.mode === active);
    });
}

function showInspection(item) {
    const panel = document.getElementById('inspectionPanel');
    const name = document.getElementById('itemName');
    const desc = document.getElementById('itemDescription');
    
    name.textContent = item.name.replace('GRAB_', '').replace(/_/g, ' ');
    desc.textContent = 'Item ini dapat diinteraksi. Klik "Kembalikan" untuk melepas.';
    
    panel.style.display = 'block';
}

function closeInspection() {
    document.getElementById('inspectionPanel').style.display = 'none';
    STATE.grabItem = null;
}

function returnItem() {
    closeInspection();
}

function openHotspot(idx) {
    const hs = HOTSPOTS[idx];
    document.getElementById('hotspotTitle').textContent = hs.title;
    document.getElementById('hotspotInfo').textContent = hs.desc;
    document.getElementById('hotspotModal').style.display = 'flex';
}

function closeHotspot() {
    document.getElementById('hotspotModal').style.display = 'none';
}

function closeHelp() {
    document.getElementById('helpModal').style.display = 'none';
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    if (camera && renderer) {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    if (!camera || !renderer) return;

    const now = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.016);
    lastTime = now;

    if (currentMode === 'walkthrough') {
        const moveDir = new THREE.Vector3();
        if (STATE.moveForward) moveDir.z -= 1;
        if (STATE.moveBackward) moveDir.z += 1;
        if (STATE.moveLeft) moveDir.x -= 1;
        if (STATE.moveRight) moveDir.x += 1;

        if (moveDir.length() > 0) {
            moveDir.normalize();
            moveDir.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)));
            moveDir.multiplyScalar(STATE.moveSpeed * delta);

            const newPos = camera.position.clone().add(moveDir);
            if (!checkCollision(newPos, moveDir.normalize())) {
                camera.position.copy(newPos);
            }
        }

        const groundY = checkWalkableHeight(camera.position);
        if (groundY !== null) {
            camera.position.y = groundY + STATE.eyeHeight;
        }
    }

    if (currentMode === 'orbit') {
        const orbitAngle = (now / 1000) * 0.3;
        camera.position.set(Math.cos(orbitAngle) * 25, 12, Math.sin(orbitAngle) * 25);
        camera.lookAt(0, 2, 0);
    }

    renderer.render(scene, camera);
}

// =====================================================================
// ALL EVENT LISTENERS INSIDE DOMContentLoaded
// =====================================================================

window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOMContentLoaded fired - starting initialization...');

    if (!initScene()) {
        console.error('❌ Scene initialization failed');
        return;
    }

    // Keyboard events
    document.addEventListener('keydown', (e) => {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': STATE.moveForward = true; break;
            case 'KeyS': case 'ArrowDown': STATE.moveBackward = true; break;
            case 'KeyA': case 'ArrowLeft': STATE.moveLeft = true; break;
            case 'KeyD': case 'ArrowRight': STATE.moveRight = true; break;
            case 'Escape': 
                if (document.exitPointerLock) document.exitPointerLock();
                break;
            case 'KeyR':
                STATE.playerPos.copy(OUTLETS[STATE.currentOutlet].spawn);
                camera.position.copy(STATE.playerPos);
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': STATE.moveForward = false; break;
            case 'KeyS': case 'ArrowDown': STATE.moveBackward = false; break;
            case 'KeyA': case 'ArrowLeft': STATE.moveLeft = false; break;
            case 'KeyD': case 'ArrowRight': STATE.moveRight = false; break;
        }
    });

    // Mouse move
    document.addEventListener('mousemove', (e) => {
        if (currentMode !== 'walkthrough' || !isPointerLocked) return;
        const sens = 0.002;
        yaw -= e.movementX * sens;
        pitch -= e.movementY * sens;
        pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
        if (camera) {
            camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
        }
    });

    // Pointer lock events
    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = (document.pointerLockElement === renderer.domElement);
    });

    renderer.domElement.addEventListener('click', () => {
        if (currentMode === 'walkthrough' && !isPointerLocked) {
            if (renderer.domElement.requestPointerLock) {
                renderer.domElement.requestPointerLock();
            }
        }
    });

    // Grab action on click
    document.addEventListener('click', (e) => {
        if (currentMode === 'walkthrough' && isPointerLocked) {
            grabItemAction();
        }
    });

    // Outlet button listeners
    document.querySelectorAll('.outlet-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            STATE.currentOutlet = btn.dataset.outlet;
            loadOutlet(btn.dataset.outlet);
        });
    });

    // Mode button listeners
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setCameraMode(btn.dataset.mode);
        });
    });

    // Action buttons
    document.getElementById('resetBtn').addEventListener('click', () => {
        STATE.playerPos.copy(OUTLETS[STATE.currentOutlet].spawn);
        camera.position.copy(STATE.playerPos);
        yaw = 0;
        pitch = 0;
    });

    document.getElementById('helpBtn').addEventListener('click', () => {
        document.getElementById('helpModal').style.display = 'flex';
    });

    // Modal close listeners
    document.getElementById('hotspotModal').addEventListener('click', (e) => {
        if (e.target.id === 'hotspotModal') closeHotspot();
    });

    document.getElementById('helpModal').addEventListener('click', (e) => {
        if (e.target.id === 'helpModal') closeHelp();
    });

    // Window resize
    window.addEventListener('resize', onWindowResize);

    // Initialize scene and start
    setCameraMode('walkthrough');
    loadOutlet('outlet_3');
    animate();

    console.log('✅ Simulasi Munchies Premium berhasil dimuat!');
});

// =====================================================================
// WINDOW FUNCTIONS FOR HTML ONCLICK HANDLERS
// =====================================================================

window.openHotspot = openHotspot;
window.closeHotspot = closeHotspot;
window.closeHelp = closeHelp;
window.returnItem = returnItem;
window.loadOutlet = loadOutlet;
window.setCameraMode = setCameraMode;
