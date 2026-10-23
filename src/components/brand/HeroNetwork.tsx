import { useEffect, useRef } from "react";

type Dot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
};

const COLOR = "0, 64, 231";
const LINK_DISTANCE = 140;
const MOUSE_RADIUS = 200;

/**
 * Cursor-reactive constellation from the public eGovPH homepage hero.
 * Same counts, color, and forces. Transparent, so it sits on our own banner.
 */
export function HeroNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const dots: Dot[] = [];
    const mouse = { x: -1000, y: -1000 };
    const size = { w: 0, h: 0 };
    let frame = 0;
    let running = true;

    const seed = (width: number, height: number) => {
      const count = Math.min(
        80,
        Math.max(28, Math.round((width * height) / 22000)),
      );
      dots.length = 0;
      for (let i = 0; i < count; i++) {
        dots.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius: Math.random() * 1.8 + 0.8,
          opacity: Math.random() * 0.3 + 0.15,
        });
      }
    };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, rect.width) * dpr;
      canvas.height = Math.max(1, rect.height) * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      const first = size.w === 0;
      size.w = rect.width;
      size.h = rect.height;
      if (first || dots.length === 0) seed(rect.width, rect.height);
    };

    const draw = () => {
      if (!running) return;
      const ctx = canvas.getContext("2d");
      if (!ctx || size.w === 0 || size.h === 0) {
        frame = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, size.w, size.h);
      const { w, h } = size;

      if (!reduceMotion) {
        for (const dot of dots) {
          dot.x += dot.vx;
          dot.y += dot.vy;
          if (dot.x < 0) dot.x = w;
          if (dot.x > w) dot.x = 0;
          if (dot.y < 0) dot.y = h;
          if (dot.y > h) dot.y = 0;

          const dx = mouse.x - dot.x;
          const dy = mouse.y - dot.y;
          const dist = Math.hypot(dx, dy);
          if (dist < MOUSE_RADIUS) {
            const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
            dot.x -= dx * force * 0.02;
            dot.y -= dy * force * 0.02;
            dot.opacity = Math.min(0.7, dot.opacity + force * 0.2);
          } else {
            dot.opacity += (Math.random() * 0.3 + 0.15 - dot.opacity) * 0.02;
          }
        }
      }

      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const a = dots[i];
          const b = dots[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist >= LINK_DISTANCE) continue;
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const midDist = Math.hypot(mouse.x - midX, mouse.y - midY);
          const near =
            midDist < MOUSE_RADIUS ? (MOUSE_RADIUS - midDist) / MOUSE_RADIUS : 0;
          const alpha = (1 - dist / LINK_DISTANCE) * 0.1 + near * 0.2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${COLOR}, ${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      for (const dot of dots) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${COLOR}, ${dot.opacity})`;
        ctx.fill();

        const dist = Math.hypot(mouse.x - dot.x, mouse.y - dot.y);
        const glowReach = MOUSE_RADIUS * 0.6;
        if (dist < glowReach) {
          const glow = ((glowReach - dist) / glowReach) * 0.3;
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, dot.radius + 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${COLOR}, ${glow})`;
          ctx.fill();
        }
      }

      if (mouse.x > 0 && mouse.y > 0) {
        const reach = MOUSE_RADIUS * 0.8;
        const startX = Math.floor((mouse.x - reach) / 40) * 40;
        const startY = Math.floor((mouse.y - reach) / 40) * 40;
        for (let x = startX; x <= mouse.x + reach; x += 40) {
          for (let y = startY; y <= mouse.y + reach; y += 40) {
            const dist = Math.hypot(mouse.x - x, mouse.y - y);
            if (dist >= reach) continue;
            const alpha = ((reach - dist) / reach) * 0.15;
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${COLOR}, ${alpha})`;
            ctx.fill();
          }
        }
      }

      frame = requestAnimationFrame(draw);
    };

    const onMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        mouse.x = x;
        mouse.y = y;
      } else {
        mouse.x = -1000;
        mouse.y = -1000;
      }
    };

    resize();
    frame = requestAnimationFrame(draw);
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    window.addEventListener("mousemove", onMove, { passive: true });

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
        return;
      }
      if (!running) {
        running = true;
        frame = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
    />
  );
}
