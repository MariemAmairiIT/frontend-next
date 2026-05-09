"use client";
import { useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  const toggle = () => {
    setDark(!dark);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <button
      onClick={toggle}
      className="fixed top-4 right-4 z-50 px-4 py-2 rounded-full
      bg-white/10 dark:bg-black/20 backdrop-blur-md
      border border-white/10 text-sm shadow-glow"
    >
      {dark ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}