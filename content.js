// CSS 애니메이션 정의
const style = document.createElement('style');
style.textContent = `
  @keyframes heartFloat {
    0% {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    100% {
      transform: translateY(-100px) scale(0.5);
      opacity: 0;
    }
  }

  .neckster-heart {
    position: fixed;
    font-size: 24px;
    pointer-events: none;
    animation: heartFloat 1.2s ease-out forwards;
    z-index: 1000000;
  }

  #neckster-size-popup {
    position: fixed;
    background: rgba(255,255,255,0.92);
    border: 1px solid #ccc;
    border-radius: 10px;
    padding: 10px 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: none;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    z-index: 1000001;
    font-family: sans-serif;
    font-size: 12px;
    color: #555;
    user-select: none;
  }

  #neckster-size-popup input[type=range] {
    width: 120px;
    cursor: pointer;
  }
`;
document.head.appendChild(style);

// 캔버스 생성 & 오버레이 고정
const canvas = document.createElement('canvas');
const canvasWidth = window.innerWidth;
const canvasHeight = window.innerHeight;
canvas.style.cssText = `
  position: fixed;
  bottom: 0;
  right: 0;
  width: ${canvasWidth}px;
  height: ${canvasHeight}px;
  z-index: 999999;
  pointer-events: none;
  cursor: pointer;
`;


document.body.appendChild(canvas);

// 크기 조절 팝업
const sizePopup = document.createElement('div');
sizePopup.id = 'neckster-size-popup';
sizePopup.innerHTML = `
  <span>🐹 크기</span>
  <input type="range" id="neckster-scale-input" min="0.3" max="2.0" step="0.1" value="0.6">
  <span id="neckster-scale-value">0.6</span>
`;
document.body.appendChild(sizePopup);

document.getElementById('neckster-scale-input').addEventListener('input', (e) => {
    const scale = parseFloat(e.target.value);
    document.getElementById('neckster-scale-value').textContent = scale.toFixed(1);
    if (model) {
        baseModelScale = scale;
        model.scale.set(scale, scale, scale);
    }
});

document.addEventListener('click', (e) => {
    if (!sizePopup.contains(e.target)) {
        sizePopup.style.display = 'none';
    }
});

// Three.js 기본 세팅
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
renderer.setSize(canvasWidth, canvasHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, canvasWidth / canvasHeight, 0.1, 100);
camera.position.set(0, 3, 15);
camera.lookAt(0, 1, 0);

// 화면 크기 기반 경계 계산
let walkBounds = { min: -window.innerWidth / 30, max: window.innerWidth / 30 };
let screenBounds = { min: -10, max: 10 };

// GLB 로드용 변수 초기화
let model = null;

// 카메라 기준 화면 전체 x 범위를 월드 좌표로 계산
function updateScreenBounds() {
    const tempRay = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const pt = new THREE.Vector3();
    tempRay.setFromCamera(new THREE.Vector2(-1, 0), camera);
    tempRay.ray.intersectPlane(plane, pt);
    const left = pt.x;
    tempRay.setFromCamera(new THREE.Vector2(1, 0), camera);
    tempRay.ray.intersectPlane(plane, pt);
    screenBounds = { min: left, max: pt.x };
}

// 드롭 위치 x 기준으로 3구역(왼/중/오) walkBounds 반환
function getZoneBounds(x) {
    const w = screenBounds.max - screenBounds.min;
    const third = w / 3;
    if (x < screenBounds.min + third) {
        return { min: screenBounds.min, max: screenBounds.min + third };
    } else if (x < screenBounds.min + 2 * third) {
        return { min: screenBounds.min + third, max: screenBounds.min + 2 * third };
    } else {
        return { min: screenBounds.min + 2 * third, max: screenBounds.max };
    }
}

// 캔버스 리사이징 함수
function resizeCanvas() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    // 걷기 범위도 동적으로 업데이트
    walkBounds = { min: -w / 30, max: w / 30 };
    updateScreenBounds();
}

// 처음 실행
resizeCanvas();

// 창 크기 바뀔 때마다 자동 업데이트
window.addEventListener('resize', resizeCanvas);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 2, 3);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// GLB 로드
let headBone = null;
let neckBone = null;
let leftUpLegBone = null;
let rightUpLegBone = null;
let leftArmBone = null;
let rightArmBone = null;
let leftHandBone = null;
let rightHandBone = null;
let leftFootBone = null;
let rightFootBone = null;
let baseHeadY = null;
let baseHeadRotationX = null;
let baseNeckRotationX = null;
let baseModelScale = null;
let baseModelX = null;
let baseLeftArmScale = null;
let baseRightArmScale = null;
let isAnimating = false;
let isWalking = false;
let walkDirection = 0; // -1: 왼쪽, 0: 정면, 1: 오른쪽
let walkSpeed = 0.02; // 이동 속도
let lastWalkTime = 0;
const loader = new THREE.GLTFLoader();

