"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  Upload,
  Folder,
  User,
  LogOut,
} from "lucide-react";
import { loadExtractionState } from "@/lib/planningStorage";
import { clearAuthSession, getCurrentUser } from "@/lib/studentAuth";

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [isExtractionRunning, setIsExtractionRunning] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const refresh = () => {
      const extraction = loadExtractionState();
      setIsExtractionRunning(extraction?.status === "running");
    };

    const onStorage = (e) => {
      if (!e || typeof e.key !== "string") return;
      if (e.key !== "studyplanner:planning-extraction") return;
      refresh();
    };

    refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    const refreshUser = () => {
      setCurrentUser(getCurrentUser());
    };

    refreshUser();
    window.addEventListener("focus", refreshUser);
    document.addEventListener("visibilitychange", refreshUser);
    return () => {
      window.removeEventListener("focus", refreshUser);
      document.removeEventListener("visibilitychange", refreshUser);
    };
  }, []);

  const displayName =
    (typeof currentUser?.name === "string" && currentUser.name.trim()) ||
    (typeof currentUser?.fullName === "string" &&
      currentUser.fullName.trim()) ||
    "Etudiant";

  const displaySubtitle =
    (typeof currentUser?.email === "string" && currentUser.email.trim()) ||
    (typeof currentUser?.filiere === "string" && currentUser.filiere.trim()) ||
    "Session active";

  const handleLogout = () => {
    clearAuthSession();
    router.replace("/signin?message=Déconnexion");
  };

  const navItems = [
    { name: "Tableau de bord", path: "/", icon: LayoutDashboard },
    { name: "Emploi du temps", path: "/schedule", icon: Calendar },
    { name: "Plan d'étude", path: "/study-plan", icon: BookOpen },
    { name: "Importer l'emploi du temps", path: "/upload", icon: Upload },
    { name: "Sujets & QCM", path: "/subjects", icon: Folder },
  ];

  return (
    <aside className="w-72 bg-[#800020] text-white min-h-screen flex flex-col fixed left-0 top-0 shadow-xl">
      <Link
        href="/"
        className="pt-5 flex items-center gap-3 transition-opacity hover:opacity-90"
        aria-label="Retour au tableau de bord"
      >
        <div className="shrink-0">
          <Image
            src="/images/study-planner-logo.png"
            alt="Study Planner"
            width={54}
            height={54}
            className="h-21 w-21 object-contain"
            priority
          />
        </div>
        <h1 className="text-xl font-extrabold">
          <span className="">STUDY</span>{" "}
          <span className="rounded bg-white/90 px-1.5 py-0.5 text-primary-900">
            PLANNER
          </span>
        </h1>
      </Link>
      <nav className="flex-1 px-4 mt-6">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            const isBlocked =
              isExtractionRunning &&
              item.path !== "/upload" &&
              item.path !== pathname;
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
                      ? "bg-primary-700/60 text-white shadow-inner font-medium border-l-4 border-secondary-300"
                      : isBlocked
                        ? "text-primary-100/60 cursor-not-allowed opacity-70"
                        : "text-primary-100 hover:bg-primary-700/40 hover:text-white"
                  }`}
                  aria-disabled={isBlocked}
                  title={
                    isBlocked
                      ? "Extraction en cours — restez sur la page Upload."
                      : undefined
                  }
                >
                  <Icon
                    className={`w-5 h-5 ${isActive ? "text-secondary-400" : ""}`}
                  />
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
          <div className="w-10 h-10 rounded-full bg-primary-700 flex items-center justify-center border-2 border-primary-400">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-white truncate">
              {displayName}
            </p>
            <p className="text-xs text-primary-200 truncate">
              {displaySubtitle}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full px-3 py-2 rounded-lg bg-primary-700/80 text-white text-sm font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
