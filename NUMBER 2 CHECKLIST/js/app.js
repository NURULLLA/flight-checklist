// --- Global Variables ---
let scene, camera, renderer, controls, transformControl;
let fuselageMesh;
let palletGroup;
let cargoItems = [];
let currentSelectedBox = null;
let appMode = 'pack';
let currentPalletType = 'pag';

// --- B757-200F Specs ---
const SPECS = {
    floorWidth: 317,
    taperStartHeight: 114.3,
    taperMidHeight: 174.5,
    maxHeight: 208,
    fuselageLength: 1200,
    door: { w: 340, h: 218 }
};

const PALLETS = {
    pag: { w: 317, l: 223, usableW: 303, usableL: 209 },
    pmc: { w: 317, l: 243, usableW: 303, usableL: 229 }
};

const CAR_PRESETS = {
    cayenne: { l: 478, w: 193, h: 170, type: 'suv' },
    phantom: { l: 576, w: 202, h: 165, type: 'sedan' },
    ghost: { l: 550, w: 200, h: 158, type: 'sedan' }
};

const DOOR_X = -SPECS.floorWidth / 2;
const DOOR_Z_CENTER = 0;

init();
animate();

function init() {
    const container = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    const grid = new THREE.GridHelper(2000, 50, 0x555555, 0x333333);
    scene.add(grid);
    scene.add(new THREE.AxesHelper(100));

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.set(400, 500, 400);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(200, 500, 300);
    dirLight.castShadow = true;
    scene.add(dirLight);

    if (THREE.OrbitControls) {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
    }

    if (THREE.TransformControls) {
        transformControl = new THREE.TransformControls(camera, renderer.domElement);
        transformControl.addEventListener('dragging-changed', (event) => {
            if (controls) controls.enabled = !event.value;
        });
        transformControl.addEventListener('change', checkCollision);
        scene.add(transformControl);
    }

    buildFuselage();
    buildDoorVisuals();
    createPalletGroup('pag');
    palletGroup.position.set(-500, 0, 0); // Start Outside

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    renderer.domElement.addEventListener('pointerdown', (event) => {
        if (appMode !== 'pack') return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(palletGroup.children, true);

        if (intersects.length > 0) {
            let selected = intersects[0].object;
            while (selected.parent && selected.parent !== palletGroup) {
                selected = selected.parent;
            }
            if (selected.parent === palletGroup && selected.name !== "PalletBase") {
                selectBox(selected);
            }
        }
    });

    setupUI();

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' && currentSelectedBox && appMode === 'pack') {
            palletGroup.remove(currentSelectedBox);
            cargoItems = cargoItems.filter(b => b !== currentSelectedBox);
            transformControl.detach();
            currentSelectedBox = null;
            checkCollision();
        }
    });
}

