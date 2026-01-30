import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  Plus, FileText, RefreshCw, Moon, Sun, ChevronDown, Settings,
  LogOut, Loader2, Activity, LayoutDashboard, CalendarDays, Trash2
} from 'lucide-react';

const Header = ({
  onAddClick,
  onRefresh,
  loading,
  darkMode,
  toggleDarkMode,
  user,
  onOpenProfile,
  isProcessing,
  currentView,
  setView,
  onClearDatabase,
  userRole
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0];
  const initials = displayName.charAt(0).toUpperCase();
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between sticky top-0 z-20 transition-colors duration-200">
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white hidden md:block">Painel JVB</h1>
        </div>
        <nav className="flex space-x-1 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg">
          <button
            onClick={() => setView('dashboard')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center ${currentView === 'dashboard' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
          >
            <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
          </button>
          <button
            onClick={() => setView('agenda')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center ${currentView === 'agenda' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
          >
            <CalendarDays className="w-4 h-4 mr-2" /> Agenda
          </button>
          {userRole === 'admin' && (
            <button
              onClick={() => setView('admin')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center ${currentView === 'admin' ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-purple-600'}`}
            >
              <Activity className="w-4 h-4 mr-2" /> Admin
            </button>
          )}
        </nav>
        {isProcessing && (
          <div className="hidden lg:flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-800 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-bold uppercase tracking-wide">IA Trabalhando...</span>
          </div>
        )}
      </div>
      <div className="flex items-center space-x-3">
        {userRole === 'admin' && (
          <button
            onClick={onClearDatabase}
            className="p-2 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Apagar TODOS os processos"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={onRefresh}
          disabled={loading}
          className={`p-2 rounded-full transition-colors ${loading ? 'text-blue-400 cursor-not-allowed' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          title="Atualizar Lista"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={toggleDarkMode}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 transition-colors"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button
          onClick={onAddClick}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 font-medium shadow-sm transition-colors mr-2"
        >
          <Plus className="w-5 h-5" />
          <span>Importar</span>
        </button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-900 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 transition-colors"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-white dark:border-gray-700" />
            ) : (
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs">
                {initials}
              </div>
            )}
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 animate-fade-in-up z-30">
              <button
                onClick={() => { setMenuOpen(false); onOpenProfile(); }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
              >
                <Settings className="w-4 h-4 mr-2" /> Meu Perfil
              </button>
              <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
              >
                <LogOut className="w-4 h-4 mr-2" /> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
