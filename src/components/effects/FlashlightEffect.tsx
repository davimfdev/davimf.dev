import { useEffect } from 'react';

export default function FlashlightEffect() {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--fl-x', '50%');
    root.style.setProperty('--fl-y', '50%');

    const onMouseMove = (e: MouseEvent) => {
      root.style.setProperty('--fl-x', (e.clientX / window.innerWidth  * 100).toFixed(2) + '%');
      root.style.setProperty('--fl-y', (e.clientY / window.innerHeight * 100).toFixed(2) + '%');
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      root.style.setProperty('--fl-x', (t.clientX / window.innerWidth  * 100).toFixed(2) + '%');
      root.style.setProperty('--fl-y', (t.clientY / window.innerHeight * 100).toFixed(2) + '%');
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
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
          backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.4) 1px, transparent 1px)',
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
          background: 'radial-gradient(circle 140px at var(--fl-x, 50%) var(--fl-y, 50%), transparent 0%, rgba(17,24,39,0.92) 100%)',
          willChange: 'background',
        }}
      />
    </>
  );
}