function setupUI() {
    const packBtn = document.getElementById('mode-pack-btn');
    const driveBtn = document.getElementById('mode-drive-btn');
    const packDiv = document.getElementById('pack-controls');
    const driveDiv = document.getElementById('drive-controls');
    const toggleGizmoBtn = document.getElementById('toggle-gizmo-btn');

    packBtn.addEventListener('click', () => {
        setMode('pack');
        packBtn.classList.add('active');
        driveBtn.classList.remove('active');
        packDiv.style.display = 'block';
        driveDiv.style.display = 'none';
        transformControl.showY = true;
    });

    driveBtn.addEventListener('click', () => {
        setMode('drive');
        driveBtn.classList.add('active');
        packBtn.classList.remove('active');
        driveDiv.style.display = 'block';
        packDiv.style.display = 'none';
    });

    document.getElementById('pallet-type').addEventListener('change', (e) => {
        createPalletGroup(e.target.value);
    });

    // Auto-fill dims
    document.getElementById('cargo-shape').addEventListener('change', (e) => {
        const val = e.target.value;
        if (CAR_PRESETS[val]) {
            const p = CAR_PRESETS[val];
            document.getElementById('cargo-l').value = p.l;
            document.getElementById('cargo-w').value = p.w;
            document.getElementById('cargo-h').value = p.h;
        }
    });

    document.getElementById('add-box-btn').addEventListener('click', addCargo);
    document.getElementById('clear-all-btn').addEventListener('click', clearCargo);

    // Pack Gizmo Button (Toggle Move/Rotate)
    const packGizmoBtn = document.getElementById('pack-gizmo-btn');
    if (packGizmoBtn) {
        packGizmoBtn.addEventListener('click', () => {
            if (appMode !== 'pack' || !currentSelectedBox) {
                alert("Select a box first!");
                return;
            }

            if (transformControl.mode === 'translate') {
                // Switch to ROTATE
                transformControl.setMode('rotate');
                transformControl.showX = true; // Pitch (Red)
                transformControl.showY = true; // Yaw (Green)
                transformControl.showZ = true; // Roll (Blue) - Why not all for freedom?
                packGizmoBtn.innerText = "Tool: Rotate (Вращение)";
            } else {
                // Switch to MOVE
                transformControl.setMode('translate');
                transformControl.showX = true;
                transformControl.showY = true;
                transformControl.showZ = true;
                packGizmoBtn.innerText = "Tool: Move (Перемещение)";
            }
        });
    }

    // Explicit Rotate Left
    const rotLeft = document.getElementById('rot-left-btn');
    if (rotLeft) {
        rotLeft.addEventListener('click', () => {
            if (appMode !== 'pack' || !currentSelectedBox) { alert("Select cargo!"); return; }
            const q = new THREE.Quaternion();
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 8);
            currentSelectedBox.applyQuaternion(q);
            checkCollision();
        });
    }

    // Explicit Rotate Right
    const rotRight = document.getElementById('rot-right-btn');
    if (rotRight) {
        rotRight.addEventListener('click', () => {
            if (appMode !== 'pack' || !currentSelectedBox) { alert("Select cargo!"); return; }
            const q = new THREE.Quaternion();
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 8);
            currentSelectedBox.applyQuaternion(q);
            checkCollision();
        });
    }

    document.getElementById('reset-pos-btn').addEventListener('click', resetPalletPosition);
    toggleGizmoBtn.addEventListener('click', () => {
        if (appMode !== 'drive') return;
        const current = transformControl.mode;
        const next = current === 'translate' ? 'rotate' : 'translate';
        updateDriveConstraints(next);
        toggleGizmoBtn.innerText = next === 'translate' ? "Switch to Rotate" : "Switch to Move";
    });

    // Auto Sim
    document.getElementById('auto-sim-btn').addEventListener('click', runSmartSimulation);
}

function updateDriveConstraints(mode) {
    transformControl.setMode(mode);
    if (mode === 'translate') {
        transformControl.showX = true;
        transformControl.showY = false;
        transformControl.showZ = true;
    } else {
        transformControl.showX = false;
        transformControl.showY = true;
        transformControl.showZ = false;
    }
}

function setMode(mode) {
    appMode = mode;
    transformControl.detach();
    currentSelectedBox = null;

    if (mode === 'drive') {
        if (palletGroup) {
            transformControl.attach(palletGroup);
            updateDriveConstraints('translate');
        }
    } else {
        transformControl.setMode('translate');
        transformControl.showX = true;
        transformControl.showY = true;
        transformControl.showZ = true;
    }
}

function createPalletGroup(type) {
    if (palletGroup) {
        scene.remove(palletGroup);
        cargoItems = [];
    }

    currentPalletType = type;
    palletGroup = new THREE.Group();
    scene.add(palletGroup);

    const pData = PALLETS[type];
    if (!pData) return;

    const baseGeo = new THREE.BoxGeometry(pData.w, 5, pData.l);
    const baseMat = new THREE.MeshBasicMaterial({ color: 0x999999 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 2.5;
    base.name = "PalletBase";
    palletGroup.add(base);

    const usGeo = new THREE.PlaneGeometry(pData.usableW, pData.usableL);
    const usMat = new THREE.MeshBasicMaterial({ color: 0xFFFF00, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
    const usInfo = new THREE.Mesh(usGeo, usMat);
    usInfo.rotation.x = -Math.PI / 2;
    usInfo.position.y = 5.1;
    palletGroup.add(usInfo);

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(pData.w, 2, pData.l));
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xFFFFFF }));
    line.position.y = 1;
    palletGroup.add(line);

    // Start Outside
    palletGroup.position.set(-500, 0, 0);

    if (appMode === 'drive') {
        transformControl.attach(palletGroup);
        updateDriveConstraints('translate');
    }
}

function resetPalletPosition() {
    if (!palletGroup) return;
    palletGroup.position.set(-500, 0, 0);
    palletGroup.rotation.set(0, 0, 0);
    checkCollision();
}

