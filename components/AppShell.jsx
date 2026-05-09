"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { getAuthHeader } from "@/lib/studentAuth";

const AUTH_ROUTES = new Set(["/", "/signin", "/signup"]);

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = AUTH_ROUTES.has(pathname);

  useEffect(() => {
    if (isAuthRoute) return;
    const auth = getAuthHeader();
    if (!auth) {
      router.replace("/signin?message=session-expiree");
    }
  }, [isAuthRoute, router]);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <Header />
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
