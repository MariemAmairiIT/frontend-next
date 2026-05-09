"use client";
import { useEffect, useRef } from "react";

export default function MagicalBackground() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const particles = Array.from({ length: 100 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2,
    }));

    function draw() {
      ctx.clearRect(0, 0, w, h);

      for (let p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.beginPath();
        ctx.fillStyle = "rgba(45,212,191,0.35)";
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#14b8a6";
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(draw);
    }

    draw();
  }, []);

  return (
    <canvas
      ref={ref}
      className="fixed inset-0 z-0 pointer-events-none"
    />
  );
}