function addCargo() {
    if (appMode !== 'pack') {
        alert("Switch to Packing Mode first!");
        return;
    }

    const l = parseFloat(document.getElementById('cargo-l').value);
    const w = parseFloat(document.getElementById('cargo-w').value);
    const h = parseFloat(document.getElementById('cargo-h').value);
    const shapeSelector = document.getElementById('cargo-shape');
    const shapeVal = shapeSelector.value;

    let object;
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

    let shapeCategory = 'box';
    if (CAR_PRESETS[shapeVal]) {
        shapeCategory = CAR_PRESETS[shapeVal].type;
    } else {
        shapeCategory = shapeVal;
    }

    if (shapeCategory === 'box') {
        const geometry = new THREE.BoxGeometry(w, h, l);
        object = new THREE.Mesh(geometry, material);
        object.position.set(0, h / 2, 0);
        object.userData.collisionType = 'box';
    }
    else if (shapeCategory === 'rounded') {
        const radius = Math.min(w, l) * 0.2;
        const shapePts = [];
        const hw = w / 2, hl = l / 2;
        const r = radius;

        shapePts.push(new THREE.Vector2(hw - r, hl));
        shapePts.push(new THREE.Vector2(hw, hl - r));
        shapePts.push(new THREE.Vector2(hw, -hl + r));
        shapePts.push(new THREE.Vector2(hw - r, -hl));
        shapePts.push(new THREE.Vector2(-hw + r, -hl));
        shapePts.push(new THREE.Vector2(-hw, -hl + r));
        shapePts.push(new THREE.Vector2(-hw, hl - r));
        shapePts.push(new THREE.Vector2(-hw + r, hl));

        const threeShape = new THREE.Shape(shapePts);
        const geometry = new THREE.ExtrudeGeometry(threeShape, { depth: h, bevelEnabled: false });
        geometry.translate(0, 0, -h / 2);

        object = new THREE.Mesh(geometry, material);
        object.rotation.x = Math.PI / 2;
        object.position.set(0, h / 2, 0);

        const pts = [];
        const tops = [h / 2, -h / 2];
        for (let y of tops) {
            shapePts.forEach(p => {
                pts.push(new THREE.Vector3(p.x, y, p.y));
            });
        }
        object.userData.points = pts;
    }
    else if (shapeCategory === 'cylinder_v') {
        const geometry = new THREE.CylinderGeometry(w / 2, w / 2, h, 32);
        object = new THREE.Mesh(geometry, material);
        object.position.set(0, h / 2, 0);

        const pts = [];
        const radius = w / 2;
        const tops = [h / 2, -h / 2];
        for (let y of tops) {
            for (let i = 0; i < 16; i++) {
                const angle = (i / 16) * Math.PI * 2;
                pts.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
            }
        }
        object.userData.points = pts;
    }
    else if (shapeCategory === 'cylinder_h') {
        const radius = Math.min(w, h) / 2;
        const geometryH = new THREE.CylinderGeometry(radius, radius, l, 32);
        object = new THREE.Mesh(geometryH, material);
        object.rotation.x = Math.PI / 2;
        object.position.set(0, radius, 0);

        const pts = [];
        const ends = [l / 2, -l / 2];
        for (let z of ends) {
            for (let i = 0; i < 16; i++) {
                const angle = (i / 16) * Math.PI * 2;
                pts.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, z));
            }
        }
        object.userData.points = pts;
    }
    else if (shapeCategory === 'suv' || shapeCategory === 'sedan') {
        object = new THREE.Group();
        object.userData.points = [];

        const hChassis = h * 0.35;
        const geoChassis = new THREE.BoxGeometry(w, hChassis, l);
        const meshChassis = new THREE.Mesh(geoChassis, material);
        meshChassis.position.y = hChassis / 2;
        object.add(meshChassis);

        {
            const chamfer = 20;
            const hw = w / 2; const hl = l / 2;
            const levs = [0, hChassis];
            for (let y of levs) {
                object.userData.points.push(new THREE.Vector3(hw - chamfer, y, hl));
                object.userData.points.push(new THREE.Vector3(hw, y, hl - chamfer));
                object.userData.points.push(new THREE.Vector3(hw, y, -hl + chamfer));
                object.userData.points.push(new THREE.Vector3(hw - chamfer, y, -hl));
                object.userData.points.push(new THREE.Vector3(-hw + chamfer, y, -hl));
                object.userData.points.push(new THREE.Vector3(-hw, y, -hl + chamfer));
                object.userData.points.push(new THREE.Vector3(-hw, y, hl - chamfer));
                object.userData.points.push(new THREE.Vector3(-hw + chamfer, y, hl));
            }
        }

        let hoodL, trunkL, cabinL, cabinW, cabinH;
        cabinH = h - hChassis;
        cabinW = w * 0.90;

        if (shapeCategory === 'sedan') {
            hoodL = l * 0.30;
            trunkL = l * 0.25;
            cabinL = l - (hoodL + trunkL);
        } else {
            hoodL = l * 0.35;
            trunkL = 0;
            cabinL = l - hoodL;
        }

        const zFront = l / 2;
        const zCabinFront = zFront - hoodL;
        const zCabinRear = zCabinFront - cabinL;
        const zCabinCenter = (zCabinFront + zCabinRear) / 2;

        const geoCabin = new THREE.BoxGeometry(cabinW, cabinH, cabinL);
        const meshCabin = new THREE.Mesh(geoCabin, material);
        meshCabin.position.y = hChassis + (cabinH / 2);
        meshCabin.position.z = zCabinCenter;
        object.add(meshCabin);

        {
            const hcw = cabinW / 2;
            const hcl = cabinL / 2;
            const yBot = hChassis;
            const yTop = h;
            const centerZ = zCabinCenter;
            [yBot, yTop].forEach(y => {
                object.userData.points.push(new THREE.Vector3(hcw, y, centerZ + hcl));
                object.userData.points.push(new THREE.Vector3(hcw, y, centerZ - hcl));
                object.userData.points.push(new THREE.Vector3(-hcw, y, centerZ + hcl));
                object.userData.points.push(new THREE.Vector3(-hcw, y, centerZ - hcl));
            });
        }
    }

    object.castShadow = true;
    palletGroup.add(object);
    cargoItems.push(object);

    selectBox(object);
    checkCollision();
}

