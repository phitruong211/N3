export interface CompanionCapabilities {
  reducedMotion: boolean;
  saveData: boolean;
  slowNetwork: boolean;
  webgl: boolean;
}

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformation;
};

const unavailableCapabilities: CompanionCapabilities = {
  reducedMotion: true,
  saveData: false,
  slowNetwork: false,
  webgl: false,
};

export function shouldEnableCompanion(value: CompanionCapabilities): boolean {
  return !value.reducedMotion && !value.saveData && !value.slowNetwork && value.webgl;
}

export function detectCompanionCapabilities(): CompanionCapabilities {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof navigator === 'undefined') {
    return unavailableCapabilities;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  const connection = (navigator as NavigatorWithConnection).connection;
  const effectiveType = connection?.effectiveType?.toLowerCase();
  const webgl = Boolean(context);

  context?.getExtension('WEBGL_lose_context')?.loseContext();

  return {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.classList.contains('reduced-motion'),
    saveData: connection?.saveData === true,
    slowNetwork: effectiveType === 'slow-2g' || effectiveType === '2g',
    webgl,
  };
}

export function watchReducedMotion(callback: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined;
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const emit = () => callback(query.matches || document.documentElement.classList.contains('reduced-motion'));
  const handleChange = () => emit();
  const classObserver = new MutationObserver(emit);
  query.addEventListener('change', handleChange);
  classObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => {
    query.removeEventListener('change', handleChange);
    classObserver.disconnect();
  };
}
