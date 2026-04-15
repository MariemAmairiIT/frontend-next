'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { Calendar, Clock, BookOpen, AlertCircle } from 'lucide-react';
import { getCurrentUser } from '@/lib/studentAuth';

const Dashboard = () => {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    setCurrentUser(getCurrentUser());
  }, []);

  const userDisplayName = useMemo(() => {
    const fromName = String(currentUser?.name || currentUser?.fullName || '').trim();
    if (fromName) return fromName;

    const email = String(currentUser?.email || '').trim();
    if (email.includes('@')) return email.split('@')[0];

    return 'étudiant';
  }, [currentUser]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Bon retour, {userDisplayName} !</h2>
          <p className="text-slate-500 mt-1">Voici ce qui se passe pour vos études aujourd’hui.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stats Cards */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary-50 rounded-full group-hover:scale-110 transition-transform"></div>
          <div className="relative">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4 text-primary-700">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-3xl font-bold text-slate-900 mb-1">4</h3>
            <p className="text-slate-500 font-medium">Cours aujourd’hui</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-secondary-50 rounded-full group-hover:scale-110 transition-transform"></div>
          <div className="relative">
            <div className="w-12 h-12 bg-secondary-100 rounded-xl flex items-center justify-center mb-4 text-secondary-700">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-3xl font-bold text-slate-900 mb-1">2h 30m</h3>
            <p className="text-slate-500 font-medium">Étude planifiée</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary-800 to-primary-900 rounded-2xl p-6 shadow-md text-white relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10">
            <AlertCircle className="w-32 h-32 -mr-8 -mb-8" />
          </div>
          <div className="relative">
            <h3 className="text-lg font-bold mb-2">Examen à venir</h3>
            <p className="text-primary-200 text-sm mb-4">Partiel d’architecture logicielle</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold">Dans 3 jours</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule Mini-view */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-800">Programme d’aujourd’hui</h3>
            <button className="text-secondary-600 text-sm font-medium hover:underline">Tout voir</button>
          </div>
          <div className="space-y-4">
            {[
              { title: 'Développement web', time: '09:00 - 10:30', type: 'Cours', color: 'bg-blue-100 text-blue-700' },
              { title: 'Structures de données', time: '11:00 - 12:30', type: 'Cours', color: 'bg-purple-100 text-purple-700' },
              { title: 'Réviser les hooks React', time: '14:00 - 15:00', type: 'Étude', color: 'bg-primary-100 text-primary-700' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-4 p-4 rounded-xl border border-slate-50 hover:bg-slate-50 transition-colors">
                <div className={`mt-0.5 px-2.5 py-1 rounded text-xs font-bold ${item.color}`}>
                  {item.type}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">{item.title}</h4>
                  <div className="flex items-center text-slate-500 text-sm mt-1">
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    {item.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-800">Recommandations IA</h3>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="shrink-0 w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                ✨
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Optimisez votre matinée</h4>
                <p className="text-sm text-slate-600">Vous avez un créneau libre demain entre 9 h et 11 h. Ajouter une session de révision de maths serait très efficace avant votre cours de l’après‑midi.</p>
                <button className="mt-3 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors text-slate-700">Ajouter au plan</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