function clearCargo() {
    cargoItems.forEach(b => palletGroup.remove(b));
    cargoItems = [];
    transformControl.detach();
}

function selectBox(object) {
    if (appMode !== 'pack') return;
    currentSelectedBox = object;
    transformControl.attach(object);
    transformControl.setMode('translate');

    const btn = document.getElementById('pack-gizmo-btn');
    if (btn) btn.innerText = "Tool: Move (Перемещение)";
}


function buildFuselage() {
    const shape = new THREE.Shape();
    const wHalf = SPECS.floorWidth / 2;

    shape.moveTo(wHalf, 0);
    shape.lineTo(wHalf, SPECS.taperStartHeight);

    const dy1 = SPECS.taperMidHeight - SPECS.taperStartHeight;
    const angle1 = 37.4 * (Math.PI / 180);
    const dx1 = dy1 * Math.tan(angle1);
    const x2 = wHalf - dx1;
    shape.lineTo(x2, SPECS.taperMidHeight);

    const dy2 = SPECS.maxHeight - SPECS.taperMidHeight;
    const angle2 = (37.4 + 18.3) * (Math.PI / 180);
    const dx2 = dy2 * Math.tan(angle2);
    const x3 = x2 - dx2;
    shape.lineTo(x3, SPECS.maxHeight);

    shape.lineTo(-x3, SPECS.maxHeight);
    shape.lineTo(-x2, SPECS.taperMidHeight);
    shape.lineTo(-wHalf, SPECS.taperStartHeight);
    shape.lineTo(-wHalf, 0);
    shape.lineTo(wHalf, 0);

    const geom = new THREE.ExtrudeGeometry(shape, { curveSegments: 1, depth: SPECS.fuselageLength, bevelEnabled: false });
    geom.translate(0, 0, -SPECS.fuselageLength / 2);

    const mat = new THREE.MeshStandardMaterial({ color: 0x88CCFF, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
    fuselageMesh = new THREE.Mesh(geom, mat);
    fuselageMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({ color: 0x0088FF, transparent: true, opacity: 0.3 })));

    scene.add(fuselageMesh);
}

function buildDoorVisuals() {
    const dw = SPECS.door.w;
    const dh = SPECS.door.h;

    const frameThick = 5;
    const geo = new THREE.BoxGeometry(frameThick, dh, dw);
    const edges = new THREE.EdgesGeometry(geo);
    const lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xFF2222, linewidth: 2 }));

    lines.position.set(DOOR_X, dh / 2, DOOR_Z_CENTER);
    scene.add(lines);
}