// 3D 월드 좌표를 2D 스크린 좌표로 변환
function getScreenPosition(worldPos) {
    const widthHalf = renderer.domElement.clientWidth / 2;
    const heightHalf = renderer.domElement.clientHeight / 2;

    const vector = worldPos.clone();
    vector.project(camera);

    vector.x = (vector.x * widthHalf) + widthHalf;
    vector.y = -(vector.y * heightHalf) + heightHalf;

    return vector;
}

// 하트 이모지 생성 함수
function createHearts() {
    const heartCount = 1; // 3~5개

    if (!model) return;

    // 햄스터의 3D 위치를 2D 스크린 좌표로 변환
    const modelWorldPos = new THREE.Vector3();
    model.getWorldPosition(modelWorldPos);

    const screenPos = getScreenPosition(modelWorldPos);

    for (let i = 0; i < heartCount; i++) {
        const heart = document.createElement('div');
        heart.className = 'neckster-heart';
        heart.textContent = '❤️';

        // 햄스터 위치 기준으로 생성 (약간의 랜덤 오프셋)
        const startX = screenPos.x + (Math.random() - 0.5) * 50;
        const startY = screenPos.y + (Math.random() - 0.5) * 50;

        heart.style.left = startX + 'px';
        heart.style.top = startY + 'px';

        document.body.appendChild(heart);

        // 애니메이션 완료 후 제거
        heart.addEventListener('animationend', () => {
            heart.remove();
        });
    }
}

// Raycaster 설정 (햄스터 클릭 감지용)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// 드래그 상태
let isDraggingHamster = false;
let dragMoved = false;
const hamsterDragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

function handleMouseDown(event) {
    if (!model) return;
    const rect = canvas.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const intersects = raycaster.intersectObject(model, true);
    if (intersects.length > 0) {
        isDraggingHamster = true;
        dragMoved = false;
        isWalking = false;
        walkDirection = 0;
    }
}

function handleMouseMove(event) {
    if (!model) return;
    const rect = canvas.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;

    if (isDraggingHamster) {
        dragMoved = true;
        const dragRaycaster = new THREE.Raycaster();
        dragRaycaster.setFromCamera(new THREE.Vector2(nx, 0), camera);
        const target = new THREE.Vector3();
        dragRaycaster.ray.intersectPlane(hamsterDragPlane, target);
        if (target) {
            const newX = Math.max(screenBounds.min, Math.min(screenBounds.max, target.x));
            model.position.x = newX;
            baseModelX = newX;
        }
        document.body.style.cursor = 'grabbing';
        return;
    }

    // hover 감지 → 커서 변경
    const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const hits = raycaster.intersectObject(model, true);
    document.body.style.cursor = hits.length > 0 ? 'grab' : '';
}

function handleMouseUp() {
    if (isDraggingHamster && dragMoved && model) {
        walkBounds = getZoneBounds(model.position.x);
        chrome.storage.local.set({ necksterWalkBounds: walkBounds });
    }
    isDraggingHamster = false;
    document.body.style.cursor = '';
}

document.addEventListener('mousedown', handleMouseDown);
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('mouseup', handleMouseUp);

document.addEventListener('contextmenu', (e) => {
    if (!model) return;
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const intersects = raycaster.intersectObject(model, true);
    if (intersects.length === 0) return;

    e.preventDefault();
    const currentScale = baseModelScale || 0.6;
    const input = document.getElementById('neckster-scale-input');
    const label = document.getElementById('neckster-scale-value');
    input.value = currentScale;
    label.textContent = currentScale.toFixed(1);

    sizePopup.style.display = 'flex';
    sizePopup.style.left = e.clientX + 'px';
    sizePopup.style.top = (e.clientY - 80) + 'px';
});

