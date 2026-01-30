import React from 'react';
import { FileText, AlertCircle, CheckCircle2, Activity } from 'lucide-react';

const StatsBar = ({ processes }) => {
  const total = processes.length;
  const pendentes = processes.filter(p => !p.status_manual || p.status_manual === 'pendente').length;
  const analisados = processes.filter(p => p.status_manual === 'analisado').length;
  const progress = total > 0 ? Math.round((analisados / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8 animate-fade-in-up">
      <div className="bg-white/90 dark:bg-gray-800/90 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between backdrop-blur">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Importado</p>
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{total}</h3>
        </div>
        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-gray-600 dark:text-gray-300">
          <FileText className="w-6 h-6" />
        </div>
      </div>
      <div className="bg-white/90 dark:bg-gray-800/90 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between backdrop-blur">
        <div>
          <p className="text-xs font-bold text-yellow-600 dark:text-yellow-500 uppercase tracking-wider">Pendentes</p>
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{pendentes}</h3>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-xl text-yellow-600 dark:text-yellow-400">
          <AlertCircle className="w-6 h-6" />
        </div>
      </div>
      <div className="bg-white/90 dark:bg-gray-800/90 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between backdrop-blur">
        <div>
          <p className="text-xs font-bold text-green-600 dark:text-green-500 uppercase tracking-wider">Concluídos</p>
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{analisados}</h3>
        </div>
        <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-xl text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-6 h-6" />
        </div>
      </div>
      <div className="bg-white/90 dark:bg-gray-800/90 p-5 rounded-2xl border border-blue-200 dark:border-blue-900 shadow-sm relative overflow-hidden backdrop-blur">
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Progresso do Lote</p>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{progress}%</h3>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-xl text-blue-600 dark:text-blue-400">
            <Activity className="w-6 h-6" />
          </div>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-2">
          <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
        </div>
      </div>
    </div>
  );
};

export default StatsBar;
