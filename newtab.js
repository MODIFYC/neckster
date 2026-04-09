// ===== 전역 변수 =====
let bgScene, cageScene, bgCamera, cageCamera, bgRenderer, cageRenderer;
let ntElapsedSeconds = 0;
let ntLastTime = performance.now();

// 케이지 모드 (0: 전체, 1: 왼쪽, 2: 오른쪽)
const CAGE_MODES = [
    { name: 'full', x: [0, 1], cssLeft: '0%', cssWidth: '100%' },
    { name: 'left', x: [0, 0.5], cssLeft: '0%', cssWidth: '50%' },
    { name: 'right', x: [0.5, 1], cssLeft: '50%', cssWidth: '50%' },
];
let currentCageMode = 0;

// 아이템 배치 상태
let placingItem = null;
let itemsInScene = [];

// ===== 초기화 =====
function init() {
    initBgScene();
    initCageScene();
    setupEventListeners();
    ntAnimate();
    window.addEventListener('resize', onWindowResize);
}

// ===== 배경 씬 초기화 =====
function initBgScene() {
    bgScene = new THREE.Scene();

    // 카메라 - OrthographicCamera로 배경을 정확히 채움
    const bgCanvas = document.getElementById('bg-canvas');
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 20;
    bgCamera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        -frustumSize / 2,
        0.1, 100
    );
    bgCamera.position.set(0, 0, 30);
    bgCamera.lookAt(0, 0, 0);

    // 렌더러
    bgRenderer = new THREE.WebGLRenderer({ canvas: bgCanvas, antialias: true });
    bgRenderer.setSize(window.innerWidth, window.innerHeight);
    bgRenderer.setPixelRatio(window.devicePixelRatio);

    // 부드럽고 아늑한 조명 (3D 딱딱함 제거)
    const ambientLight = new THREE.AmbientLight(0xfff8f0, 1.0);
    bgScene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffff0, 0.5);
    sunLight.position.set(5, 10, 15);
    bgScene.add(sunLight);

    // === 하늘 그라데이션 (큰 평면에 직접 그라데이션 적용) ===
    createSkyPlane();

    // === 잔디 ===
    createGrass();

    // === 구름 ===
    const cloudGroup = new THREE.Group();
    createClouds(cloudGroup);
    bgScene.add(cloudGroup);
    bgScene.cloudGroup = cloudGroup;
}

// ===== 하늘 그라데이션 평면 =====
function createSkyPlane() {
    // 큰 캔버스에 그라데이션을 그려서 텍스처로 사용
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 1024);

    // 위: 진한 하늘색, 아래(지평선): 매우 밝은 하늘색
    gradient.addColorStop(0, '#4677cc');    // 진한 하늘
    gradient.addColorStop(0.4, '#78b9ef');  // 중간
    gradient.addColorStop(0.7, '#8ad0f8');  // 밝은 하늘
    gradient.addColorStop(1.0, '#bce6fe');  // 지평선 근처 아주 밝게

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 2, 4, 1024);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;

    // 화면 전체를 덮는 큰 평면
    const skyGeo = new THREE.PlaneGeometry(60, 30);
    const skyMat = new THREE.MeshBasicMaterial({ map: texture });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.position.set(0, 3, -10);
    bgScene.add(skyMesh);
}

// ===== 잔디 =====
function createGrass() {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);

    // 위(지평선 경계): 밝고 연한 연두, 아래: 진하고 풍성한 초록
    gradient.addColorStop(0.0, '#c8e88a');  // 지평선 근처 밝은 연두
    gradient.addColorStop(0.3, '#8fcc3a');  // 중간 초록
    gradient.addColorStop(0.7, '#5da82a');  // 진한 초록
    gradient.addColorStop(1.0, '#3d7a1a');  // 맨 아래 깊은 초록

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 4, 512);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;

    const grassGeo = new THREE.PlaneGeometry(60, 12);
    const grassMat = new THREE.MeshBasicMaterial({ map: texture });
    const grassMesh = new THREE.Mesh(grassGeo, grassMat);
    grassMesh.position.set(0, -6, -9);
    bgScene.add(grassMesh);
}

