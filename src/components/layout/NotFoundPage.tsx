import { useNavigate } from 'react-router-dom';
import { Crane } from '@/components/ui/ink';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <section className="study-page mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
      <div className="mb-4"><Crane size={150}/></div>
      <p className="study-eyebrow">404</p>
      <h1 className="study-title mt-3">Không tìm thấy trang</h1>
      <p className="mt-3 study-copy">Đường dẫn này không còn tồn tại hoặc đã được chuyển sang nơi khác.</p>
      <button className="study-button study-button-primary mt-7" onClick={() => navigate('/today', { replace: true })}>
        Về Hôm nay
      </button>
    </section>
  );
}
