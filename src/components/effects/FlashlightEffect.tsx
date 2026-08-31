import { useEffect } from 'react';

export default function FlashlightEffect() {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--fl-x', '50%');
    root.style.setProperty('--fl-y', '50%');

    const touchMoveOptions: AddEventListenerOptions = { passive: true };

    const onMouseMove = (e: MouseEvent) => {
      root.style.setProperty('--fl-x', ((e.clientX / window.innerWidth  * 100) | 0) + '%');
      root.style.setProperty('--fl-y', ((e.clientY / window.innerHeight * 100) | 0) + '%');
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      root.style.setProperty('--fl-x', ((t.clientX / window.innerWidth  * 100) | 0) + '%');
      root.style.setProperty('--fl-y', ((t.clientY / window.innerHeight * 100) | 0) + '%');
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, touchMoveOptions);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove, touchMoveOptions);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle, rgb(var(--accent) / .4) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(circle 140px at var(--fl-x, 50%) var(--fl-y, 50%), transparent 0%, rgb(var(--surface-3) / .92) 100%)',
        }}
      />
    </>
  );
}
