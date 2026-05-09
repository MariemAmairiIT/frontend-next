"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Calendar, CalendarRange, BookOpen, Upload, User, LogOut, GraduationCap } from 'lucide-react';
import { loadExtractionState } from '@/lib/planningStorage';
import { clearAuthSession, getCurrentUser } from '@/lib/studentAuth';

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [isExtractionRunning, setIsExtractionRunning] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const refresh = () => {
      const extraction = loadExtractionState();
      setIsExtractionRunning(extraction?.status === 'running');
    };

    const onStorage = (e) => {
      if (!e || typeof e.key !== 'string') return;
      if (e.key !== 'studyplanner:planning-extraction') return;
      refresh();
    };

    refresh();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  useEffect(() => {
    const refreshUser = () => {
      setCurrentUser(getCurrentUser());
    };

    refreshUser();
    window.addEventListener('focus', refreshUser);
    document.addEventListener('visibilitychange', refreshUser);
    return () => {
      window.removeEventListener('focus', refreshUser);
      document.removeEventListener('visibilitychange', refreshUser);
    };
  }, []);

  const displayName =
    (typeof currentUser?.name === 'string' && currentUser.name.trim()) ||
    (typeof currentUser?.fullName === 'string' && currentUser.fullName.trim()) ||
    'Etudiant';

  const displaySubtitle =
    (typeof currentUser?.email === 'string' && currentUser.email.trim()) ||
    (typeof currentUser?.filiere === 'string' && currentUser.filiere.trim()) ||
    'Session active';

  const handleLogout = () => {
    clearAuthSession();
    router.replace('/signin?message=deconnexion');
  };

  const navItems = [
    { name: 'Tableau de bord', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Emploi du temps', path: '/schedule', icon: Calendar },
    { name: 'Emploi des examens', path: '/exam-schedule', icon: CalendarRange },
    { name: 'Gestion des examens', path: '/exams', icon: GraduationCap },
    { name: 'Plan d\'etude', path: '/study-plan', icon: BookOpen },
    { name: 'Importer l\'emploi du temps', path: '/upload', icon: Upload },
  ];

  return (
    <aside className="w-64 bg-primary-800 text-white min-h-screen flex flex-col fixed left-0 top-0 shadow-xl">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-white p-2 rounded-lg">
          <BookOpen className="text-primary-800 w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-wider">Study Planner</h1>
      </div>
      <nav className="flex-1 px-4 mt-6">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            const isBlocked = isExtractionRunning && item.path !== '/upload' && item.path !== pathname;
            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  onClick={(e) => {
                    if (!isBlocked) return;
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                    isActive 
                      ? 'bg-primary-700/50 text-white shadow-inner font-medium border-l-4 border-secondary-400' 
                      : isBlocked
                        ? 'text-primary-200/60 cursor-not-allowed opacity-70'
                        : 'text-primary-200 hover:bg-primary-700/30 hover:text-white'
                  }`}
                  aria-disabled={isBlocked}
                  title={isBlocked ? 'Extraction en cours — restez sur la page Upload.' : undefined}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-secondary-400' : ''}`} />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* Mini Profile */}
      <div className="p-4 m-4 bg-primary-900/50 rounded-xl border border-primary-700/50 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary-800 flex items-center justify-center border-2 border-primary-500">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{displayName}</p>
              <p className="text-xs text-primary-300 truncate">{displaySubtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full px-3 py-2 rounded-lg bg-primary-700/70 text-white text-sm font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Se deconnecter
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