// --- COLLISION LOGIC ---

// Returns TRUE if colliding
function checkCollision() {
    return checkCollisionState(true);
}

function checkCollisionState(updateUI = true) {
    if (!palletGroup) return false;
    palletGroup.updateMatrixWorld(true);

    let isColliding = false;
    let hitType = "";

    const doorZHalf = SPECS.door.w / 2;
    const doorYMax = SPECS.door.h;

    function checkPoints(points) {
        let objectHit = false;
        for (let p of points) {

            if (p.y < -5) { objectHit = true; hitType = "FLOOR"; }
            if (p.y > SPECS.maxHeight) { objectHit = true; hitType = "CEILING"; }

            const allowedX = calculateMaxX(p.y);
            // Tolerances: 
            // We want specific check.
            const absX = Math.abs(p.x);

            // Wall Check with Tolerance
            if (absX + 2 > allowedX) {
                if (p.x > 0) {
                    objectHit = true; hitType = "RIGHT WALL";
                } else {
                    const inDoorZ = (p.z >= -doorZHalf && p.z <= doorZHalf);
                    const inDoorY = (p.y <= doorYMax);

                    if (!inDoorZ || !inDoorY) {
                        objectHit = true; hitType = "DOOR FRAME";
                    }
                }
            }
        }
        return objectHit;
    }

    function setColor(object, color) {
        if (!updateUI) return;
        object.traverse((child) => {
            if (child.isMesh) child.material.color.setHex(color);
        });
    }

    function getCollisionPoints(item) {
        if (item.userData.points) {
            return item.userData.points.map(p => p.clone().applyMatrix4(item.matrixWorld));
        }

        if (item.isMesh && item.geometry.type === 'BoxGeometry') {
            const points = getCorners(item);
            points.forEach(p => p.applyMatrix4(item.matrixWorld));
            return points;
        }
        return [];
    }

    // 1. Check Cargo Items
    cargoItems.forEach(item => {
        const points = getCollisionPoints(item);
        const hit = checkPoints(points);
        if (hit) {
            setColor(item, 0xFF0000);
            isColliding = true;
        } else {
            setColor(item, 0x00FF00);
        }
    });

    // 2. Check Pallet Base
    const pData = PALLETS[currentPalletType];
    if (pData && palletGroup) {
        const pw = pData.w;
        const pl = pData.l;
        const ph = 5;

        const localCorners = [
            new THREE.Vector3(pw / 2, ph, pl / 2),
            new THREE.Vector3(pw / 2, ph, -pl / 2),
            new THREE.Vector3(-pw / 2, ph, pl / 2),
            new THREE.Vector3(-pw / 2, ph, -pl / 2),
            new THREE.Vector3(pw / 2, 0, pl / 2),
            new THREE.Vector3(pw / 2, 0, -pl / 2),
            new THREE.Vector3(-pw / 2, 0, pl / 2),
            new THREE.Vector3(-pw / 2, 0, -pl / 2)
        ];

        localCorners.forEach(p => p.applyMatrix4(palletGroup.matrixWorld));
        const palletHit = checkPoints(localCorners);

        const baseMesh = palletGroup.getObjectByName("PalletBase");
        if (baseMesh) {
            if (palletHit) {
                if (updateUI) baseMesh.material.color.setHex(0xFF0000);
                isColliding = true;
                if (!hitType) hitType = "PALLET HIT";
            } else {
                if (updateUI) baseMesh.material.color.setHex(0x999999);
            }
        }
    }

    if (updateUI) {
        const stat = document.getElementById('status-display');
        const note = document.getElementById('door-status');

        if (isColliding) {
            stat.innerText = "COLLISION";
            stat.className = "status-danger";
            note.innerText = hitType;
        } else {
            stat.innerText = "SAFE";
            stat.className = "status-safe";
            note.innerText = "Clear";
        }
    }

    return isColliding;
}


// --- AUTO SIMULATION ---

