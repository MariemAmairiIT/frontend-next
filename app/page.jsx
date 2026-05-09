'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookOpen, Brain, CalendarCheck, Sparkles, GraduationCap, ChevronRight } from 'lucide-react';

const FEATURES = [
  { icon: Brain, label: 'Planification IA', desc: 'Votre emploi du temps optimisé automatiquement.' },
  { icon: CalendarCheck, label: 'Suivi des révisions', desc: 'Ne ratez plus aucun examen important.' },
  { icon: GraduationCap, label: 'Objectifs clairs', desc: 'Visualisez votre progression en temps réel.' },
];

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  size: Math.random() * 6 + 3,
  x: Math.random() * 100,
  delay: Math.random() * 4,
  duration: Math.random() * 8 + 10,
}));

function FloatingParticle({ size, x, delay, duration }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        bottom: '-10px',
        background: x % 3 === 0
          ? 'rgba(194,69,82,0.35)'
          : x % 3 === 1
          ? 'rgba(41,128,198,0.35)'
          : 'rgba(255,255,255,0.25)',
        filter: 'blur(1px)',
      }}
      animate={{
        y: [0, -window.innerHeight - 40],
        opacity: [0, 0.7, 0.7, 0],
        scale: [1, 1.2, 0.9, 1],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8, ease: 'easeOut' } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      className="relative h-screen flex flex-col overflow-hidden"
      style={{
        backgroundImage: 'url(/images/background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Layered overlay: deep burgundy → navy vignette */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#3f040a]/80 via-[#800020]/60 to-[#000080]/75 z-0" />
      {/* Radial highlight at top-center */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(194,69,82,0.22)_0%,transparent_70%)] z-0" />
      {/* Subtle noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.04] z-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJuIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC45IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbHRlcj0idXJsKCNuKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]" />

      {/* Floating particles */}
      {mounted && PARTICLES.map((p) => (
        <FloatingParticle key={p.id} {...p} />
      ))}

      {/* Glowing orb top-left */}
      <motion.div
        className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full z-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(194,69,82,0.18) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Glowing orb bottom-right */}
      <motion.div
        className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full z-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(41,128,198,0.18) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Nav bar */}
      <motion.nav
        className="relative z-10 flex items-center justify-between px-8 py-5"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="bg-white/10 backdrop-blur-sm p-2 rounded-xl border border-white/20">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-wide">Study Planner</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/signin"
            className="px-5 py-2 text-sm font-semibold text-white/90 hover:text-white rounded-xl border border-white/20 hover:border-white/40 hover:bg-white/10 transition-all duration-200 backdrop-blur-sm"
          >
            Connexion
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2 text-sm font-semibold bg-white text-[#800020] rounded-xl hover:bg-primary-50 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            S&apos;inscrire
          </Link>
        </div>
      </motion.nav>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 py-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-3xl mx-auto flex flex-col items-center gap-6"
        >
          {/* Badge */}
          <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white/80 text-sm font-medium">
                <Icon className="w-4 h-4 text-pink-300" />
                {label}
              </div>
            ))}
          </motion.div>

          {/* Headline */}
          <motion.div variants={fadeUp} className="space-y-2">
            <h1 className="text-6xl md:text-7xl font-extrabold text-white leading-tight tracking-tight drop-shadow-xl">
              Étudiez{' '}
              <span
                className="relative inline-block"
                style={{
                  background: 'linear-gradient(135deg, #f3cbd0 0%, #e8a6ad 40%, #4f9bdb 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                plus malin
              </span>
            </h1>
            <h1 className="text-6xl md:text-7xl font-extrabold text-white leading-tight tracking-tight drop-shadow-xl">
              pas plus dur.
            </h1>
          </motion.div>

          {/* Sub-headline */}
          <motion.p
            variants={fadeUp}
            className="text-lg md:text-xl text-white/70 max-w-xl leading-relaxed"
          >
            iTeam Study Planner analyse votre emploi du temps, optimise vos révisions et vous aide à atteindre vos objectifs académiques — automatiquement.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4 mt-2">
            <Link href="/signup">
              <motion.div
                className="relative group flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white shadow-2xl overflow-hidden cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #800020 0%, #c24552 100%)' }}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <motion.div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(135deg, #c24552 0%, #800020 100%)' }}
                />
                <span className="relative z-10">Commencer gratuitement</span>
                <ChevronRight className="relative z-10 w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: '-100%' }}
                  animate={{ x: '200%' }}
                  transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2, ease: 'linear' }}
                />
              </motion.div>
            </Link>

            <Link href="/signin">
              <motion.div
                className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white border-2 border-white/30 hover:border-white/60 hover:bg-white/10 backdrop-blur-sm cursor-pointer transition-colors duration-200"
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                Se connecter
              </motion.div>
            </Link>
          </motion.div>

          {/* Trust badge */}
        
        </motion.div>


      </main>

      {/* Bottom decorative line */}
      <motion.div
        className="relative z-10 mx-auto mb-6 h-px w-48 rounded-full"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)' }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
      />
    </div>
  );
}
