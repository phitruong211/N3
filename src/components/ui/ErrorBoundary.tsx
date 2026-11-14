import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isChunkError, reloadForNewVersion } from '@/lib/chunkReload';

type Props = { children: ReactNode; /** A new value (the current path) clears a previous error, so another menu item works again. */ resetKey?: string; fullScreen?: boolean };
type State = { error: Error | null };

/** Without this, one failed page load unmounts the whole app and leaves a blank screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page failed to render:', error, info.componentStack);
    if (isChunkError(error)) reloadForNewVersion();
  }

  componentDidUpdate(previous: Props) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <div role="alert" className={`flex flex-col items-center justify-center gap-4 p-6 text-center ${this.props.fullScreen ? 'min-h-screen bg-[var(--color-bg)]' : 'min-h-[50vh]'}`}>
      <p className="study-title !text-2xl">Không mở được trang này</p>
      <p className="study-copy max-w-md">{isChunkError(this.state.error) ? 'Có phiên bản mới của ứng dụng. Tải lại trang để tiếp tục.' : 'Có lỗi xảy ra. Tiến độ học của bạn vẫn được giữ.'}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button className="study-button study-button-primary" onClick={() => location.reload()}>Tải lại trang</button>
        <button className="study-button" onClick={() => { location.assign('/today'); }}>Về Hôm nay</button>
      </div>
    </div>;
  }
}
