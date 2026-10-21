'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './TargetCursor.css';

const CORNER_ANGLES = [0, 90, 180, 270];

const spring = (state, goal, stiffness, damping, dt) => {
  const steps = 2;
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    state.v += (stiffness * (goal - state.x) - damping * state.v) * h;
    state.x += state.v * h;
  }
};

const resolveElement = value => (value && 'current' in value ? value.current : value) || null;

/**
 * High-Frequency Zero-Lag TargetCursor
 * - Tracks free pointer movement 1:1 with hardware cursor (zero spring latency when moving).
 * - Caches target bounding box on target change/scroll instead of calling getBoundingClientRect() every frame.
 * - Uses crisp dual-contrast borders instead of full-viewport mix-blend-mode: difference to eliminate GPU frame drops.
 */
const TargetCursor = ({
  targetSelector = 'button:not(.no-cursor-lock), a.button, .custom-select-trigger, .cursor-target',
  cursorColor = '#133829',
  hoverDuration = 0.11,
  parallaxOn = true,
  hideDefaultCursor = true,
  size = 22,
  cornerSize = 8,
  thickness = 2,
  padding = 4,
  matchRadius = true,
  dotSize = 4,
  clickEffect = true,
  container
}) => {
  const [host, setHost] = useState(null);
  const rootRef = useRef(null);
  const cornerRefs = useRef([]);
  const dotRef = useRef(null);

  const settingsRef = useRef({
    targetSelector,
    cursorColor,
    hoverDuration: Math.max(0.05, hoverDuration),
    parallaxOn,
    hideDefaultCursor,
    size: Math.max(4, size),
    cornerSize: Math.max(2, cornerSize),
    thickness: Math.max(0.5, thickness),
    padding,
    matchRadius,
    dotSize: Math.max(0, dotSize),
    clickEffect,
    container
  });

  useEffect(() => {
    settingsRef.current = {
      targetSelector,
      cursorColor,
      hoverDuration: Math.max(0.05, hoverDuration),
      parallaxOn,
      hideDefaultCursor,
      size: Math.max(4, size),
      cornerSize: Math.max(2, cornerSize),
      thickness: Math.max(0.5, thickness),
      padding,
      matchRadius,
      dotSize: Math.max(0, dotSize),
      clickEffect,
      container
    };
  }, [
    targetSelector,
    cursorColor,
    hoverDuration,
    parallaxOn,
    hideDefaultCursor,
    size,
    cornerSize,
    thickness,
    padding,
    matchRadius,
    dotSize,
    clickEffect,
    container
  ]);

  useEffect(() => {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setHost(finePointer.matches ? document.body : null);
    update();
    finePointer.addEventListener('change', update);
    return () => finePointer.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!host || !root) return undefined;

    const style = document.createElement('style');
    document.head.appendChild(style);

    const pointer = { x: -100, y: -100, inside: false, seen: false, pressed: false };
    const centerX = { x: -100, v: 0 };
    const centerY = { x: -100, v: 0 };
    const halfW = { x: 11, v: 0 };
    const halfH = { x: 11, v: 0 };
    const radius = { x: 2, v: 0 };
    const press = { x: 0, v: 0 };

    let target = null;
    let cachedRect = null;
    let targetRadius = 0;
    let raf = 0;
    let last = 0;
    let lastRule = '';

    const updateCursorRule = () => {
      const s = settingsRef.current;
      const nextRule =
        s.hideDefaultCursor && pointer.inside ? 'html, html * { cursor: none !important; }' : '';
      if (lastRule !== nextRule) {
        style.textContent = nextRule;
        lastRule = nextRule;
      }
    };

    const findTarget = element => {
      if (!element || typeof element.closest !== 'function') return null;
      const s = settingsRef.current;
      if (element.closest('.no-cursor-lock')) return null;
      const found = element.closest(s.targetSelector);
      if (!found || found.disabled) return null;
      const rect = found.getBoundingClientRect();
      if (rect.height > 96 || rect.width < 16) return null;
      return { el: found, rect };
    };

    const lockOn = match => {
      const nextEl = match ? match.el : null;
      if (nextEl === target) {
        if (match) cachedRect = match.rect;
        return;
      }
      target = nextEl;
      if (target && match) {
        cachedRect = match.rect;
        targetRadius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 6;
      } else {
        cachedRect = null;
      }
    };

    const frame = now => {
      raf = 0;
      const s = settingsRef.current;
      const dt = last ? Math.min(0.033, (now - last) / 1000) : 1 / 120;
      last = now;

      if (target && !target.isConnected) {
        target = null;
        cachedRect = null;
      }

      const locked = !!target && !!cachedRect && pointer.inside;
      const snapW = 5.2 / s.hoverDuration;
      const snapK = snapW * snapW;
      const snapC = 2 * 0.78 * snapW;

      spring(press, pointer.pressed && s.clickEffect ? 1 : 0, 1100, 48, dt);

      let goalX = pointer.x;
      let goalY = pointer.y;
      let goalW = s.size / 2;
      let goalH = s.size / 2;
      let goalR = 2;

      if (locked && cachedRect) {
        const cx = cachedRect.left + cachedRect.width / 2;
        const cy = cachedRect.top + cachedRect.height / 2;
        const lean = s.parallaxOn ? 0.05 : 0;
        goalX = cx + (pointer.x - cx) * lean;
        goalY = cy + (pointer.y - cy) * lean;
        goalW = cachedRect.width / 2 + s.padding;
        goalH = cachedRect.height / 2 + s.padding;
        goalR = s.matchRadius ? Math.min(targetRadius + 2, s.cornerSize) : 2;

        spring(centerX, goalX, snapK, snapC, dt);
        spring(centerY, goalY, snapK, snapC, dt);
      } else {
        // 1:1 Instant Hardware Tracking when not locked on a button (Zero Lag!)
        centerX.x = goalX;
        centerX.v = 0;
        centerY.x = goalY;
        centerY.v = 0;
      }

      spring(halfW, goalW, snapK, snapC, dt);
      spring(halfH, goalH, snapK, snapC, dt);
      spring(radius, goalR, snapK, snapC, dt);

      const squeeze = 1 - press.x * 0.12;
      const w = Math.max(0, halfW.x) * squeeze;
      const h = Math.max(0, halfH.x) * squeeze;
      const local = [
        [-w, -h],
        [w, -h],
        [w, h],
        [-w, h]
      ];
      const r = Math.max(0, Math.min(radius.x, s.cornerSize));

      for (let i = 0; i < 4; i++) {
        const corner = cornerRefs.current[i];
        if (!corner) continue;
        const [lx, ly] = local[i];
        const x = centerX.x + lx;
        const y = centerY.x + ly;
        corner.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${CORNER_ANGLES[i]}deg)`;
        corner.style.borderTopLeftRadius = `${r.toFixed(1)}px`;
      }

      const dot = dotRef.current;
      if (dot) {
        const dotScale = 1 - press.x * 0.3;
        dot.style.transform = `translate3d(${pointer.x.toFixed(1)}px, ${pointer.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${dotScale.toFixed(2)})`;
      }

      root.style.opacity = pointer.inside ? '1' : '0';

      const stillAnimating =
        Math.abs(halfW.v) + Math.abs(halfH.v) + Math.abs(centerX.v) + Math.abs(centerY.v) > 0.04 ||
        Math.abs(goalW - halfW.x) + Math.abs(goalH - halfH.x) > 0.1 ||
        Math.abs(press.v) > 0.01;

      if (stillAnimating) {
        raf = requestAnimationFrame(frame);
      } else {
        last = 0;
      }
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const onPointerMove = event => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (!pointer.inside) {
        pointer.inside = true;
        updateCursorRule();
      }
      if (!pointer.seen) {
        centerX.x = pointer.x;
        centerY.x = pointer.y;
        pointer.seen = true;
      }
      lockOn(findTarget(event.target));
      wake();
    };

    const onPointerDown = event => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      pointer.pressed = true;
      wake();
    };

    const onPointerUp = () => {
      pointer.pressed = false;
      wake();
    };

    const onLeave = () => {
      pointer.inside = false;
      pointer.pressed = false;
      lockOn(null);
      updateCursorRule();
      wake();
    };

    const onScroll = () => {
      if (!pointer.inside) return;
      if (target && target.isConnected) {
        cachedRect = target.getBoundingClientRect();
        wake();
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('scroll', onScroll, { capture: true });
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      style.remove();
    };
  }, [host]);

  if (!host) return null;

  return createPortal(
    <div ref={rootRef} className="target-cursor" style={{ opacity: 0 }} aria-hidden="true">
      {CORNER_ANGLES.map((angle, i) => (
        <span
          key={angle}
          ref={element => {
            cornerRefs.current[i] = element;
          }}
          className="target-cursor__corner"
          style={{
            width: `${size > 0 ? cornerSize : 8}px`,
            height: `${size > 0 ? cornerSize : 8}px`,
            borderWidth: `${thickness}px 0 0 ${thickness}px`
          }}
        />
      ))}
      <span
        ref={dotRef}
        className="target-cursor__dot"
        style={{ width: `${dotSize}px`, height: `${dotSize}px` }}
      />
    </div>,
    host
  );
};

export default TargetCursor;
