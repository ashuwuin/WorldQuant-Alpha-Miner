'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const EASINGS = {
  'power3.out': 'cubic-bezier(0.215, 0.61, 0.355, 1)',
  'expo.out': 'cubic-bezier(0.16, 1, 0.3, 1)',
  'back.out(1.6)': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  'power2.out': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  'power3.in': 'cubic-bezier(0.55, 0.055, 0.675, 0.19)'
};

const AnimatedContent = ({
  children,
  container,
  distance = 40,
  direction = 'vertical',
  reverse = false,
  duration = 0.7,
  ease = 'power3.out',
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  blur = 0,
  rotate = 0,
  tilt = 0,
  wipe = 'none',
  threshold = 0.1,
  delay = 0,
  stagger = 0,
  staggerFrom = 'start',
  trigger = 'mount',
  once = true,
  onStart,
  onComplete,
  className = '',
  style,
  ...props
}) => {
  const ref = useRef(null);
  const callbacksRef = useRef({ onStart, onComplete });
  callbacksRef.current = { onStart, onComplete };

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const targets = stagger > 0 && el.children.length ? Array.from(el.children) : [el];
    const horizontal = direction === 'horizontal';
    const sign = reverse ? -1 : 1;
    const offset = distance * sign;
    const cssEase = EASINGS[ease] || 'cubic-bezier(0.215, 0.61, 0.355, 1)';

    el.style.visibility = 'visible';

    if (reduce) {
      callbacksRef.current.onComplete?.();
      return undefined;
    }

    const total = targets.length;
    const orderDelay = index => {
      if (stagger <= 0 || total <= 1) return 0;
      if (staggerFrom === 'end') return (total - 1 - index) * stagger;
      if (staggerFrom === 'center') return Math.abs((total - 1) / 2 - index) * stagger;
      return index * stagger;
    };

    const setInitial = () => {
      targets.forEach(node => {
        const tx = horizontal ? `${offset}px` : '0px';
        const ty = horizontal ? '0px' : `${offset}px`;
        const rot = rotate ? ` rotate(${rotate * sign}deg)` : '';
        const sc = scale !== 1 ? ` scale(${scale})` : '';
        node.style.opacity = String(animateOpacity ? initialOpacity : 1);
        node.style.transform = `translate3d(${tx}, ${ty}, 0)${sc}${rot}`;
        if (blur > 0) node.style.filter = `blur(${blur}px)`;
        node.style.transition = 'none';
      });
    };

    let timers = [];
    const play = () => {
      callbacksRef.current.onStart?.();
      targets.forEach((node, index) => {
        const d = (Math.max(0, delay) + orderDelay(index)) * 1000;
        const timer = window.setTimeout(() => {
          node.style.transition = `transform ${duration}s ${cssEase}, opacity ${duration}s ${cssEase}, filter ${duration}s ${cssEase}`;
          node.style.opacity = '1';
          node.style.transform = 'translate3d(0, 0, 0) scale(1) rotate(0deg)';
          if (blur > 0) node.style.filter = 'blur(0px)';
        }, d);
        timers.push(timer);
      });
      const finishTime = (Math.max(0, delay) + duration + (total > 1 ? total * stagger : 0)) * 1000;
      const doneTimer = window.setTimeout(() => {
        targets.forEach(node => {
          node.style.transition = '';
          node.style.transform = '';
          node.style.filter = '';
        });
        callbacksRef.current.onComplete?.();
      }, finishTime + 40);
      timers.push(doneTimer);
    };

    setInitial();

    if (trigger === 'mount') {
      const raf = requestAnimationFrame(() => play());
      return () => {
        cancelAnimationFrame(raf);
        timers.forEach(clearTimeout);
      };
    }

    let scroller = container || null;
    if (typeof scroller === 'string') scroller = document.querySelector(scroller);
    if (scroller && 'current' in scroller) scroller = scroller.current;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            play();
            if (once) observer.disconnect();
          } else if (!once) {
            setInitial();
          }
        });
      },
      {
        root: scroller instanceof Element ? scroller : null,
        threshold: Math.min(1, Math.max(0, threshold))
      }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [
    container,
    distance,
    direction,
    reverse,
    duration,
    ease,
    initialOpacity,
    animateOpacity,
    scale,
    blur,
    rotate,
    tilt,
    wipe,
    threshold,
    delay,
    stagger,
    staggerFrom,
    trigger,
    once
  ]);

  return (
    <div ref={ref} className={className} style={{ visibility: 'hidden', ...style }} {...props}>
      {children}
    </div>
  );
};

export default AnimatedContent;
