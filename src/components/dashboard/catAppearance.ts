import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CatConfig } from './catConfig';

/** Giữ nguyên material và COLOR_0 từ GLTFLoader; chỉ chỉnh hệ số PBR. */
export function setupCatAppearance(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  model: THREE.Object3D,
  source: CatConfig,
) {
  const config = structuredClone(source);
  const materials = new Set<THREE.MeshPhysicalMaterial>();
  model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (material instanceof THREE.MeshPhysicalMaterial) materials.add(material);
    }
  });

  // Softbox cục bộ, không cần tải HDR từ mạng.
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();
  scene.environment = environment.texture;
  // Three dùng scene.environmentIntensity thay envMapIntensity khi envMap rỗng.
  // Gán tường minh để cường độ riêng mỗi material vẫn có tác dụng.
  for (const material of materials) {
    material.envMap = environment.texture;
    material.needsUpdate = true;
  }
  const key = new THREE.DirectionalLight();
  const rim = new THREE.DirectionalLight();
  scene.add(key, rim, key.target, rim.target);
  // Bóng tiếp xúc mềm: texture thủ tục, nằm trong mặt phẳng 3D dưới chân.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const context = shadowCanvas.getContext('2d')!;
  const gradient = context.createRadialGradient(64, 64, 5, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(32, 24, 18, 0.32)');
  gradient.addColorStop(0.45, 'rgba(32, 24, 18, 0.15)');
  gradient.addColorStop(1, 'rgba(32, 24, 18, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.35), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(config.position[0], config.position[1] - 0.015, config.position[2]);
  scene.add(shadow);
  let rotation = 0;

  const updateCamera = (dt = 0) => {
    rotation += config.camera.autoRotateSpeed * dt;
    const azimuth = THREE.MathUtils.degToRad(config.camera.azimuth + rotation);
    const elevation = THREE.MathUtils.degToRad(config.camera.elevation);
    const distance = config.camera.distance;
    camera.fov = config.camera.fov;
    camera.position.set(
      config.position[0] + distance * Math.sin(azimuth) * Math.cos(elevation),
      config.position[1] + config.camera.targetY + distance * Math.sin(elevation),
      config.position[2] + distance * Math.cos(azimuth) * Math.cos(elevation),
    );
    camera.lookAt(config.position[0], config.position[1] + config.camera.targetY, config.position[2]);
    camera.updateProjectionMatrix();
  };

  const apply = () => {
    for (const material of materials) {
      if (material.name === 'body') {
        material.color.setRGB(config.body.color, config.body.color, config.body.color);
        material.roughness = config.body.roughness;
        material.clearcoat = config.body.clearcoat;
        material.clearcoatRoughness = config.body.clearcoatRoughness;
        material.envMapIntensity = config.body.envMapIntensity * config.scene.environmentIntensity;
      } else if (material.name === 'eye') {
        material.roughness = config.eye.roughness;
        material.emissive.set(config.eye.emissive);
        material.emissiveIntensity = config.eye.emissiveIntensity;
        material.envMapIntensity = config.eye.envMapIntensity * config.scene.environmentIntensity;
      } else if (material.name === 'pupil') {
        material.roughness = config.pupil.roughness;
        material.envMapIntensity = config.pupil.envMapIntensity * config.scene.environmentIntensity;
      }
      material.needsUpdate = true;
    }
    renderer.toneMappingExposure = config.scene.toneMappingExposure;
    renderer.setClearColor(config.scene.background, config.scene.backgroundAlpha);
    scene.environmentIntensity = config.scene.environmentIntensity;
    for (const [light, values] of [[key, config.scene.key], [rim, config.scene.rim]] as const) {
      light.color.set(values.color);
      light.intensity = values.intensity;
      light.position.set(values.x, values.y, values.z);
      light.target.position.set(config.position[0], config.position[1] + config.camera.targetY, config.position[2]);
    }
    updateCamera();
    renderer.render(scene, camera);
  };
  apply();

  return {
    update: updateCamera,
    dispose: () => {
      scene.remove(shadow);
      shadow.geometry.dispose();
      shadow.material.dispose();
      shadowTexture.dispose();
      for (const material of materials) material.envMap = null;
      scene.environment = null;
      environment.dispose();
      scene.remove(key, rim, key.target, rim.target);
    },
  };
}