// ===== 구름 텍스처 (캔버스에 구름 모양 직접 그리기) =====
function createCloudTexture(bumps) {
    // bumps = [{cx, cy, rx, ry}] - 타원 여러 개로 구름 실루엣 구성
    const w = 512, h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // 1) 실루엣을 그린다 (흰색 타원 여러 개 합치기)
    ctx.fillStyle = '#ecfeff';
    bumps.forEach((b) => {
        ctx.beginPath();
        ctx.ellipse(b.cx * w, b.cy * h, b.rx * w, b.ry * h, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    // 2) 가장자리를 살짝 블러 처리 (축소→확대 2단계)
    const tmpCanvas = document.createElement('canvas');
    const tmpCtx = tmpCanvas.getContext('2d');
    const steps = 2;
    let sw = w, sh = h;
    tmpCanvas.width = sw;
    tmpCanvas.height = sh;

    for (let i = 0; i < steps; i++) {
        sw = Math.max(1, Math.floor(sw / 2));
        sh = Math.max(1, Math.floor(sh / 2));
        tmpCtx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);
        tmpCtx.drawImage(canvas, 0, 0, sw, sh);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(tmpCanvas, 0, 0, sw, sh, 0, 0, w, h);
    }

    // 3) RGB를 순백으로 강제, 알파만 유지 (회색 그림자 제거)
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
        d[i] = 255;     // R
        d[i + 1] = 255; // G
        d[i + 2] = 255; // B
        d[i + 3] = Math.min(255, d[i + 3] * 1.5); // 알파 보강
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    return texture;
}

// ===== 구름 생성 (Sprite 기반, 하나의 텍스처) =====
function createClouds(cloudGroup) {
    // 각 구름마다 다른 실루엣 (타원 조합)
    const cloudShapes = [
        // 작은 구름 1
        [
            { cx: 0.5, cy: 0.5, rx: 0.2, ry: 0.25 },
            { cx: 0.33, cy: 0.55, rx: 0.15, ry: 0.2 },
            { cx: 0.67, cy: 0.55, rx: 0.15, ry: 0.2 },
        ],
        // 작은 구름 2
        [
            { cx: 0.5, cy: 0.5, rx: 0.22, ry: 0.25 },
            { cx: 0.3, cy: 0.55, rx: 0.14, ry: 0.18 },
            { cx: 0.7, cy: 0.52, rx: 0.16, ry: 0.2 },
        ],
        // 큰 구름 1
        [
            { cx: 0.5, cy: 0.48, rx: 0.2, ry: 0.28 },
            { cx: 0.32, cy: 0.55, rx: 0.17, ry: 0.22 },
            { cx: 0.68, cy: 0.55, rx: 0.17, ry: 0.22 },
            { cx: 0.2, cy: 0.58, rx: 0.12, ry: 0.16 },
            { cx: 0.8, cy: 0.58, rx: 0.12, ry: 0.16 },
        ],
        // 큰 구름 2
        [
            { cx: 0.48, cy: 0.48, rx: 0.22, ry: 0.3 },
            { cx: 0.3, cy: 0.55, rx: 0.16, ry: 0.22 },
            { cx: 0.7, cy: 0.53, rx: 0.18, ry: 0.24 },
            { cx: 0.15, cy: 0.6, rx: 0.1, ry: 0.15 },
            { cx: 0.85, cy: 0.58, rx: 0.11, ry: 0.15 },
        ],
        // 큰 구름 3
        [
            { cx: 0.5, cy: 0.5, rx: 0.2, ry: 0.26 },
            { cx: 0.35, cy: 0.55, rx: 0.16, ry: 0.2 },
            { cx: 0.65, cy: 0.54, rx: 0.15, ry: 0.2 },
            { cx: 0.22, cy: 0.58, rx: 0.12, ry: 0.16 },
            { cx: 0.78, cy: 0.57, rx: 0.13, ry: 0.16 },
        ],
    ];

    // 위치: 높이 올리고 간격 넓힘, 크기 랜덤
    const placements = [
        { x: -7, y: 7.5, z: -5 },   // 작은 구름
        { x: 6, y: 8.2, z: -5 },   // 작은 구름
        { x: -10, y: 4.5, z: -4 },   // 큰 구름
        { x: 2, y: 5.5, z: -4 },   // 큰 구름
        { x: 12, y: 4.0, z: -4 },   // 큰 구름
    ];

    // 크기 랜덤: 작은 구름(0,1)은 작게, 큰 구름(2,3,4)은 크게
    const sizeRanges = [
        { sxMin: 2.5, sxMax: 4.0, syMin: 1.2, syMax: 2.0 },  // 작은
        { sxMin: 2.5, sxMax: 4.0, syMin: 1.2, syMax: 2.0 },  // 작은
        { sxMin: 5.0, sxMax: 8.0, syMin: 2.0, syMax: 3.5 },  // 큰
        { sxMin: 5.0, sxMax: 8.0, syMin: 2.0, syMax: 3.5 },  // 큰
        { sxMin: 5.0, sxMax: 8.0, syMin: 2.0, syMax: 3.5 },  // 큰
    ];

    function randRange(min, max) { return min + Math.random() * (max - min); }

    cloudShapes.forEach((bumps, i) => {
        const texture = createCloudTexture(bumps);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.92,
            depthWrite: false,
            color: 0xffffff,
        });
        const sprite = new THREE.Sprite(material);
        const p = placements[i];
        const sr = sizeRanges[i];
        const sx = randRange(sr.sxMin, sr.sxMax);
        const sy = randRange(sr.syMin, sr.syMax);
        sprite.position.set(p.x, p.y, p.z);
        sprite.scale.set(sx, sy, 1);
        sprite.userData = { speed: 0.12 + Math.random() * 0.08, startX: p.x };
        cloudGroup.add(sprite);
    });
}

