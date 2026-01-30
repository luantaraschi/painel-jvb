import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { CalendarDays, CheckCircle2, ChevronDown } from 'lucide-react';
import { normalizeDate, parsePrazoIaDate, getDaysToDue, formatDateDisplay } from '../utils/dateUtils';

const AgendaView = ({ processes, onProcessClick, onUpdateData }) => {
  const [editingId, setEditingId] = useState(null);
  const [editingDate, setEditingDate] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [agendaViewMode, setAgendaViewMode] = useState('grid');

  const getEffectiveDate = (process) => {
    if (process.data_prazo_final) return { date: normalizeDate(process.data_prazo_final), inferred: false };
    const inferred = parsePrazoIaDate(process.prazo_ia);
    return inferred ? { date: inferred, inferred: true } : { date: '', inferred: false };
  };

  const processosComPrazo = processes.filter(p => p.prazo_ia || p.data_prazo_final);
  processosComPrazo.sort((a, b) => {
    const aDate = getEffectiveDate(a).date;
    const bDate = getEffectiveDate(b).date;
    if (aDate && bDate) return new Date(aDate) - new Date(bDate);
    if (aDate) return -1;
    if (bDate) return 1;
    return 0;
  });

  const handleEditDate = (process) => {
    setEditingId(process.id);
    setEditingDate(normalizeDate(process.data_prazo_final) || '');
  };

  const handleSaveDate = async (process) => {
    if (!editingDate) return toast.warning('Defina uma data válida.');
    setSavingId(process.id);
    try {
      const { error } = await supabase.from('processos').update({ data_prazo_final: editingDate }).eq('id', process.id);
      if (error) throw error;
      onUpdateData?.(process.id, { data_prazo_final: editingDate });
      toast.success('Prazo atualizado!');
      setEditingId(null);
      setEditingDate('');
    } catch (error) {
      toast.error('Erro ao salvar prazo: ' + error.message);
    } finally {
      setSavingId(null);
    }
  };

  const classify = (process) => {
    const dateValue = getEffectiveDate(process).date;
    if (!dateValue) return { group: 'sem-data', days: null };
    const days = getDaysToDue(dateValue);
    if (days < 0) return { group: 'vencidos', days };
    if (days === 0) return { group: 'hoje', days };
    if (days <= 7) return { group: 'proximos', days };
    return { group: 'futuros', days };
  };

  const grouped = processosComPrazo.reduce((acc, process) => {
    const { group, days } = classify(process);
    if (!acc[group]) acc[group] = [];
    acc[group].push({ process, days });
    return acc;
  }, {});

  const renderCard = ({ process, days }) => {
    const { date: dateValue, inferred } = getEffectiveDate(process);
    const isEditing = editingId === process.id;
    const statusText = days === null
      ? 'Sem data definida'
      : days < 0
        ? `Vencido há ${Math.abs(days)} dia${Math.abs(days) !== 1 ? 's' : ''}`
        : days === 0
          ? 'Vence hoje'
          : `Faltam ${days} dia${days !== 1 ? 's' : ''}`;
    const statusClass = days === null
      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      : days < 0
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
        : days <= 7
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';

    return (
      <div key={process.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-mono px-2 py-0.5 rounded">{process.numero_cnj}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${statusClass}`}>{statusText}</span>
              {inferred && <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Data inferida</span>}
            </div>
            <h3 className="font-semibold text-gray-800 dark:text-white truncate">{process.cliente_nome || 'Sem cliente'}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{process.prazo_ia ? `IA Detectou: "${process.prazo_ia}"` : 'Prazo manual definido.'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {isEditing ? (
                <>
                  <input type="date" value={editingDate} onChange={(e) => setEditingDate(e.target.value)} className="text-xs p-1.5 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  <button onClick={() => handleSaveDate(process)} disabled={savingId === process.id} className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                    {savingId === process.id ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button onClick={() => { setEditingId(null); setEditingDate(''); }} className="text-xs px-3 py-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">Cancelar</button>
                </>
              ) : (
                <>
                  {dateValue ? (
                    <span className="text-xs text-gray-600 dark:text-gray-400">Vencimento: <strong>{formatDateDisplay(dateValue)}</strong></span>
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-500">Defina a data final do prazo.</span>
                  )}
                  <button onClick={() => handleEditDate(process)} className="text-xs px-3 py-1.5 rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/50">
                    {dateValue ? 'Editar data' : 'Definir data'}
                  </button>
                  <button onClick={() => onProcessClick(process)} className="text-xs px-3 py-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50">Abrir processo</button>
                </>
              )}
            </div>
          </div>
          <button onClick={() => onProcessClick(process)} className="text-gray-300 hover:text-blue-500">
            <ChevronDown className="-rotate-90" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center"><CalendarDays className="w-6 h-6 mr-2 text-blue-600" /> Agenda de Prazos</h2>
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-500">Visualizando {processosComPrazo.length} processos com alerta de prazo.</p>
          <div className="hidden md:inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button onClick={() => setAgendaViewMode('blocks')} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${agendaViewMode === 'blocks' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>Blocos</button>
            <button onClick={() => setAgendaViewMode('grid')} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${agendaViewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>Grade</button>
          </div>
        </div>
      </div>
      {processosComPrazo.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-800 dark:text-white">Tudo limpo!</h3>
          <p className="text-gray-500">Nenhum prazo detectado pela IA ou agendado manualmente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {grouped.vencidos?.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase text-red-600 dark:text-red-400">Vencidos</h3>
                <div className={agendaViewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
                  {grouped.vencidos.map(renderCard)}
                </div>
              </div>
            )}
            {grouped.hoje?.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase text-amber-600 dark:text-amber-400">Vencem hoje</h3>
                <div className={agendaViewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
                  {grouped.hoje.map(renderCard)}
                </div>
              </div>
            )}
            {grouped.proximos?.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase text-amber-600 dark:text-amber-400">Próximos 7 dias</h3>
                <div className={agendaViewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
                  {grouped.proximos.map(renderCard)}
                </div>
              </div>
            )}
            {grouped.futuros?.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase text-green-600 dark:text-green-400">Futuros</h3>
                <div className={agendaViewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
                  {grouped.futuros.map(renderCard)}
                </div>
              </div>
            )}
            {grouped['sem-data']?.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase text-yellow-600 dark:text-yellow-400">Sem data</h3>
                <div className={agendaViewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
                  {grouped['sem-data'].map(renderCard)}
                </div>
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 h-fit space-y-4">
            <h3 className="text-sm font-bold uppercase text-gray-500">Resumo do Mês</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 text-sm">
                <p className="text-xs uppercase">Vencidos</p>
                <p className="text-lg font-bold">{grouped.vencidos?.length || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 text-sm">
                <p className="text-xs uppercase">Hoje</p>
                <p className="text-lg font-bold">{grouped.hoje?.length || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300 text-sm">
                <p className="text-xs uppercase">Próximos 7d</p>
                <p className="text-lg font-bold">{grouped.proximos?.length || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-sm">
                <p className="text-xs uppercase">Sem data</p>
                <p className="text-lg font-bold">{grouped['sem-data']?.length || 0}</p>
              </div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-500">Clique em "Definir data" para transformar o alerta da IA em prazo real.</p>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Próximos vencimentos</p>
              {(grouped.proximos || [])
                .concat(grouped.futuros || [])
                .slice(0, 5)
                .map(({ process }) => (
                  <div key={process.id} className="flex justify-between text-sm py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <span className="text-gray-600 dark:text-gray-400 truncate w-32">{process.cliente_nome}</span>
                    <span className="text-gray-600 font-medium">{formatDateDisplay(process.data_prazo_final)}</span>
                  </div>
                ))}
              {(!grouped.proximos?.length && !grouped.futuros?.length) && <p className="text-xs text-gray-400 italic">Nenhuma data confirmada ainda.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgendaView;
