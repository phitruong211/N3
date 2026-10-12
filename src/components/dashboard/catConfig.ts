export interface CatConfig {
  url: string;
  scale: number;
  position: [number, number, number];
  headBoneName?: string;
  neckBoneName?: string;
  lookAxisMap: { yaw: 'x' | 'y' | 'z'; pitch: 'x' | 'y' | 'z'; yawSign: 1 | -1; pitchSign: 1 | -1 };
  idleClip?: string;
  tapClip?: string;
  blinkMorphNames?: string[];
  blink: { minInterval: number; maxInterval: number; duration: number };
  cropToBust?: boolean;
  maxYawDeg: number;
  maxPitchDeg: number;
  fallbackBodyDeg: number;
  body: { color: number; roughness: number; clearcoat: number; clearcoatRoughness: number; envMapIntensity: number };
  eye: { roughness: number; emissive: string; emissiveIntensity: number; envMapIntensity: number };
  pupil: { roughness: number; envMapIntensity: number };
  scene: {
    toneMappingExposure: number;
    environmentIntensity: number;
    background: string;
    backgroundAlpha: number;
    key: { color: string; intensity: number; x: number; y: number; z: number };
    rim: { color: string; intensity: number; x: number; y: number; z: number };
  };
  motion: { breathAmplitude: number; breathSpeed: number; idleSwayDeg: number; petTiltDeg: number };
  camera: { fov: number; distance: number; azimuth: number; elevation: number; targetY: number; autoRotateSpeed: number };
}

// Tất cả thông số chỉnh mèo ở đây; sửa CONFIG để thay đổi ngoại hình và chuyển động.
export const CONFIG: CatConfig = {
  url: '/models/black-cat/cat_blink.glb', // Model GLB trong public.
  blinkMorphNames: ['Blink'], // Morph mí mắt trong bản GLB mới.
  blink: { minInterval: 3, maxInterval: 6, duration: 0.22 }, // Giây: chớp sau 3–6 giây; nhắm nhanh, mở chậm.
  scale: 1, // 0.5–2: kích thước; model được chuẩn hóa cao 2.45 đơn vị.
  position: [0, 0, 0], // -5–5: vị trí toàn thân trong cảnh.
  lookAxisMap: { yaw: 'y', pitch: 'x', yawSign: 1, pitchSign: -1 },
  cropToBust: false, // false: hiển thị cả tai và đuôi.
  maxYawDeg: 35, // 0–45: độ nhạy ngang với con trỏ.
  maxPitchDeg: 20, // 0–30: độ nhạy dọc với con trỏ.
  fallbackBodyDeg: 6, // 0–12: giới hạn xoay toàn thân khi model không xương.
  body: {
    color: 0.55, // 0.3–3: hệ số nhân vertex color; thấp hơn = đen hơn.
    roughness: 0.62, // 0–1: thấp = bóng; 0.5–0.7 giảm cảm giác nhựa.
    clearcoat: 0.18, // 0–1: độ mạnh lớp bóng phủ ngoài.
    clearcoatRoughness: 0.38, // 0–1: thấp = phản chiếu lớp phủ sắc hơn.
    envMapIntensity: 0.8, // 0–3: phản chiếu softbox trên thân, giúp thấy khối.
  },
  eye: {
    roughness: 0.035, // 0.01–0.5: thấp = điểm sáng trong mắt sắc hơn.
    emissive: '#ff8b22', // Màu phát sáng; giữ cam để hợp vertex color.
    emissiveIntensity: 0.18, // 0–2: tăng để mắt nổi; quá cao sẽ mất chi tiết.
    envMapIntensity: 1.3, // 0–3: độ sáng phản chiếu trong mắt.
  },
  pupil: {
    roughness: 0.04, // 0.01–0.5: độ nhòe phản chiếu trên con ngươi.
    envMapIntensity: 1, // 0–3: điểm sáng trên con ngươi đen.
  },
  scene: {
    toneMappingExposure: 0.95, // 0.3–2: sáng toàn cảnh trước ACES; giảm để đen hơn.
    environmentIntensity: 0.8, // 0–3: cường độ softbox chung, nhân với từng material.
    background: '#f4efe6', // Màu nền khi backgroundAlpha > 0.
    backgroundAlpha: 0, // 0–1: 0 giữ nền dashboard; 1 hiện màu nền đã chọn.
    key: {
      color: '#fff1dd', // Màu đèn chính ấm, tạo khối và điểm sáng.
      intensity: 3, // 0–10: độ sáng đèn chính.
      x: -3, y: 5, z: 4, // -10–10: vị trí đèn chính, phía trước model.
    },
    rim: {
      color: '#91cfff', // Màu viền xanh, làm rõ tai và đuôi đen.
      intensity: 1.8, // 0–10: tăng khi mất viền hoặc quá tối.
      x: 3, y: 3, z: -4, // -10–10: vị trí đèn viền phía sau model.
    },
  },
  motion: {
    breathAmplitude: 0.006, // 0–0.02: nhịp thở co giãn nhẹ, chân giữ trên mặt đất.
    breathSpeed: 1.5, // 0.5–3 rad/giây: tốc độ thở.
    idleSwayDeg: 0.45, // 0–2 độ: chuyển trọng tâm nhẹ khi nghỉ.
    petTiltDeg: 3, // 0–6 độ: nghiêng người khi chạm/vuốt.
  },
  camera: {
    fov: 28, // 15–65 độ: góc rộng ống kính.
    distance: 6.4, // 3–15: khoảng cách tới tâm mèo, tăng để tránh cắt tai/đuôi.
    azimuth: -10, // -180–180 độ: góc ngang ban đầu (0 nhìn từ +Z).
    elevation: 5, // -30–60 độ: góc cao so với tâm mèo.
    targetY: 1.225, // 0–2.5: độ cao điểm camera nhìn vào.
    autoRotateSpeed: 0, // -30–30 độ/giây: 0 tắt tự xoay; âm đảo chiều.
  },
};

export const DEFAULT_CAT = CONFIG;
export const ACTIVE_CAT = CONFIG;
