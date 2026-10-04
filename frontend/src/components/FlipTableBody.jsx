import React, { useLayoutEffect, useRef } from 'react';

/**
 * FlipTableBody — Zero-dependency FLIP (First, Last, Invert, Play) animated <tbody>.
 * Smoothly animates table rows when they reorder, climb or fall in rank.
 *
 * Duration: 750ms (~0.5s slower than snappy CSS) with cubic-bezier(0.16, 1, 0.3, 1)
 * allowing users to clearly observe rank shifts and overtakes.
 */
export function FlipTableBody({
  children,
  duration = 750,
  easing = 'cubic-bezier(0.16, 1, 0.3, 1)',
  enabled = true,
  resetKey = '',
  className = '',
  style,
  ...props
}) {
  const tbodyRef = useRef(null);
  const prevPositionsRef = useRef(new Map());
  const prevResetKeyRef = useRef(resetKey);

  useLayoutEffect(() => {
    // If major view/tab/scope reset key changed, clear recorded positions
    if (prevResetKeyRef.current !== resetKey) {
      prevResetKeyRef.current = resetKey;
      prevPositionsRef.current.clear();
    }

    if (!enabled || !tbodyRef.current) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.dataset.workrankReduceMotion === 'true');

    if (prefersReducedMotion) {
      prevPositionsRef.current.clear();
      return;
    }

    const tbody = tbodyRef.current;
    const rows = Array.from(tbody.querySelectorAll(':scope > tr[data-flip-id]'));
    const newPositions = new Map();

    // 1. FIRST: positions recorded from before render
    const prevPositions = prevPositionsRef.current;

    // 2. LAST: measure new positions
    rows.forEach((row) => {
      const id = row.getAttribute('data-flip-id');
      if (id) {
        newPositions.set(id, row.getBoundingClientRect());
      }
    });

    // 3. INVERT & PLAY:
    if (prevPositions.size > 0) {
      rows.forEach((row) => {
        const id = row.getAttribute('data-flip-id');
        if (!id) return;

        const prevRect = prevPositions.get(id);
        const newRect = newPositions.get(id);

        if (prevRect && newRect) {
          const deltaY = prevRect.top - newRect.top;
          const deltaX = prevRect.left - newRect.left;

          // Only animate if position actually shifted
          if (Math.abs(deltaY) > 1 || Math.abs(deltaX) > 1) {
            // INVERT: snap back to old position instantaneously
            row.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
            row.style.transition = 'transform 0s';
            row.style.zIndex = deltaY > 0 ? '12' : '6';

            if (deltaY > 0) {
              row.classList.add('ranking-overtake-up');
            } else if (deltaY < 0) {
              row.classList.add('ranking-overtake-down');
            }

            // PLAY: animate to final position in next animation frame
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                row.style.transition = `transform ${duration}ms ${easing}`;
                row.style.transform = 'translate3d(0, 0, 0)';

                const cleanup = () => {
                  row.style.transform = '';
                  row.style.transition = '';
                  row.style.zIndex = '';
                  row.classList.remove('ranking-overtake-up');
                  row.classList.remove('ranking-overtake-down');
                  row.removeEventListener('transitionend', cleanup);
                };

                row.addEventListener('transitionend', cleanup, { once: true });
                setTimeout(cleanup, duration + 60);
              });
            });
          }
        }
      });
    }

    // Save for next render
    prevPositionsRef.current = newPositions;
  });

  return (
    <tbody ref={tbodyRef} className={className} style={style} {...props}>
      {children}
    </tbody>
  );
}

/**
 * FlipList — Zero-dependency FLIP animated <div> list container.
 * Useful for card lists, grid rows, and mobile rankings.
 */
export function FlipList({
  children,
  duration = 750,
  easing = 'cubic-bezier(0.16, 1, 0.3, 1)',
  enabled = true,
  resetKey = '',
  className = '',
  style,
  ...props
}) {
  const containerRef = useRef(null);
  const prevPositionsRef = useRef(new Map());
  const prevResetKeyRef = useRef(resetKey);

  useLayoutEffect(() => {
    if (prevResetKeyRef.current !== resetKey) {
      prevResetKeyRef.current = resetKey;
      prevPositionsRef.current.clear();
    }

    if (!enabled || !containerRef.current) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.dataset.workrankReduceMotion === 'true');

    if (prefersReducedMotion) {
      prevPositionsRef.current.clear();
      return;
    }

    const container = containerRef.current;
    const items = Array.from(container.querySelectorAll(':scope > [data-flip-id]'));
    const newPositions = new Map();
    const prevPositions = prevPositionsRef.current;

    items.forEach((item) => {
      const id = item.getAttribute('data-flip-id');
      if (id) {
        newPositions.set(id, item.getBoundingClientRect());
      }
    });

    if (prevPositions.size > 0) {
      items.forEach((item) => {
        const id = item.getAttribute('data-flip-id');
        if (!id) return;

        const prevRect = prevPositions.get(id);
        const newRect = newPositions.get(id);

        if (prevRect && newRect) {
          const deltaY = prevRect.top - newRect.top;
          const deltaX = prevRect.left - newRect.left;

          if (Math.abs(deltaY) > 1 || Math.abs(deltaX) > 1) {
            item.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
            item.style.transition = 'transform 0s';
            item.style.zIndex = deltaY > 0 ? '12' : '6';

            if (deltaY > 0) {
              item.classList.add('ranking-overtake-up');
            } else if (deltaY < 0) {
              item.classList.add('ranking-overtake-down');
            }

            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                item.style.transition = `transform ${duration}ms ${easing}`;
                item.style.transform = 'translate3d(0, 0, 0)';

                const cleanup = () => {
                  item.style.transform = '';
                  item.style.transition = '';
                  item.style.zIndex = '';
                  item.classList.remove('ranking-overtake-up');
                  item.classList.remove('ranking-overtake-down');
                  item.removeEventListener('transitionend', cleanup);
                };

                item.addEventListener('transitionend', cleanup, { once: true });
                setTimeout(cleanup, duration + 60);
              });
            });
          }
        }
      });
    }

    prevPositionsRef.current = newPositions;
  });

  return (
    <div ref={containerRef} className={className} style={style} {...props}>
      {children}
    </div>
  );
}

export default FlipTableBody;
