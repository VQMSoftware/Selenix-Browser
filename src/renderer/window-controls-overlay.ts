try {
  const wco = (navigator as any).windowControlsOverlay;

  const applyGeometry = () => {
    if (!wco || typeof wco.getTitlebarAreaRect !== 'function') return;
    const rect = wco.getTitlebarAreaRect();

    // Insets relative to the window edges where native caption buttons live.
    const leftInset = Math.max(0, rect.x);
    const rightInset = Math.max(0, window.innerWidth - (rect.x + rect.width));

    document.documentElement.style.setProperty('--overlay-left-inset', leftInset + 'px');
    document.documentElement.style.setProperty('--overlay-right-inset', rightInset + 'px');
    document.documentElement.style.setProperty('--overlay-height', rect.height + 'px');
  };

  if (wco) {
    applyGeometry();
    wco.addEventListener('geometrychange', applyGeometry);
    window.addEventListener('resize', applyGeometry);
  }
} catch {}