// ===== 케이지 씬 초기화 =====
function initCageScene() {
    cageScene = new THREE.Scene();
    cageScene.background = null; // 투명 → 배경 캔버스 보임

    // 카메라
    const cageCanvas = document.getElementById('cage-canvas');
    const cageHeight = window.innerHeight * 0.6;
    cageCamera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / cageHeight,
        0.1,
        1000
    );
    cageCamera.position.set(0, 2, 15);
    cageCamera.lookAt(0, -1, 0);

    // 렌더러 (투명 배경)
    cageRenderer = new THREE.WebGLRenderer({ canvas: cageCanvas, alpha: true, antialias: true });
    cageRenderer.setSize(window.innerWidth, cageHeight);
    cageRenderer.setPixelRatio(window.devicePixelRatio);
    cageRenderer.setClearColor(0x000000, 0);

    // 부드럽고 아늑한 조명
    const ambientLight = new THREE.AmbientLight(0xfff8f0, 0.9);
    cageScene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xfff5e6, 0.6);
    mainLight.position.set(3, 8, 10);
    cageScene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xe8f0ff, 0.3);
    fillLight.position.set(-5, 4, 8);
    cageScene.add(fillLight);

    // === 베이지 톱밥 바닥 (케이지 안) ===
    const floorGeo = new THREE.BoxGeometry(18, 1.5, 10);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0xc4b060 }); // 연노란색
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -4.5, 0);
    cageScene.add(floor);

    // === 반투명 유리 케이지 벽 (흰색) ===
    const acrylicMat = new THREE.MeshPhongMaterial({
        color: 0xf5f0d0,
        transparent: true,
        opacity: 0.25,
        shininess: 80,
        specular: 0xFFFFFF,
    });

    // 뒷벽
    const backWallGeo = new THREE.PlaneGeometry(18, 8);
    const backWall = new THREE.Mesh(backWallGeo, acrylicMat);
    backWall.position.set(0, -0.5, -5);
    cageScene.add(backWall);

    // 좌측벽
    const sideWallGeo = new THREE.PlaneGeometry(10, 8);
    const leftWall = new THREE.Mesh(sideWallGeo, acrylicMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-9, -0.5, 0);
    cageScene.add(leftWall);

    // 우측벽
    const rightWall = new THREE.Mesh(sideWallGeo, acrylicMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(9, -0.5, 0);
    cageScene.add(rightWall);

    // === 갈색 테두리 (케이지 프레임) ===
    const frameMat = new THREE.LineBasicMaterial({ color: 0xf5f0d0 });
    const frameGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(18, 8, 10));
    const frame = new THREE.LineSegments(frameGeo, frameMat);
    frame.position.set(0, -0.5, 0);
    cageScene.add(frame);

    // Raycaster용 바닥면 참조
    cageScene.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 4.5);
}

