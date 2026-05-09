import React from 'react';
import AppShell from '@/components/AppShell';
import './globals.css'; // Global Tailwind styles

export const metadata = {
  title: "iTeam Study Planner",
  description: "Planificateur étudiant propulsé par l’IA",
  icons: {
    icon: "/images/planner-logo.png",
   
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
