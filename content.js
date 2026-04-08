// 캔버스 생성 & 오버레이 고정
const canvas = document.createElement('canvas');
const canvasHeight = window.innerHeight;
canvas.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 150px;
  height: ${canvasHeight}px;
  z-index: 999999;
  pointer-events: auto;
`;


document.body.appendChild(canvas);

// Three.js 기본 세팅
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
renderer.setSize(100, canvasHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 150 / canvasHeight, 0.1, 100);
camera.position.set(0, 2, 15);
camera.lookAt(0, 1, 0);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 2, 3);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// GLB 로드
let headBone = null;
let neckBone = null;
let baseHeadY = null;
const loader = new THREE.GLTFLoader();

loader.load(chrome.runtime.getURL('assets/hamster.glb'), (gltf) => {
    const model = gltf.scene;
    model.scale.set(0.3, 0.3, 0.3);
    model.position.set(1, -5, 0);
    scene.add(model);

    model.traverse((obj) => {
        if (obj.isBone) console.log('bone:', obj.name);
        if (obj.isBone && obj.name === 'Neck') neckBone = obj;
        if (obj.isBone && obj.name === 'Head') {
            headBone = obj;
            baseHeadY = obj.position.y;
        }
    });
});


// 애니메이션 루프 수정
let elapsedSeconds = 0;
let lastTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    // 시간 누적
    const now = performance.now();
    elapsedSeconds += (now - lastTime) / 10;
    lastTime = now;

    // 목 늘이기 (1분마다 0.1씩 늘어남)
    if (headBone && baseHeadY !== null) {
        const stretch = (elapsedSeconds / 60) * 0.1;
        headBone.position.y = baseHeadY + stretch;
        // // 목이 어느정도 늘어나면 옆모습으로 전환
        // if (stretch > 0.3) {
        //     // 카메라가 서서히 옆으로 이동
        //     camera.position.x += 0.01;
        //     camera.lookAt(0, 1, 0);
        // }
    }

    renderer.render(scene, camera);
}
animate();