async function runSmartSimulation() {
    const statusDiv = document.getElementById('sim-status');
    statusDiv.innerText = "Calculating Path...";
    statusDiv.style.color = "yellow";

    // 1. Reset Position
    resetPalletPosition();

    // 2. Planning Phase
    // Simulate steps from X=-500 to X=0
    // At each step, if collision, try to fix with rotation/translation

    const steps = [];
    const stepSize = 5; // 5 cm steps
    let currentX = -500;
    const targetX = 0;

    // Store original position/rotation to restore if fail
    const startPos = palletGroup.position.clone();
    const startRot = palletGroup.rotation.clone();

    let pathFound = true;
    let failReason = "";

    // Valid ranges for correction
    // Z: +/- 50cm (wiggle room)
    // Yaw: +/- 45 deg

    while (currentX < targetX) {
        // Tentative Step
        currentX += stepSize;
        palletGroup.position.setX(currentX);

        // Check collision at neutral Z=0, Rot=0 (or keep previous best?)
        // Let's try to "keep previous" flow for smoothness.
        // But for simplicity, we optimize greedy at each step.

        if (checkCollisionState(false)) {
            // Collision! Try to find a safe pose at this X.
            // Search Z from -50 to 50, Step 10
            // Search Yaw from -45 to 45, Step 5

            let safeFound = false;

            // Heuristic: Spiral out from 0? or Previous?
            // Simple grid search
            for (let z = -50; z <= 50; z += 10) {
                if (safeFound) break;
                for (let rot = -45; rot <= 45; rot += 5) {
                    palletGroup.position.setZ(z);
                    palletGroup.rotation.y = rot * (Math.PI / 180);
                    palletGroup.updateMatrixWorld(true);

                    if (!checkCollisionState(false)) {
                        safeFound = true;
                        break;
                    }
                }
            }

            if (!safeFound) {
                pathFound = false;
                failReason = `Stuck at X=${currentX}`;
                break;
            }
        }

        // Save safe pose
        steps.push({
            x: palletGroup.position.x,
            z: palletGroup.position.z,
            rotY: palletGroup.rotation.y
        });
    }

    // Restore
    palletGroup.position.copy(startPos);
    palletGroup.rotation.copy(startRot);

    if (pathFound) {
        statusDiv.innerText = "Path Found! Playing...";
        statusDiv.style.color = "lime";
        playPath(steps);
    } else {
        statusDiv.innerText = "Failed: " + failReason;
        statusDiv.style.color = "red";
    }
}

function playPath(steps) {
    if (!steps.length) return;

    // Simple Tween chain or Frame loop
    // Let's use TWEEN lib or custom loop

    let idx = 0;
    function nextFrame() {
        if (idx >= steps.length) return;

        const pose = steps[idx];
        palletGroup.position.set(pose.x, 0, pose.z); // Y is 0
        palletGroup.rotation.set(0, pose.rotY, 0);

        checkCollisionState(true); // Update UI

        idx++;
        // Speed
        requestAnimationFrame(nextFrame);
        // Skip frames for speed?
    }
    nextFrame();
}


function calculateMaxX(y) {
    if (y > SPECS.maxHeight) return 0;
    if (y <= SPECS.taperStartHeight) {
        return SPECS.floorWidth / 2;
    } else if (y <= SPECS.taperMidHeight) {
        const dy = y - SPECS.taperStartHeight;
        const dx = dy * Math.tan(37.4 * Math.PI / 180);
        return (SPECS.floorWidth / 2) - dx;
    } else {
        const dyTop = y - SPECS.taperMidHeight;
        const dxTop = dyTop * Math.tan(55.7 * Math.PI / 180);
        const dy1 = SPECS.taperMidHeight - SPECS.taperStartHeight;
        const dx1 = dy1 * Math.tan(37.4 * Math.PI / 180);
        const xMid = (SPECS.floorWidth / 2) - dx1;
        return xMid - dxTop;
    }
}

function getCorners(mesh) {
    const geo = mesh.geometry;
    if (!geo.parameters) return [];

    const w = geo.parameters.width;
    const h = geo.parameters.height;
    const d = geo.parameters.depth;

    return [
        new THREE.Vector3(w / 2, h / 2, d / 2),
        new THREE.Vector3(w / 2, h / 2, -d / 2),
        new THREE.Vector3(w / 2, -h / 2, d / 2),
        new THREE.Vector3(w / 2, -h / 2, -d / 2),
        new THREE.Vector3(-w / 2, h / 2, d / 2),
        new THREE.Vector3(-w / 2, h / 2, -d / 2),
        new THREE.Vector3(-w / 2, -h / 2, d / 2),
        new THREE.Vector3(-w / 2, -h / 2, -d / 2),
    ];
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    renderer.render(scene, camera);
}
