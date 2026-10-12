import { useEffect, useRef, useState } from 'react';
import type {
  AnimationAction,
  AnimationMixer,
  Euler,
  Group,
  Material,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { DRACOLoader as DracoLoaderType } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { detectCompanionCapabilities, shouldEnableCompanion, watchReducedMotion } from './companionPolicy';
import { ACTIVE_CAT, type CatConfig } from './catConfig';

type ThreeModule = typeof import('three');
type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};
type BlinkTarget = { influences: number[]; index: number };

export interface CatCompanionProps {
  onReady?: () => void;
  onUnavailable?: () => void;
  trackPagePointer?: boolean;
  due?: number;
  goalComplete?: boolean;
  config?: CatConfig;
}

const TAP_MESSAGES = ['にゃ〜 · Chào bạn!', 'Ấm quá… cảm ơn nhé.', 'Mình ở đây, cứ từ từ thôi.', 'ごろごろ… ♡'];
const SESSION_GREETING_KEY = 'n3-cat-companion-greeting-seen';

export function CatCompanion({
  onReady,
  onUnavailable,
  trackPagePointer = false,
  due = 0,
  goalComplete = false,
  config = ACTIVE_CAT,
}: CatCompanionProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const onUnavailableRef = useRef(onUnavailable);
  const learningStateRef = useRef({ due, goalComplete });
  const [bubble, setBubble] = useState('');

  useEffect(() => {
    onReadyRef.current = onReady;
    onUnavailableRef.current = onUnavailable;
    learningStateRef.current = { due, goalComplete };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !shouldEnableCompanion(detectCompanionCapabilities())) {
      onUnavailableRef.current?.();
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'button');
    canvas.setAttribute('aria-label', 'Chạm để chào Kuro');
    canvas.tabIndex = 0;
    host.prepend(canvas);

    let disposed = false;
    let initialized = false;
    let visible = false;
    let reducedMotion = false;
    let resourcesDisposed = false;
    let idleHandle: number | ReturnType<typeof setTimeout> | null = null;
    let frameHandle = 0;
    let lastFrame = 0;
    let lastTick = 0;
    let elapsed = 0;
    let renderer: WebGLRenderer | null = null;
    let scene: Scene | null = null;
    let appearance: { update: (dt: number) => void; dispose: () => void } | null = null;
    let camera: PerspectiveCamera | null = null;
    let catRoot: Group | null = null;
    let visual: Object3D | null = null;
    let head: Object3D | null = null;
    let neck: Object3D | null = null;
    let tail: Object3D | null = null;
    let headRest: Quaternion | null = null;
    let neckRest: Quaternion | null = null;
    let tailRestZ = 0;
    let mixer: AnimationMixer | null = null;
    let idleAction: AnimationAction | null = null;
    let tapAction: AnimationAction | null = null;
    let tapStartedAt = 0;
    let tapReturnTimer: ReturnType<typeof setTimeout> | null = null;
    let bubbleTimer: ReturnType<typeof setTimeout> | null = null;
    let blinkTimer: ReturnType<typeof setTimeout> | null = null;
    let blinkStartedAt = 0;
    let blinkTargets: BlinkTarget[] = [];
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let pointerUpdatedAt = 0;
    let pointerIsTouch = false;
    let currentYaw = 0;
    let currentPitch = 0;
    let THREE: ThreeModule | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let headWorldPosition: Vector3 | null = null;
    let lookEuler: Euler | null = null;
    let lookQuaternion: Quaternion | null = null;

    const showBubble = (message: string, duration = 2_500) => {
      if (bubbleTimer) clearTimeout(bubbleTimer);
      setBubble(message);
      bubbleTimer = setTimeout(() => setBubble(''), duration);
    };

    const stopBlinking = () => {
      if (blinkTimer) clearTimeout(blinkTimer);
      blinkTimer = null;
      blinkStartedAt = 0;
      for (const target of blinkTargets) target.influences[target.index] = 0;
    };

    const scheduleBlink = () => {
      if (!blinkTargets.length || blinkTimer || disposed) return;
      blinkTimer = setTimeout(() => {
        blinkTimer = null;
        blinkStartedAt = performance.now();
      }, (config.blink.minInterval + Math.random() * Math.max(0, config.blink.maxInterval - config.blink.minInterval)) * 1_000);
    };

    const stopLoop = () => {
      if (frameHandle) cancelAnimationFrame(frameHandle);
      frameHandle = 0;
      stopBlinking();
    };

    const disposeMaterial = (material: Material, textures: Set<Texture>) => {
      if (!THREE) return;
      for (const value of Object.values(material as unknown as Record<string, unknown>)) {
        if (value instanceof THREE.Texture && !textures.has(value)) {
          textures.add(value);
          value.dispose();
        }
      }
      material.dispose();
    };

    const disposeObjectResources = (root: Object3D) => {
      if (!THREE) return;
      const textures = new Set<Texture>();
      root.traverse(object => {
        const candidate = object as Mesh & {
          isSkinnedMesh?: boolean;
          isInstancedMesh?: boolean;
          skeleton?: { dispose: () => void };
          dispose?: () => void;
        };
        if (!candidate.isMesh) return;
        candidate.skeleton?.dispose();
        if (candidate.isInstancedMesh) candidate.dispose?.();
        candidate.geometry?.dispose();
        const materials = Array.isArray(candidate.material) ? candidate.material : [candidate.material];
        for (const material of materials) if (material) disposeMaterial(material, textures);
      });
    };

    const disposeResources = () => {
      if (resourcesDisposed) return;
      resourcesDisposed = true;
      stopLoop();
      if (tapReturnTimer) clearTimeout(tapReturnTimer);
      if (bubbleTimer) clearTimeout(bubbleTimer);
      mixer?.stopAllAction();
      appearance?.dispose();
      appearance = null;
      if (scene) disposeObjectResources(scene);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      renderer?.renderLists.dispose();
      if (renderer) {
        // Three keeps one internal empty sampler alive until renderer.dispose(); app-owned GPU resources must be gone here.
        const memoryReleased = renderer.info.memory.geometries === 0 && renderer.info.memory.textures <= 1;
        if (!memoryReleased && import.meta.env.DEV) {
          console.debug('Cat companion released resources before renderer disposal.', { ...renderer.info.memory });
        }
      }
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer = null;
    };

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      disposeResources();
      canvas.remove();
      onUnavailableRef.current?.();
    };

    const findObject = (root: Object3D, preferred: string | undefined, fallback: RegExp) => {
      let exact: Object3D | null = null;
      let approximate: Object3D | null = null;
      root.traverse(object => {
        if (!exact && preferred && object.name.toLowerCase() === preferred.toLowerCase()) exact = object;
        if (!approximate && fallback.test(object.name)) approximate = object;
      });
      return exact ?? approximate;
    };

    const collectBlinkTargets = (root: Object3D) => {
      const names = config.blinkMorphNames ?? [];
      const targets: BlinkTarget[] = [];
      root.traverse(object => {
        const mesh = object as Mesh;
        if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
        for (const name of names) {
          const index = mesh.morphTargetDictionary[name];
          if (index !== undefined) targets.push({ influences: mesh.morphTargetInfluences, index });
        }
      });
      return targets;
    };

    const normalizeModel = (object: Object3D) => {
      if (!THREE || !catRoot) return null;
      const initialBox = new THREE.Box3().setFromObject(object);
      const initialSize = initialBox.getSize(new THREE.Vector3());
      const scale = (2.45 * config.scale) / Math.max(0.001, initialSize.y);
      object.scale.multiplyScalar(scale);
      object.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      object.position.x -= center.x;
      object.position.y -= box.min.y;
      object.position.z -= center.z;
      catRoot.position.set(...config.position);
      object.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(object);
    };

    const createPrimitiveCat = () => {
      if (!THREE) throw new Error('Three.js is unavailable.');
      const root = new THREE.Group();
      root.name = 'PrimitiveBlackCat';
      const charcoal = new THREE.MeshStandardMaterial({ color: 0x272c2b, roughness: 0.78, metalness: 0.02 });
      const softBlack = new THREE.MeshStandardMaterial({ color: 0x3b403e, roughness: 0.72 });
      const cream = new THREE.MeshStandardMaterial({ color: 0xfff4e0, roughness: 0.9 });
      const eye = new THREE.MeshStandardMaterial({ color: 0xd7c568, emissive: 0x403813, emissiveIntensity: 0.35 });
      const vermilion = new THREE.MeshStandardMaterial({ color: 0xb8473e, roughness: 0.7 });

      const body = new THREE.Mesh(new THREE.SphereGeometry(0.68, 24, 18), charcoal);
      body.scale.set(0.78, 1.08, 0.66);
      body.position.y = 0.78;
      root.add(body);

      const chest = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), cream);
      chest.scale.set(0.62, 1.15, 0.22);
      chest.position.set(0, 0.98, 0.52);
      root.add(chest);

      const neckGroup = new THREE.Group();
      neckGroup.name = 'Neck';
      neckGroup.position.y = 1.48;
      root.add(neckGroup);

      const headGroup = new THREE.Group();
      headGroup.name = 'Head';
      neckGroup.add(headGroup);
      const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.58, 28, 20), softBlack);
      headMesh.scale.set(1, 0.92, 0.88);
      headGroup.add(headMesh);

      const earGeometry = new THREE.ConeGeometry(0.28, 0.55, 3);
      const leftEar = new THREE.Mesh(earGeometry, softBlack);
      leftEar.position.set(-0.37, 0.48, 0);
      leftEar.rotation.z = 0.08;
      const rightEar = leftEar.clone();
      rightEar.position.x = 0.37;
      rightEar.rotation.z = -0.08;
      headGroup.add(leftEar, rightEar);

      for (const x of [-0.21, 0.21]) {
        const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), eye);
        eyeball.position.set(x, 0.08, 0.52);
        eyeball.scale.set(0.8, 1.35, 0.45);
        headGroup.add(eyeball);
      }
      const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), cream);
      muzzle.scale.set(1.35, 0.7, 0.45);
      muzzle.position.set(0, -0.16, 0.53);
      headGroup.add(muzzle);

      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.045, 8, 24), vermilion);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 1.43;
      root.add(collar);

      const tailGroup = new THREE.Group();
      tailGroup.name = 'Tail';
      tailGroup.position.set(-0.48, 0.72, -0.12);
      const tailMesh = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.085, 9, 30, Math.PI * 1.35), charcoal);
      tailMesh.rotation.set(0.2, -0.25, 0.45);
      tailGroup.add(tailMesh);
      root.add(tailGroup);
      return root;
    };

    const getGlbExtensions = (buffer: ArrayBuffer): string[] => {
      if (buffer.byteLength < 20) throw new Error('Invalid GLB header.');
      const view = new DataView(buffer);
      if (view.getUint32(0, true) !== 0x46546c67) throw new Error('Invalid GLB magic; expected glTF.');
      if (view.getUint32(16, true) !== 0x4e4f534a) throw new Error('Invalid GLB JSON chunk.');
      const chunkLength = view.getUint32(12, true);
      if (20 + chunkLength > buffer.byteLength) throw new Error('Invalid GLB JSON length.');
      const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, chunkLength))) as { extensionsUsed?: string[] };
      return Array.isArray(json.extensionsUsed) ? json.extensionsUsed : [];
    };

    const loadGlb = async (): Promise<GLTF> => {
      const controller = new AbortController();
      let dracoLoader: DracoLoaderType | null = null;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      try {
        const work = async () => {
          const response = await fetch(config.url, { signal: controller.signal });
          if (!response.ok) throw new Error(`Cat model request failed with ${response.status}.`);
          const buffer = await response.arrayBuffer();
          const extensions = getGlbExtensions(buffer);
          if (extensions.includes('KHR_texture_basisu')) throw new Error('KTX2 chưa hỗ trợ.');
          const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
          const loader = new GLTFLoader();
          if (extensions.includes('KHR_draco_mesh_compression')) {
            const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');
            dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('/vendor/draco/');
            loader.setDRACOLoader(dracoLoader);
          }
          if (extensions.includes('EXT_meshopt_compression')) {
            const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
            loader.setMeshoptDecoder(MeshoptDecoder);
          }
          const basePath = config.url.slice(0, config.url.lastIndexOf('/') + 1);
          return await new Promise<GLTF>((resolve, reject) => loader.parse(buffer, basePath, resolve, reject));
        };
        const timedOut = new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new Error('Cat model loading timed out.'));
          }, 12_000);
        });
        return await Promise.race([work(), timedOut]);
      } finally {
        if (timeout) clearTimeout(timeout);
        dracoLoader?.dispose();
      }
    };

    const pickClip = (clips: GLTF['animations'], preferred: string | undefined, fallback: RegExp) => {
      if (preferred) {
        const exact = clips.find(clip => clip.name.toLowerCase() === preferred.toLowerCase());
        if (exact) return exact;
      }
      return clips.find(clip => fallback.test(clip.name));
    };

    const updateLook = (dt: number, now: number) => {
      if (!THREE || !camera || !catRoot || !visual || !headWorldPosition || !lookEuler || !lookQuaternion) return;
      let targetYaw = 0;
      let targetPitch = 0;
      const resetDelay = pointerIsTouch ? 3_000 : 4_000;
      if (pointerUpdatedAt > 0 && now - pointerUpdatedAt <= resetDelay) {
        const target = head ?? visual;
        const projected = target.getWorldPosition(headWorldPosition).project(camera);
        const canvasRect = canvas.getBoundingClientRect();
        const headX = canvasRect.left + (projected.x + 1) * 0.5 * canvasRect.width;
        const headY = canvasRect.top + (1 - projected.y) * 0.5 * canvasRect.height;
        const nx = THREE.MathUtils.clamp((pointerX - headX) / (canvasRect.width * 0.5), -1, 1);
        const ny = THREE.MathUtils.clamp((pointerY - headY) / (canvasRect.height * 0.5), -1, 1);
        targetYaw = nx * config.maxYawDeg;
        targetPitch = -ny * config.maxPitchDeg;
      }

      const damping = 1 - Math.exp(-dt * 10);
      currentYaw += (targetYaw - currentYaw) * damping;
      currentPitch += (targetPitch - currentPitch) * damping;
      const applyRotation = (object: Object3D, rest: Quaternion, fraction: number) => {
        lookEuler.set(0, 0, 0);
        lookEuler[config.lookAxisMap.yaw] = THREE.MathUtils.degToRad(currentYaw * config.lookAxisMap.yawSign * fraction);
        lookEuler[config.lookAxisMap.pitch] = THREE.MathUtils.degToRad(currentPitch * config.lookAxisMap.pitchSign * fraction);
        lookQuaternion.setFromEuler(lookEuler);
        object.quaternion.copy(rest).multiply(lookQuaternion);
      };
      if (head && headRest) {
        applyRotation(head, headRest, neck && neckRest ? 0.6 : 1);
        if (neck && neckRest) applyRotation(neck, neckRest, 0.4);
      } else {
        catRoot.rotation.y = THREE.MathUtils.degToRad(currentYaw / Math.max(1, config.maxYawDeg) * config.fallbackBodyDeg);
        catRoot.rotation.x = THREE.MathUtils.degToRad(currentPitch / Math.max(1, config.maxPitchDeg) * config.fallbackBodyDeg * 0.45);
      }
    };

    const updateTap = (now: number) => {
      if (!catRoot || !tapStartedAt || tapAction) return;
      const progress = Math.min(1, (now - tapStartedAt) / 1_100);
      catRoot.rotation.z += Math.sin(progress * Math.PI) * config.motion.petTiltDeg * Math.PI / 180;
      if (progress >= 1) tapStartedAt = 0;
    };

    const updateBlink = (now: number) => {
      if (!blinkStartedAt) return;
      const progress = Math.min(1, (now - blinkStartedAt) / Math.max(80, config.blink.duration * 1_000));
      const phase = progress < 0.38 ? progress / 0.38 : (1 - progress) / 0.62;
      const value = phase * phase * (3 - 2 * phase);
      for (const target of blinkTargets) target.influences[target.index] = value;
      if (progress >= 1) {
        blinkStartedAt = 0;
        scheduleBlink();
      }
    };

    const renderFrame = (now: number) => {
      frameHandle = 0;
      if (disposed || !visible || document.hidden || reducedMotion || !renderer || !scene || !camera || !catRoot) return;
      frameHandle = requestAnimationFrame(renderFrame);
      if (now - lastFrame < 33) return;
      const dt = Math.min(0.1, Math.max(0, (now - lastTick) / 1_000));
      lastTick = now;
      lastFrame = now;
      elapsed += dt;
      mixer?.update(dt);
      if (!mixer) {
        catRoot.scale.set(1, 1 + Math.sin(elapsed * config.motion.breathSpeed) * config.motion.breathAmplitude, 1);
        catRoot.rotation.z = Math.sin(elapsed * 0.65) * config.motion.idleSwayDeg * Math.PI / 180;
        if (tail) tail.rotation.z = tailRestZ + Math.sin(elapsed * 1.8) * 0.16;
      }
      scene.updateMatrixWorld(true);
      // Look offsets run after mixer.update so idle animation keeps the body while head/neck follow the pointer.
      updateLook(dt, now);
      updateTap(now);
      updateBlink(now);
      appearance?.update(dt);
      renderer.render(scene, camera);
    };

    const syncLoop = () => {
      const shouldRun = Boolean(renderer && scene && camera && visible && !document.hidden && !reducedMotion && !disposed);
      if (shouldRun && !frameHandle) {
        lastTick = performance.now();
        lastFrame = 0;
        frameHandle = requestAnimationFrame(renderFrame);
        scheduleBlink();
      } else if (!shouldRun) stopLoop();
    };

    const resize = () => {
      if (!renderer || !camera) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const initialize = async () => {
      if (initialized || disposed) return;
      initialized = true;
      try {
        THREE = await import('three');
        if (disposed) return;
        headWorldPosition = new THREE.Vector3();
        lookEuler = new THREE.Euler();
        lookQuaternion = new THREE.Quaternion();
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
        renderer.setClearAlpha(0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = config.scene.toneMappingExposure;
        canvas.addEventListener('webglcontextlost', handleContextLost, { passive: false });

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(config.camera.fov, 1, 0.1, 100);

        catRoot = new THREE.Group();
        scene.add(catRoot);
        let clips: GLTF['animations'] = [];
        if (config.url) {
          const gltf = await loadGlb();
          if (disposed) {
            disposeObjectResources(gltf.scene);
            return;
          }
          visual = gltf.scene;
          clips = gltf.animations;
        } else {
          visual = createPrimitiveCat();
        }
        catRoot.add(visual);
        normalizeModel(visual);
        const { setupCatAppearance } = await import('./catAppearance');
        if (disposed) return;
        const setup = setupCatAppearance(renderer, scene, camera, visual, config);
        appearance = setup;
        visual.updateMatrixWorld(true);
        head = findObject(visual, config.headBoneName, /head/i);
        neck = findObject(visual, config.neckBoneName, /neck/i);
        tail = findObject(visual, undefined, /tail/i);
        headRest = head?.quaternion.clone() ?? null;
        neckRest = neck?.quaternion.clone() ?? null;
        tailRestZ = tail?.rotation.z ?? 0;
        blinkTargets = collectBlinkTargets(visual);

        if (clips.length) {
          mixer = new THREE.AnimationMixer(visual);
          const idleClip = pickClip(clips, config.idleClip, /idle/i);
          const tapClip = pickClip(clips, config.tapClip, /tap|click|touch/i);
          if (idleClip) idleAction = mixer.clipAction(idleClip).play();
          if (tapClip) tapAction = mixer.clipAction(tapClip);
        }

        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        resize();
        syncLoop();
        onReadyRef.current?.();

        try {
          if (!sessionStorage.getItem(SESSION_GREETING_KEY)) {
            const learning = learningStateRef.current;
            const message = learning.goalComplete
              ? '今日はよくできました！'
              : learning.due > 0 ? 'Mình cùng ôn một chút nhé.' : 'Chào bạn. Hôm nay mình học gì?';
            if (message) {
              showBubble(message, 3_000);
              sessionStorage.setItem(SESSION_GREETING_KEY, '1');
            }
          }
        } catch {
          // Storage can be blocked; the decorative greeting may safely repeat.
        }
      } catch (error) {
        console.error('Không thể hiển thị mèo 3D:', error);
        disposeResources();
        onUnavailableRef.current?.();
      }
    };

    const scheduleInitialize = () => {
      if (initialized || idleHandle !== null) return;
      const idleWindow = window as IdleWindow;
      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(() => void initialize(), { timeout: 900 });
      } else {
        idleHandle = window.setTimeout(() => void initialize(), 250);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      pointerUpdatedAt = performance.now();
      pointerIsTouch = event.pointerType === 'touch';
    };
    const handlePointerExit = (event: MouseEvent) => {
      if (event.relatedTarget === null) pointerUpdatedAt = 0;
    };
    const handlePointerDown = () => {
      if (!renderer || !catRoot) return;
      if (blinkTargets.length && !reducedMotion) {
        if (blinkTimer) clearTimeout(blinkTimer);
        blinkTimer = null;
        blinkStartedAt = performance.now();
      }
      showBubble(TAP_MESSAGES[Math.floor(Math.random() * TAP_MESSAGES.length)]);
      if (tapAction && THREE) {
        tapAction.reset().setLoop(THREE.LoopOnce, 1);
        tapAction.clampWhenFinished = false;
        if (idleAction) tapAction.crossFadeFrom(idleAction, 0.25, false);
        tapAction.play();
        if (tapReturnTimer) clearTimeout(tapReturnTimer);
        tapReturnTimer = setTimeout(() => {
          if (idleAction && tapAction) idleAction.reset().crossFadeFrom(tapAction, 0.25, false).play();
        }, Math.max(350, tapAction.getClip().duration * 1_000 - 250));
      } else {
        tapStartedAt = performance.now();
      }
    };

    const visibilityObserver = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible) scheduleInitialize();
      syncLoop();
    }, { rootMargin: '180px' });
    visibilityObserver.observe(host);
    const stopWatchingMotion = watchReducedMotion(reduced => {
      reducedMotion = reduced;
      syncLoop();
    });
    const handleVisibility = () => syncLoop();
    const pointerTarget: Window | HTMLDivElement = trackPagePointer ? window : host;
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('mouseout', handlePointerExit);
    pointerTarget.addEventListener('pointermove', handlePointerMove as EventListener, { passive: true });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handlePointerDown(); }
    };
    canvas.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('pointerdown', handlePointerDown, { passive: true });

    return () => {
      disposed = true;
      visibilityObserver.disconnect();
      resizeObserver?.disconnect();
      stopWatchingMotion();
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('mouseout', handlePointerExit);
      pointerTarget.removeEventListener('pointermove', handlePointerMove as EventListener);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('keydown', handleKeyDown);
      if (idleHandle !== null) {
        const idleWindow = window as IdleWindow;
        if (idleWindow.cancelIdleCallback && idleWindow.requestIdleCallback) idleWindow.cancelIdleCallback(idleHandle as number);
        else clearTimeout(idleHandle);
      }
      disposeResources();
      canvas.remove();
    };
  }, [trackPagePointer, config]);

  return <div ref={hostRef} className="dashboard-cat-host">
    <span role="status" className={`dashboard-cat-bubble ${bubble ? 'is-visible' : ''}`}>{bubble}</span>
  </div>;
}

export default CatCompanion;