// ===== 햄스터 모델 로드 =====

// ===== 이벤트 리스너 =====
function setupEventListeners() {
    document.getElementById('btn-house').addEventListener('click', () => {
        currentCageMode = (currentCageMode + 1) % CAGE_MODES.length;
        updateCageLayout();
    });

    document.getElementById('btn-hamster').addEventListener('click', () => {
        const slider = document.getElementById('hamster-scale-slider');
        slider.classList.toggle('hidden');
    });

    document.getElementById('scale-input').addEventListener('input', (e) => {
        const scale = parseFloat(e.target.value);
        document.getElementById('scale-value').textContent = scale.toFixed(1);
        // content.js의 model 변수 사용
        if (typeof model !== 'undefined' && model) {
            baseModelScale = scale;
            model.scale.set(scale, scale, scale);
        }
    });

    document.getElementById('btn-wheel').addEventListener('click', () => startPlacing('wheel'));
    document.getElementById('btn-bowl').addEventListener('click', () => startPlacing('bowl'));
    document.getElementById('btn-water').addEventListener('click', () => startPlacing('water'));

    const cageCanvas = document.getElementById('cage-canvas');
    cageCanvas.addEventListener('mousemove', onCanvasMouseMove);
    cageCanvas.addEventListener('click', onCanvasClick);

    document.getElementById('btn-camera').addEventListener('click', captureScreenshot);
}

// ===== 케이지 레이아웃 업데이트 =====
function updateCageLayout() {
    const mode = CAGE_MODES[currentCageMode];
    const cageCanvas = document.getElementById('cage-canvas');
    const cageHeight = window.innerHeight * 0.6;

    cageCanvas.style.left = mode.cssLeft;
    cageCanvas.style.width = mode.cssWidth;

    const width = window.innerWidth * (parseFloat(mode.cssWidth) / 100);
    const height = cageHeight;

    cageCamera.aspect = width / height;
    cageCamera.updateProjectionMatrix();
    cageRenderer.setSize(width, height);

    const cageWidth = (mode.x[1] - mode.x[0]) * 20;
    hamsterWalkBounds = {
        min: -(cageWidth / 2) * 0.9,
        max: (cageWidth / 2) * 0.9,
    };
}

// ===== 아이템 배치 시작 =====
function startPlacing(itemType) {
    if (placingItem) return;

    let mesh;
    const scale = 0.5;

    if (itemType === 'wheel') {
        const torusGeometry = new THREE.TorusGeometry(1, 0.3, 8, 20);
        const material = new THREE.MeshLambertMaterial({ color: 0xA0522D });
        mesh = new THREE.Mesh(torusGeometry, material);
        mesh.scale.set(scale, scale, scale);
    } else if (itemType === 'bowl') {
        const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 0.4, 16);
        const material = new THREE.MeshLambertMaterial({ color: 0xDEB887 });
        mesh = new THREE.Mesh(cylinderGeometry, material);
        mesh.scale.set(scale, scale * 0.3, scale);
    } else if (itemType === 'water') {
        const cylinderGeometry = new THREE.CylinderGeometry(0.6, 0.6, 1.5, 16);
        const material = new THREE.MeshLambertMaterial({ color: 0x87CEEB });
        mesh = new THREE.Mesh(cylinderGeometry, material);
        mesh.scale.set(scale, scale, scale);
    }

    mesh.userData = { type: itemType, placed: false };
    cageScene.add(mesh);

    placingItem = {
        type: itemType,
        mesh: mesh,
        initialized: false,
    };
}

