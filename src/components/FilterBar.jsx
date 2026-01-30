import React from 'react';
import { Search, Filter, Activity, MapPin, Calendar, UploadCloud, ChevronDown, FileSpreadsheet, FileIcon } from 'lucide-react';
import { formatDateDisplay } from '../utils/dateUtils';

const FilterBar = ({
  filters,
  setFilters,
  uniqueUFs,
  uniqueDates,
  uniqueRisks,
  uniqueUploadDates,
  onExportExcel,
  onExportPDF,
  viewMode,
  setViewMode,
  userRole
}) => {
  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 flex flex-col gap-4 transition-colors sticky top-[76px] z-20">
      <div className="flex flex-col xl:flex-row gap-3 items-center">
        {/* Busca (20%) */}
        <div className="relative w-full xl:w-[20%]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            id="filter-search"
            name="search"
            type="text"
            placeholder="Buscar Cliente/CNJ..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 transition-all truncate"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>

        {/* Status (15%) */}
        <div className="relative w-full xl:w-[15%]">
          <Filter className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <select
            className="w-full pl-10 pr-8 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 cursor-pointer truncate"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Todos Status</option>
            {userRole === 'admin' && <option value="aguardando_aprovacao">🛡️ Aguardando Aprovação</option>}
            <option value="pendente">🟡 Pendentes</option>
            <option value="analisado">🟢 Analisados</option>
            <option value="frustrada">🔴 Frustrados</option>
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
        </div>

        {/* Risco (15%) */}
        <div className="relative w-full xl:w-[15%]">
          <Activity className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <select
            className="w-full pl-10 pr-8 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 cursor-pointer truncate"
            value={filters.risk}
            onChange={(e) => setFilters({ ...filters, risk: e.target.value })}
          >
            <option value="">Todos Riscos</option>
            {uniqueRisks.map(risk => <option key={risk} value={risk}>{risk}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
        </div>

        {/* UF (10%) */}
        <div className="relative w-full xl:w-[10%]">
          <MapPin className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <select
            className="w-full pl-10 pr-8 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 cursor-pointer truncate"
            value={filters.uf}
            onChange={(e) => setFilters({ ...filters, uf: e.target.value })}
          >
            <option value="">Todos UF</option>
            {uniqueUFs.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
        </div>

        {/* Data Andamento (20%) */}
        <div className="relative w-full xl:w-[20%]">
          <Calendar className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <select
            className="w-full pl-10 pr-8 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 cursor-pointer truncate"
            value={filters.date}
            onChange={(e) => setFilters({ ...filters, date: e.target.value })}
          >
            <option value="">Data Andamento</option>
            {uniqueDates.map(date => (<option key={date} value={date}>{formatDateDisplay(date)}</option>))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
        </div>

        {/* Data Upload (20%) */}
        <div className="relative w-full xl:w-[20%]">
          <UploadCloud className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <select
            className="w-full pl-10 pr-8 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 cursor-pointer truncate"
            value={filters.uploadDate}
            onChange={(e) => setFilters({ ...filters, uploadDate: e.target.value })}
          >
            <option value="">Data Upload</option>
            {uniqueUploadDates.map(date => (<option key={date} value={date}>{formatDateDisplay(date)}</option>))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Visualização</span>
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setViewMode('tiles')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === 'tiles' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              Grade
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              Tabela
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              Lista
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onExportExcel}
            className="flex items-center px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-md transition-colors dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/40"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Exportar Excel
          </button>
          <button
            onClick={onExportPDF}
            className="flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/40"
          >
            <FileIcon className="w-3.5 h-3.5 mr-1.5" /> Exportar PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
