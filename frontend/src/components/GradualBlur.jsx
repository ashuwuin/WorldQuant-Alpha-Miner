'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import './GradualBlur.css';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const clamp01 = value => Math.min(Math.max(value, 0), 1);

const findScroller = (container, root, target, vertical) => {
  if (container) {
    if (typeof container === 'string') return document.querySelector(container);
    return 'current' in container ? container.current : container;
  }
  if (target === 'page') return window;
  const parent = root.parentElement;
  if (!parent) return null;
  const scrolls = node => {
    const style = getComputedStyle(node);
    return /(auto|scroll|overlay)/.test(vertical ? style.overflowY : style.overflowX);
  };
  const sibling = Array.from(parent.children).find(child => child !== root && scrolls(child));
  return sibling || (scrolls(parent) ? parent : null);
};

/**
 * Ultra-lightweight GradualBlur (Zero multi-layer GPU backdrop-filter overhead).
 * Uses a single hardware-composited smooth gradient fade that auto-hides at scroll end.
 */
const GradualBlur = ({
  position = 'bottom',
  target = 'parent',
  height = '3.5rem',
  tint = 'rgba(242, 239, 233, 0.88)',
  autoHide = true,
  container,
  zIndex = 20,
  className = '',
  style
}) => {
  const rootRef = useRef(null);
  const vertical = position === 'top' || position === 'bottom';

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !autoHide) return undefined;
    const scroller = findScroller(container, root, target, vertical);
    if (!scroller) return undefined;
    const element = scroller instanceof Element ? scroller : null;
    const start = position === 'top' || position === 'left';

    const update = () => {
      const page = document.documentElement;
      const offset = element
        ? vertical
          ? element.scrollTop
          : element.scrollLeft
        : vertical
          ? window.scrollY
          : window.scrollX;
      const limit = element
        ? vertical
          ? element.scrollHeight - element.clientHeight
          : element.scrollWidth - element.clientWidth
        : vertical
          ? page.scrollHeight - window.innerHeight
          : page.scrollWidth - window.innerWidth;
      const room = start ? offset : limit - offset;
      root.style.opacity = clamp01(room / 48).toFixed(2);
    };

    update();
    const source = element ?? window;
    source.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      source.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [autoHide, container, target, position, vertical]);

  const dir = position === 'top' ? 'to top' : 'to bottom';

  return (
    <div
      ref={rootRef}
      className={`gradual-blur ${className}`.trim()}
      style={{
        position: target === 'page' ? 'fixed' : 'absolute',
        zIndex,
        left: 0,
        right: 0,
        top: position === 'top' ? 0 : undefined,
        bottom: position === 'bottom' ? 0 : undefined,
        height: typeof height === 'number' ? `${height}px` : height,
        background: `linear-gradient(${dir}, transparent 0%, ${tint} 92%)`,
        transition: 'opacity 0.2s ease-out',
        ...style
      }}
      aria-hidden="true"
    />
  );
};

export default GradualBlur;
