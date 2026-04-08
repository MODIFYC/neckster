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

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 2, 3);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// GLB 로드
let model = null;
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
let baseModelScale = null;
let baseModelX = null;
let baseLeftArmScale = null;
let baseRightArmScale = null;
let isAnimating = false;
let isWalking = false;
let walkDirection = -1; // -1: 왼쪽, 1: 오른쪽
let walkSpeed = 0.02; // 이동 속도
let lastWalkTime = 0;
const loader = new THREE.GLTFLoader();

// 화면 크기 기반 경계 계산
let walkBounds = { min: -window.innerWidth / 30, max: window.innerWidth / 30 };

// 하트 이모지 생성 함수
function createHearts() {
    const heartCount = 1; // 3~5개
    const canvasRect = canvas.getBoundingClientRect();

    for (let i = 0; i < heartCount; i++) {
        const heart = document.createElement('div');
        heart.className = 'neckster-heart';
        heart.textContent = '❤️';

        // 캔버스 범위 내에서 랜덤 위치에 생성
        const startX = canvasRect.right - Math.random() * 50;
        const startY = canvasRect.bottom - Math.random() * 50;

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
    model.position.set(1, -5, 0);
    baseModelX = 1;
    scene.add(model);

    model.traverse((obj) => {
        if (obj.isBone) console.log('bone:', obj.name);
        if (obj.isBone && obj.name === 'Neck') neckBone = obj;
        if (obj.isBone && obj.name === 'Head') {
            headBone = obj;
            baseHeadY = obj.position.y;
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
    elapsedSeconds += (now - lastTime) / 1000;
    lastTime = now;

    // 목 늘이기 (30s마다 0.1씩 늘어남)
    if (headBone && baseHeadY !== null) {
        const stretch = (elapsedSeconds / 30) * 0.1;
        headBone.position.y = baseHeadY + stretch;
    }

    // 호흡 애니메이션 (모델이 살아있는 것처럼)
    if (model && baseModelScale !== null) {
        const breathe = Math.sin(elapsedSeconds * 1.5) * 0.02; // 0.98 ~ 1.02 범위
        model.scale.set(
            baseModelScale * (1 + breathe),
            baseModelScale * (1 + breathe),
            baseModelScale * (1 + breathe)
        );
    }

    // 1초마다 이동 시작 (토글)
    const currentTime = now;
    if (currentTime - lastWalkTime > 1000) {
        isWalking = !isWalking;
        lastWalkTime = currentTime;
    }

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

            // 모델 회전 (이동 방향 바라보기, 270도)
            model.rotation.y = walkDirection > 0 ? 0 : 270;

            // 걸음걸이 애니메이션 (다른 축 사용)
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

            // 정지 시도 x로
            if (leftUpLegBone) leftUpLegBone.rotation.x = 0;
            if (rightUpLegBone) rightUpLegBone.rotation.x = 0;
        }
    }

    renderer.render(scene, camera);
}
animate();