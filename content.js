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
  pointer-events: auto;
  cursor: pointer;
`;


document.body.appendChild(canvas);

// Three.js 기본 세팅
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
renderer.setSize(canvasWidth, canvasHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, canvasWidth / canvasHeight, 0.1, 100);
camera.position.set(0, 3, 15);
camera.lookAt(0, 1, 0);

// 화면 크기 기반 경계 계산
let walkBounds = { min: -window.innerWidth / 30, max: window.innerWidth / 30 };

// GLB 로드용 변수 초기화
let model = null;

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

// 클릭 시 애니메이션 처리
function handleCanvasClick() {
    if (isAnimating || !model || !headBone || baseHeadY === null || baseModelScale === null) return;

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

canvas.addEventListener('click', handleCanvasClick);

loader.load(chrome.runtime.getURL('assets/hamster.glb'), (gltf) => {
    model = gltf.scene;
    model.scale.set(0.6, 0.6, 0.6);
    baseModelScale = 0.6;
    model.position.set(1, -4.8, 0);
    baseModelX = 1;
    scene.add(model);

    model.traverse((obj) => {
        if (obj.isBone) console.log('bone:', obj.name);
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

function animate() {
    requestAnimationFrame(animate);

    // 시간 누적
    const now = performance.now();
    elapsedSeconds += (now - lastTime) / 1000; // 초 단위로 변환
    lastTime = now;

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
        // 동적 경계 계산
        const dynamicBounds = { min: -window.innerWidth / 30, max: window.innerWidth / 30 };

        if (isWalking) {
            // 이동 중
            const newX = model.position.x + walkSpeed * walkDirection;

            // 경계 체크
            if (newX <= dynamicBounds.min) {
                model.position.x = dynamicBounds.min;
                walkDirection = 1; // 오른쪽으로 방향 전환
            } else if (newX >= dynamicBounds.max) {
                model.position.x = dynamicBounds.max;
                walkDirection = -1; // 왼쪽으로 방향 전환
            } else {
                model.position.x = newX;
            }
        } else {
            // 정지 상태에서도 경계 체크 (창이 줄어들 때)
            if (model.position.x < dynamicBounds.min) {
                model.position.x = dynamicBounds.min;
            } else if (model.position.x > dynamicBounds.max) {
                model.position.x = dynamicBounds.max;
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