// 클릭 시 애니메이션 처리
function handleCanvasClick(event) {
    if (dragMoved) { dragMoved = false; return; }

    // 마우스 좌표를 정규화된 좌표로 변환 (-1 ~ 1)
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // 광선 생성
    raycaster.setFromCamera(mouse, camera);

    // 모델과의 충돌 검사
    if (!model) return;
    const intersects = raycaster.intersectObject(model, true);

    // 햄스터를 클릭했을 때만 애니메이션 실행
    if (intersects.length === 0) return;
    if (isAnimating || !headBone || baseHeadY === null || baseModelScale === null) return;

    isAnimating = true;

    // 하트 생성
    createHearts();

    // 모델 애니메이션 (0.8s 동안 축소했다가 복구)
    const animationDuration = 0.8; // 초

    const animateSquash = (timestamp) => {
        if (!window.squashStartTime) {
            window.squashStartTime = timestamp;
        }

        const elapsed = timestamp - window.squashStartTime;
        const progress = Math.min(elapsed / (animationDuration * 1000), 1); // 0 ~ 1

        let scaleRatio;
        if (progress < 0.4) {
            // 0~0.4: 축소 (1.0 -> 0.8)
            scaleRatio = 1 - (progress / 0.4) * 0.2;
        } else {
            // 0.4~1.0: 원래 크기로 (0.8 -> 1.0)
            scaleRatio = 0.8 + ((progress - 0.4) / 0.6) * 0.2;
        }

        // 전체 모델 스케일 변경
        const newScale = baseModelScale * scaleRatio;
        model.scale.set(newScale, newScale, newScale);

        if (progress < 1) {
            requestAnimationFrame(animateSquash);
        } else {
            // 애니메이션 완료
            model.scale.set(baseModelScale, baseModelScale, baseModelScale);
            headBone.position.y = baseHeadY;
            window.squashStartTime = null;

            // 경과시간 리셋
            elapsedSeconds = 0;
            lastTime = performance.now();
            isAnimating = false;
        }
    };

    requestAnimationFrame(animateSquash);
}

document.addEventListener('click', handleCanvasClick);

loader.load(chrome.runtime.getURL('assets/hamster.glb'), (gltf) => {
    model = gltf.scene;
    model.scale.set(0.6, 0.6, 0.6);
    baseModelScale = 0.6;
    model.position.set(1, -4.8, 0);
    baseModelX = 1;
    scene.add(model);

    model.traverse((obj) => {
        if (obj.isBone && obj.name === 'Neck') {
            neckBone = obj;
            baseNeckRotationX = obj.rotation.x;
        }
        if (obj.isBone && obj.name === 'Head') {
            headBone = obj;
            baseHeadY = obj.position.y;
            baseHeadRotationX = obj.rotation.x;
        }
        if (obj.isBone && obj.name === 'LeftUpLeg') leftUpLegBone = obj;
        if (obj.isBone && obj.name === 'RightUpLeg') rightUpLegBone = obj;
        if (obj.isBone && obj.name === 'LeftArm') {
            leftArmBone = obj;
            if (obj.scale) baseLeftArmScale = obj.scale.x;
        }
        if (obj.isBone && obj.name === 'RightArm') {
            rightArmBone = obj;
            if (obj.scale) baseRightArmScale = obj.scale.x;
        }
        if (obj.isBone && obj.name === 'LeftHand') leftHandBone = obj;
        if (obj.isBone && obj.name === 'RightHand') rightHandBone = obj;
        if (obj.isBone && obj.name === 'LeftFoot') leftFootBone = obj;
        if (obj.isBone && obj.name === 'RightFoot') rightFootBone = obj;
    });
});


// 애니메이션 루프 수정
let elapsedSeconds = 0;
let lastTime = performance.now();
let lastStorageSave = 0;

// storage에서 이전 상태 불러오기
chrome.storage.local.get(['necksterElapsed', 'necksterWalkBounds'], (data) => {
    if (data.necksterElapsed) {
        elapsedSeconds = data.necksterElapsed;
    }
    if (data.necksterWalkBounds) {
        walkBounds = data.necksterWalkBounds;
    }
});

