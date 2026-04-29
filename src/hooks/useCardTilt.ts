import { useRef, useCallback } from 'react';

export function useCardTilt() {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width  / 2) / (r.width  / 2);
    const dy = (e.clientY - r.top  - r.height / 2) / (r.height / 2);
    el.style.transition = '';
    el.style.transform = `perspective(500px) rotateX(${(-dy * 12).toFixed(2)}deg) rotateY(${(dx * 12).toFixed(2)}deg) scale(1.05)`;
    el.style.borderColor = 'rgba(99,102,241,0.5)';
    el.style.boxShadow = '0 16px 32px rgba(0,0,0,0.4), 0 0 20px rgba(99,102,241,0.15)';
    el.style.setProperty('--shine-x', ((e.clientX - r.left) / r.width  * 100).toFixed(1) + '%');
    el.style.setProperty('--shine-y', ((e.clientY - r.top)  / r.height * 100).toFixed(1) + '%');
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = 'transform 0.5s cubic-bezier(0.23,1,0.32,1), border-color 0.3s, box-shadow 0.3s';
    el.style.transform = 'perspective(500px) rotateX(0deg) rotateY(0deg) scale(1)';
    el.style.borderColor = '';
    el.style.boxShadow = '';
    setTimeout(() => {
      if (ref.current) ref.current.style.transition = '';
    }, 500);
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
