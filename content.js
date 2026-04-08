
console.log('neckster content.js 로드됨!');


// 캔버스 생성 & 오버레이 고정
const canvas = document.createElement('canvas');
canvas.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 120px;
  height: 120px;
  z-index: 999999;
  pointer-events: auto;
`;


document.body.appendChild(canvas);

// Three.js 기본 세팅
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
renderer.setSize(120, 140);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 120 / 160, 0.1, 100);
camera.position.set(0, 2, 4);
camera.lookAt(0, 1, 0);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 2, 3);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// GLB 로드
let headBone = null;
const loader = new THREE.GLTFLoader();

loader.load(chrome.runtime.getURL('assets/hamster.glb'), (gltf) => {
    const model = gltf.scene;
    model.scale.set(0.5, 0.5, 0.5);  // ← 크기 줄이기
    model.position.set(0, 0, 0);      // ← 위치
    scene.add(model);

    // bone 이름 확인용 (처음엔 콘솔로 확인)
    model.traverse((obj) => {
        if (obj.isBone) console.log('bone:', obj.name);
        if (obj.isBone && obj.name === 'Head') headBone = obj;
    });
});

// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();