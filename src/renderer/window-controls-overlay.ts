try {
  const isWin = process.platform === 'win32';
  const wco = (navigator as any).windowControlsOverlay;

  const applyGeometry = () => {
    if (!wco || typeof wco.getTitlebarAreaRect !== 'function') return;
    const rect = wco.getTitlebarAreaRect();
    const rightInset = Math.max(0, window.innerWidth - (rect.x + rect.width));
    document.documentElement.style.setProperty('--overlay-right-inset', rightInset + 'px');
    document.documentElement.style.setProperty('--overlay-height', rect.height + 'px');
  };

  if (isWin && wco) {
    applyGeometry();
    wco.addEventListener('geometrychange', applyGeometry);
    window.addEventListener('resize', applyGeometry);
  }
} catch {}