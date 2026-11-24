import { AppLoading } from '@/components/ui/AppLoading';
import { onDemand } from '@/components/ui/onDemand';

/** The study screen is the app's largest chunk; the pages that can open one download it only when a session starts. */
export const StudySession = onDemand(() => import('./StudySession').then(module => module.StudySession), <AppLoading message="Đang mở phiên học…" />);
