type AppLoadingProps = {
  message?: string;
  fullScreen?: boolean;
};

export function AppLoading({ message = 'Đang mở trang…', fullScreen = false }: AppLoadingProps) {
  return <div className={`nhat-loading ${fullScreen ? 'nhat-loading-screen' : 'nhat-loading-inline'}`} role="status" aria-live="polite" aria-atomic="true">
    <div className="nhat-loading-art" aria-hidden="true">
      <span className="nhat-loading-halo"/>
      <span className="nhat-loading-orbit"/>
      <span className="nhat-loading-spark nhat-loading-spark-one"/>
      <span className="nhat-loading-spark nhat-loading-spark-two"/>
      <div className="nhat-loading-book"><img src="/so-nhat-mark.svg" alt="" width="80" height="80"/><span className="nhat-loading-page"/></div>
      <span className="nhat-loading-shadow"/>
    </div>
    {fullScreen && <p className="nhat-loading-brand">SỔ NHẬT<span>MỖI NGÀY, MỘT TRANG MỚI</span></p>}
    <p className="nhat-loading-message">{message}</p>
    <span className="nhat-loading-track" aria-hidden="true"><span/></span>
  </div>;
}
