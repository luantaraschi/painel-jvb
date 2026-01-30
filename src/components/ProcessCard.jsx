import React from 'react';
import { AlertCircle, CheckCircle2, Activity, Copy, Loader2, PenTool, Trash2 } from 'lucide-react';
import { getRiskColor } from '../utils/riskUtils';

const ProcessCard = ({ process, onClick, hasDraft, isDraftLoading, onDelete, userRole }) => {
  const statusParaExibir = process.status_manual || process.status || 'pendente';
  const statusColors = {
    pendente: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', icon: AlertCircle, label: 'Pendente' },
    analisado: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', icon: CheckCircle2, label: 'Analisado' },
    frustrada: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', icon: AlertCircle, label: 'Frustrada' }
  };
  const { bg, text, icon: Icon, label } = statusColors[statusParaExibir.toLowerCase()] || statusColors.pendente;
  const dataFormatada = process.data_andamento ? new Date(process.data_andamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
  const updatesBadgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 text-xs px-2 py-0.5 rounded-full font-medium";
  const isPendingApproval = process.status_aprovacao === 'pending';

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 border ${isPendingApproval ? 'border-amber-300 ring-1 ring-amber-300' : 'border-gray-200 dark:border-gray-700'} rounded-xl p-4 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500 transition-all cursor-pointer relative group`}
    >
      {isPendingApproval && (
        <div className="absolute top-0 right-0 bg-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-lg">
          EM ANÁLISE
        </div>
      )}
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2">
          <div className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </div>
          {process.risco && (
            <div className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRiskColor(process.risco)}`}>
              <Activity className="w-3 h-3 mr-1" /> {process.risco}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">{dataFormatada}</span>
          {userRole === 'admin' && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete?.(process); }}
              className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Excluir este processo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg mb-3 group-hover:bg-gray-100 dark:group-hover:bg-gray-700 transition-colors">
        <span className="text-sm font-mono font-medium text-gray-700 dark:text-gray-200 truncate" title={process.numero_cnj}>
          {process.numero_cnj}
        </span>
        <button className="p-1 text-gray-400 hover:text-blue-500">
          <Copy className="w-4 h-4" />
        </button>
      </div>
      <div className="mb-3">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase mb-1">Cliente / Partes</p>
        <p className="text-sm text-gray-800 dark:text-gray-200 font-medium truncate">{process.cliente_nome}</p>
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-2">
        <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400 text-sm">
          <span className="font-semibold">{process.tribunal}</span> - {process.estado_uf}
        </div>
        <div className="flex items-center gap-2">
          {isDraftLoading && (
            <span title="IA Escrevendo Minuta..." className="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 text-xs p-1 rounded-full animate-spin">
              <Loader2 className="w-3 h-3" />
            </span>
          )}
          {hasDraft && !isDraftLoading && (
            <span title="Minuta pronta!" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 text-xs p-1 rounded-full animate-pulse">
              <PenTool className="w-3 h-3" />
            </span>
          )}
          {process.total_updates > 1 && <span className={updatesBadgeClass}>+{process.total_updates - 1}</span>}
        </div>
      </div>
    </div>
  );
};

export default ProcessCard;
