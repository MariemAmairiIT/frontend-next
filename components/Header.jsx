"use client";

import React from 'react';
import { Search, Bell } from 'lucide-react';

const Header = () => {
  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="relative w-96 group">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-secondary-600 transition-colors" />
        <input 
          type="text" 
          placeholder="Rechercher des supports, des tâches…" 
          className="w-full bg-slate-100 rounded-full py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-secondary-300 transition-all border border-transparent focus:bg-white"
        />
      </div>
      <div className="flex items-center gap-6">
        <button className="relative p-2 rounded-full hover:bg-slate-100 transition-colors">
          <Bell className="w-6 h-6 text-slate-600" />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary-500 rounded-full border-2 border-white"></span>
        </button>
      </div>
    </header>
  );
};

export default Header;