function animate() {
    requestAnimationFrame(animate);

    // 시간 누적
    const now = performance.now();
    elapsedSeconds += (now - lastTime) / 1000; // 초 단위로 변환
    lastTime = now;

    // 5초마다 storage에 저장
    if (now - lastStorageSave > 5000) {
        lastStorageSave = now;
        chrome.storage.local.set({ necksterElapsed: elapsedSeconds });
    }

    // 목 늘이기 (30s마다 0.1씩 늘어남, 캔버스 높이 80% 제한)
    if (headBone && baseHeadY !== null && baseHeadRotationX !== null) {
        const maxStretch = window.innerHeight * 0.8 / 100; // 캔버스의 80% 기준
        const stretch = Math.min((elapsedSeconds / 30) * 0.1, maxStretch);
        const stretchRatio = stretch / maxStretch; // 0 ~ 1

        // 목과 머리 회전 (거북목처럼 앞으로 휨)
        const rotationAmount = stretchRatio * 0.3; // 최대 0.3 라디안
        if (headBone) headBone.rotation.x = baseHeadRotationX + rotationAmount;

        // Neck만 길이 늘어남 (scale.y로 길어지게)
        if (neckBone && baseNeckRotationX !== null) {
            neckBone.rotation.x = baseNeckRotationX + rotationAmount;
            neckBone.scale.y = 1 + stretchRatio * 3; // 최대 3배까지 늘어남
        }
    }

    // 호흡 애니메이션 (모델이 살아있는 것처럼)
    if (model && baseModelScale !== null) {
        const breathe = Math.sin(elapsedSeconds * 1.5) * 0.03; // 0.98 ~ 1.02 범위
        model.scale.set(
            baseModelScale * (1 + breathe),
            baseModelScale * (1 + breathe),
            baseModelScale * (1 + breathe)
        );
    }

    // 방향 랜덤 설정 (0: 정면, -1: 왼쪽, 1: 오른쪽)
    const currentTime = now;
    const timeSinceLastWalk = currentTime - lastWalkTime;

    if (timeSinceLastWalk > Math.random() * 5000 + 5000) { // 5~10초마다 방향 변경
        walkDirection = Math.floor(Math.random() * 3) - 1; // -1, 0, 1 랜덤
        lastWalkTime = currentTime;
    } else if (timeSinceLastWalk >= 1000 && walkDirection !== 0) {
        // 1초 이후 정면으로 리셋
        walkDirection = 0;
    }
    // 방향 변경 후 1초 동안만 이동
    isWalking = walkDirection !== 0 && timeSinceLastWalk < Math.random() * 1000 + 1000; // 1~2초 동안 걷기

    // 이동 및 걷기 애니메이션
    if (model && baseModelX !== null) {
        if (isWalking) {
            // 이동 중
            const newX = model.position.x + walkSpeed * walkDirection;

            // 경계 체크
            if (newX <= walkBounds.min) {
                model.position.x = walkBounds.min;
                walkDirection = 1; // 오른쪽으로 방향 전환
            } else if (newX >= walkBounds.max) {
                model.position.x = walkBounds.max;
                walkDirection = -1; // 왼쪽으로 방향 전환
            } else {
                model.position.x = newX;
            }
        } else {
            // 정지 상태에서도 경계 체크
            if (model.position.x < walkBounds.min) {
                model.position.x = walkBounds.min;
            } else if (model.position.x > walkBounds.max) {
                model.position.x = walkBounds.max;
            }
        }

        // 모델 회전 (이동 방향 바라보기)
        if (walkDirection === 1) {
            model.rotation.y = Math.PI / 4; // 45도 오른쪽
        } else if (walkDirection === -1) {
            model.rotation.y = -Math.PI / 4; // -45도 왼쪽
        } else {
            model.rotation.y = 0; // 정면
        }

        // 걸음걸이 애니메이션 (다른 축 사용)
        if (isWalking) {
            const walkCycle = (now * 0.01) % (Math.PI * 2); // 빠른 걸음
            // z 대신 x축으로 앞뒤 움직임
            if (leftUpLegBone) {
                leftUpLegBone.rotation.x = Math.sin(walkCycle) * 0.4;
            }
            if (rightUpLegBone) {
                rightUpLegBone.rotation.x = Math.sin(walkCycle + Math.PI) * 0.4;
            }
        } else {
            // 정지 상태 - 원래대로 복구
            model.rotation.x = 0;

            // 정지 상태에서도 미세한 다리 움직임
            const idleWalkCycle = (now * 0.005) % (Math.PI * 2); // 느린 속도
            if (leftUpLegBone) {
                leftUpLegBone.rotation.x = Math.sin(idleWalkCycle) * 0.1; // 작은 움직임
            }
            if (rightUpLegBone) {
                rightUpLegBone.rotation.x = Math.sin(idleWalkCycle + Math.PI) * 0.1;
            }
        }
    }

    renderer.render(scene, camera);
}
animate();

// newtab.js에서 호출: 햄스터를 현재 X 기준으로 delta만큼 이동
function moveHamsterX(delta) {
    if (!model) return;
    model.position.x += delta;
    baseModelX = model.position.x;
}