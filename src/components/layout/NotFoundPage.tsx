import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <section className="study-page mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
      <p className="study-eyebrow">404</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--color-text)]">Không tìm thấy trang</h1>
      <p className="mt-3 study-copy">Đường dẫn này không còn tồn tại hoặc đã được chuyển sang nơi khác.</p>
      <button className="study-button study-button-primary mt-7" onClick={() => navigate('/today', { replace: true })}>
        <Home size={18} /> Về Hôm nay
      </button>
    </section>
  );
}