// ===== 캔버스 마우스 이동 =====
function onCanvasMouseMove(event) {
    if (!placingItem || !placingItem.mesh) return;

    const cageCanvas = document.getElementById('cage-canvas');
    const rect = cageCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const nx = (x / rect.width) * 2 - 1;
    const ny = -(y / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(nx, ny);
    raycaster.setFromCamera(mouse, cageCamera);

    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(cageScene.floorPlane, intersectPoint);

    placingItem.mesh.position.copy(intersectPoint);
    placingItem.initialized = true;
}

// ===== 캔버스 클릭 =====
function onCanvasClick(event) {
    if (!placingItem || !placingItem.mesh || !placingItem.initialized) return;
    placingItem.mesh.userData.placed = true;
    itemsInScene.push(placingItem.mesh);
    placingItem = null;
}

// ===== 스크린샷 =====
function captureScreenshot() {
    const topButtons = document.getElementById('top-buttons');
    const slider = document.getElementById('hamster-scale-slider');
    const cameraBtn = document.getElementById('btn-camera');

    topButtons.style.opacity = '0';
    topButtons.style.pointerEvents = 'none';
    slider.style.opacity = '0';
    slider.style.pointerEvents = 'none';
    cameraBtn.style.opacity = '0';
    cameraBtn.style.pointerEvents = 'none';

    setTimeout(() => {
        const bgCanvas = document.getElementById('bg-canvas');
        const bgImageData = bgCanvas.toDataURL('image/png');

        const cageCanvas = document.getElementById('cage-canvas');
        const cageImageData = cageCanvas.toDataURL('image/png');

        const bgImg = new Image();
        const cageImg = new Image();
        let loadedCount = 0;

        const onImagesLoaded = () => {
            loadedCount++;
            if (loadedCount !== 2) return;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = bgImg.width;
            tempCanvas.height = bgImg.height;
            const ctx = tempCanvas.getContext('2d');

            ctx.drawImage(bgImg, 0, 0);

            const cageY = bgImg.height - cageImg.height;
            const cageLeft = parseFloat(cageCanvas.style.left || 0);
            ctx.drawImage(cageImg, cageLeft, cageY);

            const link = document.createElement('a');
            link.href = tempCanvas.toDataURL('image/png');
            link.download = 'neckster.png';
            link.click();

            topButtons.style.opacity = '1';
            topButtons.style.pointerEvents = 'auto';
            slider.style.opacity = '1';
            slider.style.pointerEvents = 'auto';
            cameraBtn.style.opacity = '1';
            cameraBtn.style.pointerEvents = 'auto';
        };

        bgImg.onload = onImagesLoaded;
        cageImg.onload = onImagesLoaded;
        bgImg.src = bgImageData;
        cageImg.src = cageImageData;
    }, 50);
}

// ===== 창 크기 조정 =====
function onWindowResize() {
    // 배경 씬 (OrthographicCamera 업데이트)
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 20;
    bgCamera.left = -frustumSize * aspect / 2;
    bgCamera.right = frustumSize * aspect / 2;
    bgCamera.top = frustumSize / 2;
    bgCamera.bottom = -frustumSize / 2;
    bgCamera.updateProjectionMatrix();
    bgRenderer.setSize(window.innerWidth, window.innerHeight);

    updateCageLayout();
}

// ===== 애니메이션 루프 =====
function ntAnimate() {
    requestAnimationFrame(ntAnimate);

    const now = performance.now();
    const deltaTime = (now - ntLastTime) / 1000;
    ntLastTime = now;
    ntElapsedSeconds += deltaTime;

    // 구름 천천히 이동 (화면 밖 → 반대쪽에서 연속 등장)
    if (bgScene.cloudGroup) {
        const aspect = window.innerWidth / window.innerHeight;
        const halfW = 20 * aspect / 2; // frustumSize=20 기준 화면 반폭
        bgScene.cloudGroup.children.forEach((cloud) => {
            cloud.position.x += cloud.userData.speed * deltaTime;
            const cloudHalfW = cloud.scale.x / 2;
            // 오른쪽 밖으로 나가면 왼쪽 밖에서 다시 등장
            if (cloud.position.x - cloudHalfW > halfW) {
                cloud.position.x = -halfW - cloudHalfW;
            }
        });
    }

    // 렌더링
    bgRenderer.render(bgScene, bgCamera);
    cageRenderer.render(cageScene, cageCamera);
}

// ===== 시작 =====
init();
updateCageLayout();
