import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, logAction } from './supabaseClient';
import { Toaster, toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Header as DocHeader, Footer as DocFooter } from 'docx';
import { saveAs } from 'file-saver';

import {
  Plus, CheckCircle2, UploadCloud, Save, Loader2, X,
  Search, ChevronDown, ChevronUp, LifeBuoy, Ban, MoreHorizontal,
  User as UserIcon, Send, Activity, RefreshCw, ExternalLink, Bot,
  Briefcase, Clock, Settings, FileSpreadsheet, Pencil, Check,
  Scale, FileSignature, AlertTriangle, Trash2, LayoutDashboard, TrendingUp, Copy, CalendarClock
} from 'lucide-react';

// Componentes extraídos
import {
  HelpTip,
  ConfirmModal,
  LoginPage,
  Header,
  AgendaView,
  ProfileModal,
  SosModal,
  UploadModal,
  StatsBar,
  FilterBar,
  ProcessCard
} from './components';

// Utilitários extraídos
import {
  normalizeDate,
  parsePrazoIaDate,
  getEffectiveDate,
  getDaysToDue,
  formatDateDisplay,
  getTaskDueDate,
  isTaskCompleted,
  getRiskColor,
  normalizeText,
  splitTerms,
  toggleTermInList
} from './utils';



// --- CONFIGURAÇÃO DOS LINKS ---

const API_GET_URL = "https://jvbadvocacia-n8n.cloudfy.live/webhook/processos";

const API_UPLOAD_URL = "https://jvbadvocacia-n8n.cloudfy.live/webhook/upload-pdf";

const API_DRAFTER_URL = "https://jvbadvocacia-n8n.cloudfy.live/webhook/minuta";

const API_SOS_URL = "https://jvbadvocacia-n8n.cloudfy.live/webhook/sos";

const API_PIPELINE_REPROCESS_URL = import.meta.env.VITE_PIPELINE_REPROCESS_URL || "https://jvbadvocacia-n8n.cloudfy.live/webhook/pipeline-reprocess";

const API_PIPELINE_REVIEW_URL = import.meta.env.VITE_PIPELINE_REVIEW_URL || "https://jvbadvocacia-n8n.cloudfy.live/webhook/pipeline-review";

const API_CHAT_URL = import.meta.env.VITE_CHAT_URL || "/api/chat-processo";



// ConfirmModal foi movido para ./components/ui/ConfirmModal.jsx

const getProfileDisplayName = (profile) => {
  if (!profile) return 'User';
  return (
    profile.full_name ||
    profile.user_metadata?.full_name ||
    profile.name ||
    profile.nome ||
    profile.email ||
    profile.user_metadata?.email ||
    'User'
  );
};



// ProfileModal foi movido para ./components/ProfileModal.jsx
// SosModal foi movido para ./components/SosModal.jsx

// --- 2.9 ADMIN DASHBOARD ---
const AdminDashboard = ({ onBack, session, onOpenProcess }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalUsers: 0, activeToday: 0, totalActions: 0 });
  const [kpis, setKpis] = useState({
    prazos: { vencidos: 0, hoje: 0, seteDias: 0, semResponsavel: 0 },
    risco: { alto: 0, medio: 0, semClassificacao: 0, semMovimentacao30: 0 },
    pipeline: { processadosHoje: 0, falhasHoje: 0, emRevisao: 0, tempoMedio: 0 }
  });
  const [auditLogs, setAuditLogs] = useState([]);
  const [pipelineRuns, setPipelineRuns] = useState([]);
  const [productivity, setProductivity] = useState({
    openByUser: [],
    overdueByUser: [],
    completedWeek: 0,
    avgCompletionHours: 0,
    highRiskNoTask: []
  });
  const [profiles, setProfiles] = useState([]);
  const [sosTickets, setSosTickets] = useState([]);
  const [settings, setSettings] = useState({
    alert_window_days: 7,
    risk_high_terms: 'alto',
    risk_medium_terms: 'médio,medio',
    template_minuta: ''
  });
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [auditFilters, setAuditFilters] = useState({ user: 'all', action: 'all', resource: 'all', dateFrom: '', dateTo: '', search: '' });
  const [pipelineActionLoading, setPipelineActionLoading] = useState({});
  const [isRiskCollapsed, setIsRiskCollapsed] = useState(true);
  const [isPipelineCollapsed, setIsPipelineCollapsed] = useState(true);
  const [expandedRiskProcesses, setExpandedRiskProcesses] = useState([]);
  
  // States for Ban Modal
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [userToToggle, setUserToToggle] = useState(null);
  const [isTogglingBan, setIsTogglingBan] = useState(false);

  // SOS actions
  const [sosActionLoading, setSosActionLoading] = useState({});
  const [sosDeleteModalOpen, setSosDeleteModalOpen] = useState(false);
  const [sosToDelete, setSosToDelete] = useState(null);
  const [isDeletingSos, setIsDeletingSos] = useState(false);

  // Office settings UX helpers
  const [settingsAdvancedOpen, setSettingsAdvancedOpen] = useState(false);
  const [settingsTestText, setSettingsTestText] = useState('');
  const currentUserId = session?.user?.id;
  const actorDetails = useMemo(() => ({
    actor_name: session?.user?.user_metadata?.full_name || session?.user?.email || 'User',
    actor_email: session?.user?.email || null
  }), [session]);

  const normalizeDate = (value) => (value && value.includes('T') ? value.split('T')[0] : value || '');

  const normalizeText = (value) => {
    try {
      return (value || '')
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    } catch {
      return (value || '').toString().toLowerCase();
    }
  };

  const splitTerms = (value) => {
    return (value || '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
      .map(normalizeText);
  };

  const riskTestResult = useMemo(() => {
    const text = normalizeText(settingsTestText);
    if (!text) return null;
    const high = splitTerms(settings.risk_high_terms);
    const med = splitTerms(settings.risk_medium_terms);
    const isHigh = high.some(term => term && text.includes(term));
    const isMed = !isHigh && med.some(term => term && text.includes(term));
    return isHigh ? 'alto' : isMed ? 'médio' : 'nenhum';
  }, [settingsTestText, settings.risk_high_terms, settings.risk_medium_terms]);

  const toggleTermInList = (currentCsv, term) => {
    const current = (currentCsv || '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    const normalized = current.map(normalizeText);
    const termNorm = normalizeText(term);
    const idx = normalized.indexOf(termNorm);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(term);
    }
    return current.join(', ');
  };

  const parsePrazoIaDate = (prazoText) => {
    if (!prazoText) return '';
    const match = prazoText.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/);
    if (!match) return '';
    const day = match[1];
    const month = match[2];
    const yearRaw = match[3];
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    return `${year}-${month}-${day}`;
  };

  const getEffectiveDate = (process) => {
    if (process?.data_prazo_final) return normalizeDate(process.data_prazo_final);
    return parsePrazoIaDate(process?.prazo_ia);
  };

  const getDaysToDue = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  };

  const getTaskDueDate = (task) => {
    const raw = task?.data_limite || task?.prazo || task?.deadline || '';
    return raw ? normalizeDate(raw) : '';
  };

  const isTaskCompleted = (task) => {
    const status = (task?.status_tarefa || '').toLowerCase();
    return ['analisado', 'concluido', 'concluída', 'concluida', 'finalizado', 'finalizada', 'done'].includes(status);
  };

  const appendAuditLog = useCallback((log) => {
    if (!log) return;
    const profileName = getProfileDisplayName(profiles.find(p => p.id === log.user_id));
    const userName = profileName !== 'User'
      ? profileName
      : (log.details?.actor_name || log.details?.user_name || log.details?.actor_email || 'User');
    setAuditLogs(prev => [{ ...log, userName }, ...prev]);
  }, [profiles]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [auditRes, profilesRes, processosRes, tarefasRes, settingsRes] = await Promise.all([
          supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
          supabase.from('profiles').select('*'),
          supabase.from('processos').select('*'),
          supabase.from('tarefas').select('*'),
          supabase.from('office_settings').select('*').order('updated_at', { ascending: false }).limit(1)
        ]);

        if (auditRes.error) toast.error(`Audit logs: ${auditRes.error.message}`);
        if (profilesRes.error) toast.error(`Perfis: ${profilesRes.error.message}`);
        if (processosRes.error) toast.error(`Processos: ${processosRes.error.message}`);
        if (tarefasRes.error) toast.error(`Tarefas: ${tarefasRes.error.message}`);

        const audit = auditRes.data || [];
        const profilesData = profilesRes.data || [];
        const processos = processosRes.data || [];
        const tarefas = tarefasRes.data || [];

        const settingsData = settingsRes?.data || [];
        const effectiveSettings = settingsData[0] || {};
        const alertWindowDays = Number(effectiveSettings.alert_window_days ?? settings.alert_window_days) || 7;

        if (settingsData[0]) {
          const nextSettings = {
            alert_window_days: effectiveSettings.alert_window_days ?? 7,
            risk_high_terms: effectiveSettings.risk_high_terms ?? 'alto',
            risk_medium_terms: effectiveSettings.risk_medium_terms ?? 'médio,medio',
            template_minuta: effectiveSettings.template_minuta ?? ''
          };
          setSettings(nextSettings);
        }

        const userMap = {};
        profilesData.forEach(p => userMap[p.id] = getProfileDisplayName(p));

        const counts = {};
        audit.forEach(l => {
          const n = userMap[l.user_id] || 'Desc.';
          counts[n] = (counts[n] || 0) + 1;
        });

        const today = new Date();
        const activeToday = new Set(audit.filter(l => {
          const d = new Date(l.created_at);
          return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        }).map(l => l.user_id)).size;

        setStats({ totalUsers: profilesData.length, activeToday, totalActions: audit.length });
        setAuditLogs(audit.map(l => ({
          ...l,
          userName: userMap[l.user_id] || l.details?.actor_name || l.details?.user_name || l.details?.actor_email || 'User'
        })));
        setProfiles(profilesData);

        // KPIs - Prazos
        const prazosCounts = { vencidos: 0, hoje: 0, seteDias: 0, semResponsavel: 0 };
        processos.forEach(p => {
          const date = getEffectiveDate(p);
          const days = getDaysToDue(date);
          if (days !== null) {
            if (days < 0) prazosCounts.vencidos += 1;
            if (days === 0) prazosCounts.hoje += 1;
            if (days > 0 && days <= alertWindowDays) prazosCounts.seteDias += 1;
          }
          if (!p.responsavel_id) prazosCounts.semResponsavel += 1;
        });

        // KPIs - Risco
        const riskCounts = { alto: 0, medio: 0, semClassificacao: 0, semMovimentacao30: 0 };
        processos.forEach(p => {
          const risk = (p.risco || '').toLowerCase();
          if (!risk) riskCounts.semClassificacao += 1;
          if (risk.includes('alto')) riskCounts.alto += 1;
          if (risk.includes('médio') || risk.includes('medio')) riskCounts.medio += 1;
          const lastMove = p.data_andamento || p.created_at;
          if (lastMove) {
            const diff = (today - new Date(lastMove)) / (1000 * 60 * 60 * 24);
            if (diff >= 30) riskCounts.semMovimentacao30 += 1;
          }
        });

        // Produtividade
        const openByUser = {};
        const overdueByUser = {};
        const completedInWeek = [];
        const completionDurations = [];
        const tasksByProcess = {};

        tarefas.forEach(t => {
          const userName = userMap[t.user_id] || 'Desc.';
          const dueDate = getTaskDueDate(t);
          const isCompleted = isTaskCompleted(t);
          if (!tasksByProcess[t.processo_id]) tasksByProcess[t.processo_id] = [];
          tasksByProcess[t.processo_id].push(t);

          if (!isCompleted && t.status_tarefa !== 'minuta') {
            openByUser[userName] = (openByUser[userName] || 0) + 1;
            if (dueDate && getDaysToDue(dueDate) < 0) {
              overdueByUser[userName] = (overdueByUser[userName] || 0) + 1;
            }
          }

          if (isCompleted && t.updated_at) {
            const diffDays = (today - new Date(t.updated_at)) / (1000 * 60 * 60 * 24);
            if (diffDays <= 7) completedInWeek.push(t);
            if (t.created_at) {
              const durationHours = (new Date(t.updated_at) - new Date(t.created_at)) / (1000 * 60 * 60);
              if (durationHours > 0) completionDurations.push(durationHours);
            }
          }
        });

        const highRiskNoTask = processos.filter(p => {
          const risk = (p.risco || '').toLowerCase();
          if (!risk.includes('alto')) return false;
          const tasks = tasksByProcess[p.id] || [];
          return !tasks.some(t => !isTaskCompleted(t) && t.status_tarefa !== 'minuta');
        });

        const avgCompletionHours = completionDurations.length
          ? (completionDurations.reduce((a, b) => a + b, 0) / completionDurations.length)
          : 0;

        setProductivity({
          openByUser: Object.entries(openByUser).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
          overdueByUser: Object.entries(overdueByUser).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
          completedWeek: completedInWeek.length,
          avgCompletionHours,
          highRiskNoTask
        });

        setKpis(prev => ({ ...prev, prazos: prazosCounts, risco: riskCounts }));

        // Pipeline runs
        const { data: pipelineData, error: pipelineErr } = await supabase
          .from('pipeline_runs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        if (!pipelineErr && pipelineData) {
          const uniqueRuns = dedupePipelineRuns(pipelineData);
          setPipelineRuns(uniqueRuns);

          const todayRuns = uniqueRuns.filter(r => {
            const d = new Date(r.created_at);
            return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
          });

          const successes = todayRuns.filter(r => {
            const status = (r.status || '').toLowerCase();
            return status === 'success' || (!r.error_message && !r.erros);
          }).length;
          const failures = todayRuns.filter(r => {
            const status = (r.status || '').toLowerCase();
            return status === 'error' || status === 'failed' || r.error_message || r.erros;
          }).length;
          const emRevisao = uniqueRuns.filter(r => r.needs_review).length;
          const durations = uniqueRuns.map(r => r.duration_ms || r.duration || 0).filter(Boolean);
          const avgMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

          setKpis(prev => ({
            ...prev,
            pipeline: {
              processadosHoje: successes,
              falhasHoje: failures,
              emRevisao,
              tempoMedio: avgMs
            }
          }));
        } else {
          setPipelineRuns([]);
        }

        // SOS tickets
        const { data: sosData, error: sosErr } = await supabase
          .from('chamados_sos')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30);
        if (sosErr) {
          console.error('SOS tickets error:', sosErr);
          toast.error(`SOS: ${sosErr.message}`);
          setSosTickets([]);
        } else {
          setSosTickets(sosData || []);
        }
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar dados admin");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const auditUsers = useMemo(() => {
    const users = [...new Set(auditLogs.map(l => l.userName).filter(Boolean))].sort();
    return users;
  }, [auditLogs]);

  const auditActions = useMemo(() => {
    const actions = [...new Set(auditLogs.map(l => l.action).filter(Boolean))].sort();
    return actions;
  }, [auditLogs]);

  const auditResources = useMemo(() => {
    const resources = [...new Set(auditLogs.map(l => l.resource || l.details?.resource).filter(Boolean))].sort();
    return resources;
  }, [auditLogs]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(l => {
      const matchesUser = auditFilters.user === 'all' || l.userName === auditFilters.user;
      const matchesAction = auditFilters.action === 'all' || l.action === auditFilters.action;
      const resource = l.resource || l.details?.resource || '';
      const matchesResource = auditFilters.resource === 'all' || resource === auditFilters.resource;
      const createdAt = l.created_at ? normalizeDate(l.created_at) : '';
      const matchesFrom = !auditFilters.dateFrom || (createdAt && createdAt >= auditFilters.dateFrom);
      const matchesTo = !auditFilters.dateTo || (createdAt && createdAt <= auditFilters.dateTo);
      const query = auditFilters.search.toLowerCase();
      const matchesSearch = !query || `${l.target_id || ''} ${l.action || ''} ${resource} ${l.userName || ''}`.toLowerCase().includes(query);
      return matchesUser && matchesAction && matchesResource && matchesFrom && matchesTo && matchesSearch;
    });
  }, [auditLogs, auditFilters]);

  const handleExportAuditCsv = () => {
    if (!filteredAuditLogs.length) return toast.warning('Nenhum log para exportar.');
    const rows = filteredAuditLogs.map(l => ({
      Data: l.created_at ? new Date(l.created_at).toLocaleString() : '-',
      Usuario: l.userName || '-',
      Acao: l.action || '-',
      Recurso: l.resource || l.details?.resource || '-',
      Ref: l.target_id || l.ref || '-',
      CNJ: l.cnj || l.details?.cnj || '-'
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'AuditLog');
    XLSX.writeFile(workbook, 'audit-log.csv');
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const payload = {
        id: 1,
        alert_window_days: Number(settings.alert_window_days) || 7,
        risk_high_terms: settings.risk_high_terms || 'alto',
        risk_medium_terms: settings.risk_medium_terms || 'médio,medio',
        template_minuta: settings.template_minuta || ''
      };
      const { error } = await supabase.from('office_settings').upsert(payload, { onConflict: 'id' });
      if (error) throw error;

      try {
        localStorage.setItem('office_settings_cache', JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent('office_settings_updated', { detail: payload }));
      } catch {}

      toast.success('Configurações salvas.');
      const newLog = await logAction(currentUserId, 'UPDATE_SETTINGS', String(payload.id), {
        resource: 'office_settings',
        after: payload,
        ...actorDetails
      });
      appendAuditLog(newLog);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar configurações.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdateRole = async (userId, role) => {
    try {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
      if (error) throw error;
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role } : p));
      toast.success('Permissão atualizada.');
      const newLog = await logAction(currentUserId, 'UPDATE_ROLE', userId, {
        resource: 'profiles',
        role,
        ...actorDetails
      });
      appendAuditLog(newLog);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar permissão.');
    }
  };

  const handleToggleBanClick = (profile) => {
    setUserToToggle(profile);
    setBanModalOpen(true);
  };

  const executeToggleBan = async () => {
    if (!userToToggle) return;
    setIsTogglingBan(true);
    const currentStatus = userToToggle.status;
    const newStatus = currentStatus === 'banned' ? 'active' : 'banned';
    
    try {
      const { data, error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', userToToggle.id).select();
      
      if (error) throw error;
      
      // Check if any row was actually updated
      if (!data || data.length === 0) {
        throw new Error("Não foi possível atualizar o usuário. Verifique se você tem permissão de Admin.");
      }

      setProfiles(prev => prev.map(p => p.id === userToToggle.id ? { ...p, status: newStatus } : p));
      toast.success(`Usuário ${newStatus === 'banned' ? 'banido' : 'ativado'} com sucesso.`);
      const newLog = await logAction(currentUserId, 'TOGGLE_USER_STATUS', userToToggle.id, {
        resource: 'profiles',
        status: newStatus,
        ...actorDetails
      });
      appendAuditLog(newLog);
      setBanModalOpen(false);
      setUserToToggle(null);
    } catch (error) {
      console.error('Erro detalhado:', error);
      toast.error(error.message || 'Erro ao atualizar status.');
    } finally {
      setIsTogglingBan(false);
    }
  };

  const updateSosTicketStatus = async (ticket, newStatus) => {
    const ticketId = ticket?.id;
    if (!ticketId) return;
    setSosActionLoading(prev => ({ ...prev, [ticketId]: `status:${newStatus}` }));
    try {
      const { error } = await supabase
        .from('chamados_sos')
        .update({ status: newStatus })
        .eq('id', ticketId);
      if (error) throw error;
      setSosTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
      toast.success(newStatus === 'concluido' ? 'Chamado concluído.' : 'Chamado reaberto.');
      const newLog = await logAction(currentUserId, 'UPDATE_SOS_STATUS', ticketId, {
        resource: 'chamados_sos',
        status: newStatus,
        ...actorDetails
      });
      appendAuditLog(newLog);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Erro ao atualizar chamado.');
    } finally {
      setSosActionLoading(prev => ({ ...prev, [ticketId]: null }));
    }
  };

  const openDeleteSos = (ticket) => {
    setSosToDelete(ticket);
    setSosDeleteModalOpen(true);
  };

  const executeDeleteSos = async () => {
    if (!sosToDelete?.id) return;
    const ticketId = sosToDelete.id;
    setIsDeletingSos(true);
    setSosActionLoading(prev => ({ ...prev, [ticketId]: 'delete' }));
    try {
      const { error } = await supabase
        .from('chamados_sos')
        .delete()
        .eq('id', ticketId);
      if (error) throw error;
      setSosTickets(prev => prev.filter(t => t.id !== ticketId));
      toast.success('Chamado excluído.');
      const newLog = await logAction(currentUserId, 'DELETE_SOS', ticketId, {
        resource: 'chamados_sos',
        ...actorDetails
      });
      appendAuditLog(newLog);
      setSosDeleteModalOpen(false);
      setSosToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Erro ao excluir chamado.');
    } finally {
      setIsDeletingSos(false);
      setSosActionLoading(prev => ({ ...prev, [ticketId]: null }));
    }
  };

  const runPipelineAction = async (run, action) => {
    const runId = run?.id;
    if (!runId) return toast.error('Processamento inválido.');
    const isReview = action === 'review';
    const url = isReview ? API_PIPELINE_REVIEW_URL : API_PIPELINE_REPROCESS_URL;

    setPipelineActionLoading(prev => ({ ...prev, [runId]: action }));
    try {
      const payload = isReview
        ? { run_id: runId }
        : { run_id: runId, identifier: run.identifier, file_name: run.file_name, payload: run.payload };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Falha ao chamar webhook.');
      }

      if (isReview) {
        setPipelineRuns(prev => prev.map(r => r.id === runId ? { ...r, needs_review: true } : r));
      }

      toast.success(isReview ? 'Item marcado para revisão.' : 'Reprocessamento enviado.');
    } catch (error) {
      console.error(error);
      toast.error(isReview ? 'Erro ao marcar revisão.' : 'Erro ao reprocessar.');
    } finally {
      setPipelineActionLoading(prev => ({ ...prev, [runId]: null }));
    }
  };

  const dedupePipelineRuns = (runs) => {
    const sorted = [...runs].sort((a, b) => {
      const da = new Date(a.created_at || 0).getTime();
      const db = new Date(b.created_at || 0).getTime();
      return db - da;
    });
    const map = new Map();
    sorted.forEach((run) => {
      const fileKey = run.identifier || run.file_name || run.id || 'run';
      const metricsKey = [
        run.processos_detectados ?? '-',
        run.andamentos_inseridos ?? '-',
        run.duplicados_evitados ?? '-',
        run.error_message || run.erros || '-',
        run.duration_ms || run.duration || '-'
      ].join('|');
      const key = `${fileKey}::${metricsKey}`;
      if (!map.has(key)) map.set(key, run);
    });
    return Array.from(map.values());
  };

  const uniquePipelineRuns = useMemo(() => {
    if (!pipelineRuns?.length) return [];
    return dedupePipelineRuns(pipelineRuns);
  }, [pipelineRuns]);

  const visiblePipelineRuns = useMemo(() => {
    if (!uniquePipelineRuns?.length) return [];
    return isPipelineCollapsed ? uniquePipelineRuns.slice(0, 4) : uniquePipelineRuns;
  }, [uniquePipelineRuns, isPipelineCollapsed]);

  const visibleHighRiskNoTask = useMemo(() => {
    if (!productivity.highRiskNoTask?.length) return [];
    return isRiskCollapsed ? productivity.highRiskNoTask.slice(0, 4) : productivity.highRiskNoTask;
  }, [productivity.highRiskNoTask, isRiskCollapsed]);

  const profilesMap = useMemo(() => {
    const map = {};
    profiles.forEach((p) => {
      map[p.id] = getProfileDisplayName(p);
    });
    return map;
  }, [profiles]);

  const riskOwnersSummary = useMemo(() => {
    if (!productivity.highRiskNoTask?.length) return '';
    const names = productivity.highRiskNoTask.map(p => profilesMap[p.responsavel_id] || 'Sem responsável');
    const unique = [...new Set(names)].filter(Boolean);
    if (unique.length <= 3) return unique.join(', ');
    return `${unique.slice(0, 3).join(', ')} +${unique.length - 3}`;
  }, [productivity.highRiskNoTask, profilesMap]);

  const toggleRiskProcess = (processId) => {
    setExpandedRiskProcesses(prev => (
      prev.includes(processId)
        ? prev.filter(id => id !== processId)
        : [...prev, processId]
    ));
  };

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex items-center space-x-2">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><LayoutDashboard className="w-5 h-5 text-gray-500" /></button>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center"><Activity className="w-6 h-6 mr-2 text-blue-600" /> Centro de Operações</h2>
        {loading && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Prazos</p>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
              <p className="text-xs text-red-600">Vencidos</p>
              <p className="text-2xl font-bold text-red-700">{kpis.prazos.vencidos}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
              <p className="text-xs text-amber-600">Vence hoje</p>
              <p className="text-2xl font-bold text-amber-700">{kpis.prazos.hoje}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
              <p className="text-xs text-blue-600">Vence em {Number(settings.alert_window_days) || 7} dias</p>
              <p className="text-2xl font-bold text-blue-700">{kpis.prazos.seteDias}</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/20 border border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500">Sem responsável</p>
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-200">{kpis.prazos.semResponsavel}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Risco</p>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
              <p className="text-xs text-red-600">Risco alto</p>
              <p className="text-2xl font-bold text-red-700">{kpis.risco.alto}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
              <p className="text-xs text-amber-600">Risco médio</p>
              <p className="text-2xl font-bold text-amber-700">{kpis.risco.medio}</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/20 border border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500">Sem classificação</p>
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-200">{kpis.risco.semClassificacao}</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
              <p className="text-xs text-purple-600">Sem movimentação 30d</p>
              <p className="text-2xl font-bold text-purple-700">{kpis.risco.semMovimentacao30}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Ingestão/Pipeline</p>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
              <p className="text-xs text-green-600">PDFs processados hoje</p>
              <p className="text-2xl font-bold text-green-700">{kpis.pipeline.processadosHoje}</p>
            </div>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
              <p className="text-xs text-red-600">Falhas hoje</p>
              <p className="text-2xl font-bold text-red-700">{kpis.pipeline.falhasHoje}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
              <p className="text-xs text-amber-600">Itens em revisão</p>
              <p className="text-2xl font-bold text-amber-700">{kpis.pipeline.emRevisao}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
              <p className="text-xs text-blue-600">Tempo médio</p>
              <p className="text-2xl font-bold text-blue-700">{kpis.pipeline.tempoMedio ? `${Math.round(kpis.pipeline.tempoMedio / 1000)}s` : '0s'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 dark:text-white flex items-center">
            <UploadCloud className="w-5 h-5 mr-2 text-blue-500" />
            Pipeline - Últimos Processamentos
            <HelpTip text="Mostra os últimos PDFs ingeridos pelo workflow (n8n). Use Reprocessar para reenviar o mesmo payload e Revisão para marcar itens que precisam de checagem manual." />
          </h3>
          {pipelineRuns.length > 4 && (
            <button
              type="button"
              onClick={() => setIsPipelineCollapsed(v => !v)}
              className="text-xs px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-2"
              title={isPipelineCollapsed ? 'Expandir lista' : 'Recolher lista'}
            >
              {isPipelineCollapsed ? 'Ver mais' : 'Ver menos'}
              {isPipelineCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Arquivo/ID</th>
                <th className="p-3">Identificação</th>
                <th className="p-3">Métricas</th>
                <th className="p-3">Erros</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {pipelineRuns.length === 0 && (
                <tr><td colSpan="6" className="p-6 text-center text-gray-500">Nenhum processamento encontrado.</td></tr>
              )}
              {visiblePipelineRuns.map(run => (
                (() => {
                  const payload = run.payload || {};
                  const processoId = payload.processo_id || payload.processoId || payload.id || '-';
                  const textoResumo = payload.texto_resumo || payload.textoResumo || '-';
                  const dataAndamento = payload.data_andamento || payload.dataAndamento || '-';
                  return (
                <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="p-3 text-gray-500 whitespace-nowrap">{run.created_at ? new Date(run.created_at).toLocaleString() : '-'}</td>
                  <td className="p-3 text-gray-700 dark:text-gray-200">
                    <div className="font-medium truncate max-w-[180px]" title={run.file_name || run.identifier || run.id}>{run.file_name || run.identifier || run.id}</div>
                    <div className="text-xs text-gray-400 truncate max-w-[180px]" title={run.identifier || run.id}>{run.identifier || run.id}</div>
                  </td>
                  <td className="p-3 text-gray-600 text-xs">
                    <div className="font-medium truncate max-w-[220px]" title={processoId}>Proc: {processoId}</div>
                    <div className="truncate max-w-[220px]" title={textoResumo}>{textoResumo}</div>
                    <div className="text-[11px] text-gray-400">And.: {dataAndamento && dataAndamento !== '-' ? new Date(dataAndamento).toLocaleDateString('pt-BR') : '-'}</div>
                  </td>
                  <td className="p-3">
                    <div className="text-xs text-gray-600">Proc: <span className="font-semibold">{run.processos_detectados ?? '-'}</span></div>
                    <div className="text-xs text-gray-600">And.: <span className="font-semibold">{run.andamentos_inseridos ?? '-'}</span></div>
                    <div className="text-xs text-gray-600">Dup.: <span className="font-semibold">{run.duplicados_evitados ?? '-'}</span></div>
                    <div className="text-xs text-gray-600">Duração: <span className="font-semibold">{run.duration_ms ? `${Math.round(run.duration_ms / 1000)}s` : '-'}</span></div>
                  </td>
                  <td className="p-3 text-xs text-gray-600">
                    {run.error_message || run.erros || '-'}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => runPipelineAction(run, 'reprocess')}
                        disabled={pipelineActionLoading[run.id] === 'reprocess'}
                        className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                      >
                        {pipelineActionLoading[run.id] === 'reprocess' ? 'Enviando...' : 'Reprocessar'}
                      </button>
                      <button
                        onClick={() => runPipelineAction(run, 'review')}
                        disabled={pipelineActionLoading[run.id] === 'review'}
                        className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                      >
                        {pipelineActionLoading[run.id] === 'review' ? 'Marcando...' : 'Revisão'}
                      </button>
                      <button onClick={() => setSelectedRun(run)} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">Ver payload</button>
                    </div>
                  </td>
                </tr>
                  );
                })()
              ))}
            </tbody>
          </table>
        </div>
        {pipelineRuns.length > 4 && isPipelineCollapsed && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setIsPipelineCollapsed(false)}
              className="text-xs text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white flex items-center gap-2"
              title="Mostrar mais processamentos"
            >
              <MoreHorizontal className="w-4 h-4" />
              Mostrar mais ({pipelineRuns.length - 4})
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800 dark:text-white flex items-center">
              <FileSignature className="w-5 h-5 mr-2 text-purple-500" />
              Audit Log
              <HelpTip text="Registro de ações dos usuários (quem fez o quê e quando). Use os filtros para encontrar eventos específicos e exporte CSV quando precisar auditar." />
            </h3>
            <button onClick={handleExportAuditCsv} className="text-xs px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Exportar CSV</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <select value={auditFilters.user} onChange={(e) => setAuditFilters(prev => ({ ...prev, user: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
              <option value="all">Usuário</option>
              {auditUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <select value={auditFilters.action} onChange={(e) => setAuditFilters(prev => ({ ...prev, action: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
              <option value="all">Ação</option>
              {auditActions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={auditFilters.resource} onChange={(e) => setAuditFilters(prev => ({ ...prev, resource: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
              <option value="all">Recurso</option>
              {auditResources.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input type="date" value={auditFilters.dateFrom} onChange={(e) => setAuditFilters(prev => ({ ...prev, dateFrom: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            <input type="date" value={auditFilters.dateTo} onChange={(e) => setAuditFilters(prev => ({ ...prev, dateTo: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            <input type="text" value={auditFilters.search} onChange={(e) => setAuditFilters(prev => ({ ...prev, search: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" placeholder="Busca rápida" />
          </div>
        </div>
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Usuário</th>
                <th className="p-3">Ação</th>
                <th className="p-3">Recurso</th>
                <th className="p-3">Ref/CNJ</th>
                <th className="p-3">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredAuditLogs.length === 0 && (
                <tr><td colSpan="6" className="p-6 text-center text-gray-500">Nenhum log encontrado.</td></tr>
              )}
              {filteredAuditLogs.map(l => (
                <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="p-3 text-gray-500 whitespace-nowrap">{l.created_at ? new Date(l.created_at).toLocaleString() : '-'}</td>
                  <td className="p-3 font-medium text-gray-800 dark:text-gray-200">{l.userName}</td>
                  <td className="p-3"><span className="px-2 py-1 bg-gray-100 rounded text-xs">{l.action || '-'}</span></td>
                  <td className="p-3 text-gray-500">{l.resource || l.details?.resource || '-'}</td>
                  <td className="p-3 text-gray-400 text-xs truncate max-w-[140px]">{l.target_id || l.cnj || l.ref || l.details?.cnj || '-'}</td>
                  <td className="p-3"><button onClick={() => setSelectedAudit(l)} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-yellow-500" /> Produtividade</h3>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40">
              <p className="text-xs text-gray-500">Concluídas na semana</p>
              <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{productivity.completedWeek}</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40">
              <p className="text-xs text-gray-500">Tempo médio de conclusão</p>
              <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{productivity.avgCompletionHours ? `${Math.round(productivity.avgCompletionHours)}h` : '—'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">Tarefas abertas por usuário</h3>
          <div className="space-y-3">
            {productivity.openByUser.length === 0 && <p className="text-sm text-gray-500">Sem tarefas abertas.</p>}
            {productivity.openByUser.map((u, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">{u.name}</span>
                <span className="font-semibold text-gray-800 dark:text-gray-100">{u.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">Tarefas vencidas por usuário</h3>
          <div className="space-y-3">
            {productivity.overdueByUser.length === 0 && <p className="text-sm text-gray-500">Nenhum atraso identificado.</p>}
            {productivity.overdueByUser.map((u, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">{u.name}</span>
                <span className="font-semibold text-red-600">{u.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div 
          className="flex items-center justify-between cursor-pointer mb-4" 
          onClick={() => setIsRiskCollapsed(!isRiskCollapsed)}
        >
          <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
            Processos com risco alto sem tarefa aberta
            {productivity.highRiskNoTask.length > 0 && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">{productivity.highRiskNoTask.length}</span>}
            {riskOwnersSummary && (
              <span className="text-xs text-gray-500 font-medium" title={riskOwnersSummary}>
                {riskOwnersSummary}
              </span>
            )}
          </h3>
          {isRiskCollapsed ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronUp className="w-5 h-5 text-gray-500" />}
        </div>

        {productivity.highRiskNoTask.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum processo crítico sem ação.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in">
              {visibleHighRiskNoTask.map(p => (
                <div key={p.id} className="p-3 rounded-lg border border-red-100 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
                  <button
                    type="button"
                    onClick={() => onOpenProcess?.(p)}
                    className="w-full text-left"
                    title="Abrir detalhes do processo"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-red-700">{p.numero_cnj || p.id}</p>
                        <p className="text-xs text-red-600">Sem tarefa aberta</p>
                        <p className="text-xs text-red-500 mt-1">Envolvidos: {p.cliente_nome || 'Não informado'}</p>
                        <p className="text-xs text-red-500 mt-1">Responsável: {profilesMap[p.responsavel_id] || 'Sem responsável'}</p>
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>

            {productivity.highRiskNoTask.length > 4 && isRiskCollapsed && (
              <div className="mt-3 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setIsRiskCollapsed(false)}
                  className="text-xs text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white flex items-center gap-2"
                  title="Mostrar todos os processos"
                >
                  <MoreHorizontal className="w-4 h-4" />
                  Mostrar mais ({productivity.highRiskNoTask.length - 4})
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-blue-500" />
            Configurações do Escritório
            <HelpTip text="Essas configurações definem como o painel interpreta prazos e classifica risco (alto/médio). Use os presets e o ‘Testar termos’ para validar antes de salvar." />
          </h3>

          <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Recomendações rápidas</p>
            <p className="text-xs text-blue-700/80 dark:text-blue-200/80">Clique para aplicar um perfil de configuração comum.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setSettings(prev => ({ ...prev, alert_window_days: 3 }))} className="text-xs px-3 py-1.5 rounded bg-white/70 hover:bg-white text-blue-700 border border-blue-200">Urgente (3 dias)</button>
              <button type="button" onClick={() => setSettings(prev => ({ ...prev, alert_window_days: 7 }))} className="text-xs px-3 py-1.5 rounded bg-white/70 hover:bg-white text-blue-700 border border-blue-200">Padrão (7 dias)</button>
              <button type="button" onClick={() => setSettings(prev => ({ ...prev, alert_window_days: 14 }))} className="text-xs px-3 py-1.5 rounded bg-white/70 hover:bg-white text-blue-700 border border-blue-200">Conservador (14 dias)</button>
              <button
                type="button"
                onClick={() => setSettings(prev => ({
                  ...prev,
                  alert_window_days: 7,
                  risk_high_terms: 'liminar, urgente, tutela, bloqueio, penhora, intimação, prazo fatal',
                  risk_medium_terms: 'audiência, citação, contestação, recurso, embargo, pericia'
                }))}
                className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white"
              >
                Aplicar termos sugeridos
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Janela de Alerta</label>
              <input type="number" value={settings.alert_window_days} onChange={(e) => setSettings(prev => ({ ...prev, alert_window_days: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" />
              <p className="text-xs text-gray-400 mt-1">Dias de antecedência para avisos de prazo.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Termos de Risco Alto</label>
              <input type="text" value={settings.risk_high_terms} onChange={(e) => setSettings(prev => ({ ...prev, risk_high_terms: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" />
              <p className="text-xs text-gray-400 mt-1">Palavras separadas por vírgula (ex: liminar, urgente).</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {['liminar', 'tutela', 'urgente', 'bloqueio', 'penhora', 'intimação'].map(term => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setSettings(prev => ({ ...prev, risk_high_terms: toggleTermInList(prev.risk_high_terms, term) }))}
                    className="text-[11px] px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
                    title="Clique para adicionar/remover"
                  >
                    + {term}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Termos de Risco Médio</label>
              <input type="text" value={settings.risk_medium_terms} onChange={(e) => setSettings(prev => ({ ...prev, risk_medium_terms: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" />
              <p className="text-xs text-gray-400 mt-1">Palavras separadas por vírgula.</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {['audiência', 'citação', 'contestação', 'recurso', 'embargo', 'perícia'].map(term => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setSettings(prev => ({ ...prev, risk_medium_terms: toggleTermInList(prev.risk_medium_terms, term) }))}
                    className="text-[11px] px-2 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-100 hover:bg-amber-100"
                    title="Clique para adicionar/remover"
                  >
                    + {term}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template de Minuta</label>
                <button
                  type="button"
                  onClick={() => setSettings(prev => ({
                    ...prev,
                    template_minuta: prev.template_minuta ||
`Você é um(a) advogado(a) experiente. Redija uma minuta objetiva e bem estruturada com base no RESUMO abaixo.

Regras:
- Use linguagem formal.
- Estruture em: (1) Síntese; (2) Fatos; (3) Fundamentos; (4) Pedidos.
- Se faltar informação, faça suposições mínimas e indique o que falta.

RESUMO:
{{texto_resumo}}`
                  }))}
                  className="text-xs px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                  title="Preenche com um modelo pronto"
                >
                  Inserir modelo básico
                </button>
              </div>

              <textarea value={settings.template_minuta} onChange={(e) => setSettings(prev => ({ ...prev, template_minuta: e.target.value }))} rows={5} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 font-mono text-xs" />
              <p className="text-xs text-gray-400 mt-1">Dica: isso influencia a minuta gerada pela IA (quando suportado pelo workflow). Use {'{{texto_resumo}}'} como marcador.</p>
            </div>
          </div>

          <div className="mt-5 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Testar termos de risco</p>
              <button type="button" onClick={() => setSettingsAdvancedOpen(v => !v)} className="text-xs px-3 py-1.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200">
                {settingsAdvancedOpen ? 'Ocultar detalhes' : 'Mostrar detalhes'}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cole um trecho de andamento/movimentação e veja como ele seria classificado.</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <input
                  value={settingsTestText}
                  onChange={(e) => setSettingsTestText(e.target.value)}
                  placeholder="Ex: Intimação para cumprimento de sentença em 48 horas..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                />
              </div>
              <div className="flex items-center">
                {riskTestResult ? (
                  <span className={`w-full text-center text-sm font-semibold px-3 py-2 rounded-lg border ${riskTestResult === 'alto' ? 'bg-red-50 text-red-700 border-red-100' : riskTestResult === 'médio' ? 'bg-amber-50 text-amber-800 border-amber-100' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                    Resultado: {riskTestResult}
                  </span>
                ) : (
                  <span className="w-full text-center text-sm px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400">
                    Digite um texto
                  </span>
                )}
              </div>
            </div>

            {settingsAdvancedOpen && (
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                <p><span className="font-semibold">Como funciona:</span> se o texto contiver algum termo de “Risco Alto”, ele vira Alto; senão, se contiver termo de “Risco Médio”, vira Médio.</p>
              </div>
            )}
          </div>

          <div className="mt-4">
            <button onClick={handleSaveSettings} disabled={savingSettings} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-2">
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar configurações
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center">
            Usuários e papéis
            <HelpTip text="Admins podem alterar o papel (admin/user) e banir/reativar usuários. ‘Banido’ impede o acesso, mas pode ser revertido." />
          </h3>
          <div className="space-y-3">
            {profiles.map(profile => (
              <div key={profile.id} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${profile.status === 'banned' ? 'bg-red-500' : 'bg-green-500'}`} title={profile.status === 'banned' ? 'Banido' : 'Ativo'} />
                  <div>
                    <p className={`font-medium ${profile.status === 'banned' ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-100'}`}>
                      {getProfileDisplayName(profile)}
                    </p>
                    <p className="text-xs text-gray-400">{profile.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select value={profile.role || 'user'} onChange={(e) => handleUpdateRole(profile.id, e.target.value)} className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs">
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                  <button 
                    onClick={() => handleToggleBanClick(profile)}
                    className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${profile.status === 'banned' ? 'text-green-600' : 'text-red-500'}`}
                    title={profile.status === 'banned' ? 'Reativar Usuário' : 'Banir Usuário'}
                  >
                    {profile.status === 'banned' ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-800 dark:text-white">Chamados SOS</h3>
          <p className="text-xs text-gray-400">Acompanhe e resolva chamados de suporte.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Contato</th>
                <th className="p-3">Mensagem</th>
                <th className="p-3">Status</th>
                <th className="p-3">SLA</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sosTickets.length === 0 && (
                <tr><td colSpan="6" className="p-6 text-center text-gray-500">Nenhum chamado registrado.</td></tr>
              )}
              {sosTickets.map(ticket => {
                const statusRaw = (ticket.status || 'aberto').toString().toLowerCase();
                const isDone = statusRaw === 'concluido' || statusRaw === 'concluído' || statusRaw === 'feito' || statusRaw === 'resolvido';
                const statusClass = isDone
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200';
                const actionState = sosActionLoading[ticket.id];
                return (
                <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="p-3 text-gray-500 whitespace-nowrap">{ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '-'}</td>
                  <td className="p-3 text-gray-700 dark:text-gray-200">{ticket.contato || ticket.user_id || '-'}</td>
                  <td className="p-3 text-gray-600 max-w-[260px] truncate">{ticket.mensagem || '-'}</td>
                  <td className="p-3 text-xs"><span className={`px-2 py-1 rounded ${statusClass}`}>{ticket.status || 'aberto'}</span></td>
                  <td className="p-3 text-xs text-gray-500">{ticket.sla_due_at ? new Date(ticket.sla_due_at).toLocaleString() : '-'}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => updateSosTicketStatus(ticket, isDone ? 'aberto' : 'concluido')}
                        disabled={!!actionState}
                        className={`px-2 py-1 rounded border text-xs font-medium transition-colors ${isDone ? 'border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/20' : 'border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-200 dark:hover:bg-green-900/20'} disabled:opacity-50`}
                        title={isDone ? 'Reabrir chamado' : 'Marcar como concluído'}
                      >
                        {actionState?.startsWith('status:') ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isDone ? (
                          <RefreshCw className="w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={() => openDeleteSos(ticket)}
                        disabled={!!actionState}
                        className="px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20 disabled:opacity-50"
                        title="Excluir chamado"
                      >
                        {actionState === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRun && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedRun(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full p-5 border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-gray-800 dark:text-white">Payload / Erro</h4>
              <button onClick={() => setSelectedRun(null)}><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded-lg overflow-auto max-h-[400px]">
              {JSON.stringify(selectedRun.payload || selectedRun.error_message || selectedRun, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {selectedAudit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAudit(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full p-5 border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-gray-800 dark:text-white">Detalhes do evento</h4>
              <button onClick={() => setSelectedAudit(null)}><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                <p className="font-semibold text-gray-500 mb-2">Before</p>
                <pre className="overflow-auto max-h-[240px]">{JSON.stringify(selectedAudit.before || selectedAudit.details?.before || {}, null, 2)}</pre>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                <p className="font-semibold text-gray-500 mb-2">After</p>
                <pre className="overflow-auto max-h-[240px]">{JSON.stringify(selectedAudit.after || selectedAudit.details?.after || {}, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ban/Activate Confirmation Modal */}
      <ConfirmModal
        isOpen={banModalOpen}
        onClose={() => { setBanModalOpen(false); setUserToToggle(null); }}
        onConfirm={executeToggleBan}
        loading={isTogglingBan}
        title={userToToggle?.status === 'banned' ? 'Reativar Usuário?' : 'Banir Usuário?'}
        description={
          userToToggle
            ? `Tem certeza que deseja ${userToToggle.status === 'banned' ? 'ATIVAR' : 'BANIR'} o usuário ${getProfileDisplayName(userToToggle)}? Essa ação pode ser revertida.`
            : 'Confirma esta ação?'
        }
        confirmText={userToToggle?.status === 'banned' ? 'Sim, reativar' : 'Sim, banir'}
        variant={userToToggle?.status === 'banned' ? 'success' : 'danger'}
      />

      <ConfirmModal
        isOpen={sosDeleteModalOpen}
        onClose={() => { if (!isDeletingSos) { setSosDeleteModalOpen(false); setSosToDelete(null); } }}
        onConfirm={executeDeleteSos}
        loading={isDeletingSos}
        title="Excluir chamado SOS?"
        description={
          sosToDelete
            ? `Esta ação removerá permanentemente o chamado de ${sosToDelete.contato || sosToDelete.user_id || 'usuário'} (${(sosToDelete.status || 'aberto').toString()}). Tem certeza?`
            : 'Esta ação removerá permanentemente este chamado. Tem certeza?'
        }
        confirmText="Sim, excluir"
        variant="danger"
      />
    </div>
  );
};

// Header foi movido para ./components/Header.jsx

// AgendaView foi movido para ./components/AgendaView.jsx

// StatsBar foi movido para ./components/StatsBar.jsx

// FilterBar foi movido para ./components/FilterBar.jsx

// UploadModal foi movido para ./components/UploadModal.jsx
// ProcessCard foi movido para ./components/ProcessCard.jsx

// --- 8. PROCESS DETAILS MODAL ---

const ProcessDetailsModal = ({ process, onClose, user, onUpdateStatus, onUpdateData, draftState, onGenerateDraft, onDeleteTask, onAuditLog, onRefresh }) => {

  const [currentStatus, setCurrentStatus] = useState(process.status_manual || process.status || 'pendente');

  const [relato, setRelato] = useState('');

  const [sugestao, setSugestao] = useState('');

  const [acao, setAcao] = useState('');

  const [printFile, setPrintFile] = useState(null);

  const [saving, setSaving] = useState(false);

  const [formError, setFormError] = useState('');
  const [timelineError, setTimelineError] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [expandedTimelineItems, setExpandedTimelineItems] = useState([]);

  const [loadingData, setLoadingData] = useState(true);

  const [taskHistory, setTaskHistory] = useState([]);



  // Estados do Chat

  const [activeTab, setActiveTab] = useState('resumo');

  const [chatMessages, setChatMessages] = useState([]);

  const [chatInput, setChatInput] = useState('');

  const [isChatLoading, setIsChatLoading] = useState(false);

  const [expandedMessages, setExpandedMessages] = useState({});

  const chatEndRef = useRef(null);

  const formRef = useRef(null);
  const timelineRef = useRef(null);
  const relatoRef = useRef(null);

  const actorDetails = {
    actor_name: user?.user_metadata?.full_name || user?.email || 'User',
    actor_email: user?.email || null
  };



  const [isEditing, setIsEditing] = useState(false);

  const [editForm, setEditForm] = useState({

    numero_cnj: process.numero_cnj,

    cliente_nome: process.cliente_nome,

    tribunal: process.tribunal,

    estado_uf: process.estado_uf,

    data_prazo_final: process.data_prazo_final || '' 

  });



  const latestDraftFromHistory = taskHistory.find(t => t.status_tarefa === 'minuta');

  const displayText = draftState.text || (latestDraftFromHistory ? latestDraftFromHistory.acao_feita : '');

  const showAiPanel = draftState.loading || (displayText && displayText.length > 0);

  const riskBadgeClass = getRiskColor(process.risco || '');



  useEffect(() => {

    const loadTasks = async () => {

      setLoadingData(true);
      setTimelineError('');

      try {

        const { data } = await supabase.from('tarefas').select('*').eq('processo_id', process.id).order('created_at', { ascending: false });

        if (data) { setTaskHistory(data); if (data.length > 0 && data[0].status_tarefa !== 'minuta') setCurrentStatus(data[0].status_tarefa || 'pendente'); }

      } catch (error) { console.error('Erro:', error); setTimelineError('Não foi possível carregar as movimentações.'); } finally { setLoadingData(false); }

    };

    if (process?.id) loadTasks();

  }, [process, draftState.text]); 



  // Reset do Chat ao abrir outro processo

  useEffect(() => {

    setActiveTab('resumo');

    setChatMessages([]);

    setChatInput('');

    setIsChatLoading(false);

    setExpandedMessages({});

  }, [process]);



  useEffect(() => {

    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  }, [chatMessages, isChatLoading]);



  const handleSaveEdit = async () => {

    try {

      const payload = {
        ...editForm,
        data_prazo_final: editForm.data_prazo_final ? editForm.data_prazo_final : null
      };

      const { error } = await supabase.from('processos').update(payload).eq('id', process.id);

      if (error) throw error;

      const before = Object.keys(payload).reduce((acc, key) => {
        acc[key] = process?.[key];
        return acc;
      }, {});
      const newLog = await logAction(user?.id, 'UPDATE_PROCESS', process.id, {
        resource: 'processos',
        cnj: process.numero_cnj,
        before,
        after: payload,
        ...actorDetails
      });
      onAuditLog?.(newLog);

      toast.success("Dados atualizados!");

      setIsEditing(false);

      onUpdateData(process.id, payload);

    } catch (error) {

      toast.error("Erro ao atualizar: " + error.message);

    }

  };



  const minRelatoLength = 10;
  const maxRelatoLength = 2000;
  const maxOptionalLength = 1000;

  const relatoLength = relato.length;
  const sugestaoLength = sugestao.length;
  const acaoLength = acao.length;

  const isRelatoValid = relato.trim().length >= minRelatoLength;
  const isFormValid = isRelatoValid;

  const resetForm = () => {
    setRelato('');
    setSugestao('');
    setAcao('');
    setPrintFile(null);
    setFormError('');
  };

  const handleSaveTask = async () => {
    setFormError('');
    if (!isFormValid) {
      setFormError(`Relato é obrigatório (mín. ${minRelatoLength} caracteres).`);
      return;
    }

    setSaving(true);

    try {

      let printUrl = null;

      if (printFile) {

        const fileExt = printFile.name.split('.').pop();

        const fileName = `${Date.now()}_${process.numero_cnj}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from('comprovantes').upload(fileName, printFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('comprovantes').getPublicUrl(fileName);

        printUrl = publicUrl;

      }

      const { error: dbError } = await supabase.from('tarefas').insert({ processo_id: process.id, user_id: user.id, relato, sugestao, acao_feita: acao, print_url: printUrl, status_tarefa: currentStatus });

      if (dbError) throw dbError;

      const { error: processError } = await supabase.from('processos').update({ status_manual: currentStatus }).eq('id', process.id);

      if (processError) throw processError;

      const newLog = await logAction(user?.id, 'UPDATE_STATUS', process.id, {
        resource: 'processos',
        cnj: process.numero_cnj,
        before: { status_manual: process.status_manual },
        after: { status_manual: currentStatus },
        ...actorDetails
      });
      onAuditLog?.(newLog);

      toast.success('Movimentação salva!');

      resetForm();

      onUpdateStatus(process.id, currentStatus);

      onClose();

    } catch (error) {
      toast.error('Erro: ' + error.message);
      setFormError('Não foi possível salvar. Tente novamente.');
    } finally { setSaving(false); }

  };

  const handleCloseRequest = () => {
    const isDirty = relato.trim() || sugestao.trim() || acao.trim() || printFile;
    if (isDirty && !saving) {
      const confirmClose = window.confirm('Descartar alterações?');
      if (!confirmClose) return;
    }
    onClose();
  };

  const handleRelatoInput = (event) => {
    setRelato(event.target.value.slice(0, maxRelatoLength));
    if (relatoRef.current) {
      relatoRef.current.style.height = 'auto';
      relatoRef.current.style.height = `${Math.min(relatoRef.current.scrollHeight, 240)}px`;
    }
  };

  const handleOptionalInput = (setter) => (event) => {
    setter(event.target.value.slice(0, maxOptionalLength));
  };

  const handleFile = (file) => {
    if (!file) return;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const maxSize = 10 * 1024 * 1024;
    if (!allowed.includes(file.type)) {
      toast.error('Arquivo inválido. Envie PDF ou imagem.');
      return;
    }
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande. Máx. 10MB.');
      return;
    }
    setPrintFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDraggingFile(false);
    const file = event.dataTransfer.files?.[0];
    handleFile(file);
  };

  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      if (!saving && isFormValid) handleSaveTask();
    }
  };



  const handleSendChat = async () => {

    if (!chatInput.trim()) return toast.warning('Digite uma pergunta.');

    const question = chatInput.trim();

    setChatMessages(prev => [...prev, { role: 'user', content: question }]);

    setChatInput('');

    setIsChatLoading(true);



    try {

      // Compilar contexto do processo para enviar ao n8n
      const processContext = {
        question,
        processo_id: process.id,
        numero_cnj: process.numero_cnj,
        cliente_nome: process.cliente_nome,
        tribunal: process.tribunal,
        estado_uf: process.estado_uf,
        risco: process.risco || '',
        analise_risco: process.analise_risco || '',
        prazo_ia: process.prazo_ia || '',
        data_prazo_final: process.data_prazo_final || '',
        status_manual: process.status_manual || '',
        texto_resumo: process.texto_resumo || '',
        // Histórico das últimas 3 movimentações
        historico_recente: taskHistory.slice(0, 3).map(t => ({
          status: t.status_tarefa,
          relato: t.relato,
          data: t.created_at
        })),
        // Todas as outras movimentações importadas
        outras_movimentacoes: process.history ? process.history.slice(1, 4).map(h => h.texto_resumo) : []
      };

      const response = await fetch(API_CHAT_URL, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(processContext)

      });

      

      if (!response.ok) throw new Error('Falha na API do chat');

      

      const data = await response.json();

      const answer = data?.answer || data?.resposta || data?.output || data?.message || (typeof data === 'string' ? data : 'Não encontrei uma resposta no processo.');

      

      setChatMessages(prev => [...prev, { role: 'assistant', content: answer }]);

    } catch (error) {

      console.error(error);

      toast.error('Erro no chat: ' + error.message);

      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Não foi possível obter uma resposta agora. Verifique se o n8n está respondendo.' }]);

    } finally {

      setIsChatLoading(false);

    }

  };

  const toggleExpandedMessage = (index) => {
    setExpandedMessages((prev) => ({ ...prev, [index]: !prev[index] }));
  };



  const copyToClipboard = () => {

    navigator.clipboard.writeText(displayText);

    toast.success("Minuta copiada!");

  };



  const handleDownloadDocx = async () => {

    if (!displayText) return toast.warning("Não há texto para baixar.");



    try {

      const paragraphs = displayText.split('\n').map((line) => {

        return new Paragraph({

          alignment: AlignmentType.JUSTIFIED, 

          spacing: { after: 200, line: 360 }, 

          children: [new TextRun({ text: line, font: "Arial", size: 24 })],

        });

      });



      const doc = new Document({

        sections: [

          {

            properties: {},

            headers: {

              default: new DocHeader({

                children: [

                  new Paragraph({ text: "JVB ADVOCACIA & CONSULTORIA", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),

                  new Paragraph({ text: `Processo nº ${process.numero_cnj} | Cliente: ${process.cliente_nome}`, alignment: AlignmentType.CENTER, spacing: { after: 500 } }),

                ],

              }),

            },

            children: [

              new Paragraph({ text: "MINUTA DE RESPOSTA PROCESSUAL", heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),

              ...paragraphs,

            ],

            footers: {

              default: new DocFooter({

                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Documento gerado automaticamente pelo Painel JVB - Revisão necessária.", italics: true, size: 16, font: "Arial" })] })],

              }),

            },

          },

        ],

      });



      const blob = await Packer.toBlob(doc);

      saveAs(blob, `Minuta_${process.cliente_nome.replace(/\s+/g, '_')}.docx`);

      toast.success("Documento Word baixado com sucesso!");

    } catch (error) {

      console.error(error);

      toast.error("Erro ao gerar documento Word.");

    }

  };



  const handleDelete = async (taskId) => {

      if(window.confirm("Tem certeza que deseja excluir este item?")) {

          await onDeleteTask(taskId);

          setTaskHistory(prev => prev.filter(t => t.id !== taskId));

      }

  }



  const dataFormatada = process.data_andamento ? new Date(process.data_andamento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-';

  const handleCopyCnj = async () => {
    const cnj = editForm.numero_cnj || process.numero_cnj || '';
    if (!cnj) return;
    try {
      await navigator.clipboard.writeText(cnj);
      toast.success('CNJ copiado.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível copiar o CNJ.');
    }
  };

  const latestResumo = process.texto_resumo || '';
  const hasPrazo = !!(process.prazo_ia || process.data_prazo_final);
  const prazoDisplay = process.data_prazo_final
    ? new Date(process.data_prazo_final).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    : (process.prazo_ia || 'Sem prazo registrado');

  const timelineItems = useMemo(() => {
    const systemHistory = Array.isArray(process.history) && process.history.length
      ? process.history.map((hist, idx) => ({
          id: `sys-${idx}`,
          type: 'system',
          date: hist.data_andamento || process.data_andamento,
          resumo: hist.texto_resumo,
          status: 'Sistema'
        }))
      : (latestResumo ? [{
          id: 'sys-0',
          type: 'system',
          date: process.data_andamento,
          resumo: latestResumo,
          status: 'Sistema'
        }] : []);

    const manualHistory = taskHistory.map(task => ({
      id: `manual-${task.id}`,
      type: 'manual',
      date: task.created_at,
      resumo: task.relato || task.acao_feita || task.sugestao || '',
      status: task.status_tarefa || 'Manual',
      raw: task
    }));

    const all = [...manualHistory, ...systemHistory].filter(item => item.date);
    return all.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [taskHistory, process.history, process.data_andamento, latestResumo]);

  const filteredTimelineItems = useMemo(() => {
    if (timelineFilter === 'manual') return timelineItems.filter(i => i.type === 'manual');
    if (timelineFilter === 'pending') return timelineItems.filter(i => i.type === 'manual' && !isTaskCompleted(i.raw));
    if (timelineFilter === 'done') return timelineItems.filter(i => i.type === 'manual' && isTaskCompleted(i.raw));
    return timelineItems;
  }, [timelineItems, timelineFilter]);

  const groupedTimeline = useMemo(() => {
    const groups = {};
    filteredTimelineItems.forEach(item => {
      const date = new Date(item.date);
      const key = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups);
  }, [filteredTimelineItems]);

   

  return (

    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={handleCloseRequest}>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-fade-in flex flex-col border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-20">

          <div>

            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center">

              <Briefcase className="w-5 h-5 mr-2 text-blue-500"/> Detalhes do Processo

              {!isEditing ? (

                 <button onClick={() => setIsEditing(true)} className="ml-3 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar Dados"><Pencil className="w-4 h-4" /></button>

              ) : (

                <div className="flex items-center ml-3 gap-1">

                   <button onClick={handleSaveEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Salvar"><Check className="w-4 h-4" /></button>

                   <button onClick={() => setIsEditing(false)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Cancelar"><X className="w-4 h-4" /></button>

                </div>

              )}

            </h2>

            {isEditing ? (

               <div className="flex gap-2 mt-2">

                   <input type="text" value={editForm.numero_cnj} onChange={e => setEditForm({...editForm, numero_cnj: e.target.value})} className="text-sm bg-gray-50 border border-gray-300 rounded px-2 py-1 w-full max-w-xs dark:bg-gray-900 dark:border-gray-600 dark:text-white" />

               </div>

            ) : (

               <div className="mt-2 flex items-center gap-2">
                 <p className="text-sm text-gray-500 font-mono">{editForm.numero_cnj}</p>
                 <button
                   type="button"
                   onClick={handleCopyCnj}
                   className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                   title="Copiar CNJ"
                 >
                   <Copy className="w-4 h-4" />
                 </button>
               </div>

            )}

            {!isEditing && (
              <p className="text-xs text-gray-500 mt-1">
                <span className="font-medium text-gray-700 dark:text-gray-300">{editForm.cliente_nome || 'Não informado'}</span>
                {' '}· {editForm.tribunal || '-'} / {editForm.estado_uf || '-'}
              </p>
            )}

          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('resumo');
                setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
              }}
              className="px-3 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Adicionar movimentação
            </button>
            <button
              type="button"
              onClick={() => onRefresh?.()}
              className="px-3 py-2 text-sm font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Atualizar dados
            </button>
            <button onClick={handleCloseRequest} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 transition-colors"><X className="w-6 h-6" /></button>
          </div>

        </div>



        {/* NAVEGAÇÃO DE ABAS */}

        <div className="px-8 pb-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-[72px] z-10">

          <div className="flex gap-2">

            <button onClick={() => setActiveTab('resumo')} className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${activeTab === 'resumo' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}>Visão Geral</button>

            <button onClick={() => setActiveTab('chat')} className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors flex items-center gap-2 ${activeTab === 'chat' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}><Send className="w-4 h-4" /> Chat com Processo</button>

          </div>

        </div>



        {activeTab === 'resumo' ? (

        <div className="flex flex-col md:flex-row h-full">

          <div className="w-full md:w-1/2 p-8 space-y-6 border-r border-gray-100 dark:border-gray-700">

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase">Último andamento</div>
                  <Clock className="w-4 h-4 text-blue-400" />
                </div>
                <div className="mt-2 text-lg font-semibold text-gray-800 dark:text-gray-100">{dataFormatada}</div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{latestResumo || 'Sem resumo do sistema.'}</p>
                <button
                  type="button"
                  onClick={() => timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Ver na linha do tempo
                </button>
              </div>
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase">Risco</div>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="mt-2 inline-flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${riskBadgeClass || 'bg-gray-100 text-gray-600'}`}>{process.risco || 'Sem risco'}</span>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{process.analise_risco || 'Sem análise disponível.'}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase">Prazo</div>
                  <CalendarClock className="w-4 h-4 text-purple-400" />
                </div>
                <div className="mt-2 text-lg font-semibold text-gray-800 dark:text-gray-100">{hasPrazo ? prazoDisplay : 'Sem prazo registrado'}</div>
                <p className="mt-1 text-xs text-gray-500">{hasPrazo ? 'Prazo em acompanhamento' : 'Nenhum prazo definido'}</p>
              </div>
            </div>

            {/* CARD DE RISCO (NOVO) */}

            {process.risco && (

              <div className={`p-4 rounded-xl shadow-sm ${riskBadgeClass}`}>

                <div className="flex items-start gap-3">

                  <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />

                  <div>

                    <p className="text-xs font-bold uppercase tracking-wide">Risco (IA)</p>

                    <p className="text-sm font-semibold">{process.risco}</p>

                    {process.analise_risco && <p className="text-sm mt-1 text-gray-800 dark:text-gray-100">{process.analise_risco}</p>}

                  </div>

                </div>

              </div>

            )}

            

            <div className={`border p-4 rounded-xl flex flex-col gap-2 animate-fade-in ${process.prazo_ia ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700'}`}>

                <div className="flex items-start gap-3">

                    <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${process.prazo_ia ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`} />

                    <div>

                        <h4 className={`text-sm font-bold ${process.prazo_ia ? 'text-red-800 dark:text-red-200' : 'text-gray-700 dark:text-gray-300'}`}>{process.prazo_ia ? 'Atenção: Prazo Detectado' : 'Controle de Prazos'}</h4>

                        {process.prazo_ia && <p className="text-xs text-red-700 dark:text-red-300 mt-1 mb-2">{process.prazo_ia}</p>}

                        <div className="flex items-center gap-2 mt-2">

                            <span className="text-xs text-gray-500">Vencimento:</span>

                            {isEditing ? (

                                <input type="date" value={editForm.data_prazo_final} onChange={e => setEditForm({...editForm, data_prazo_final: e.target.value})} className="text-xs p-1 rounded border border-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:text-white" />

                            ) : (

                                <span className={`text-xs font-bold px-2 py-1 rounded ${editForm.data_prazo_final ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'}`}>

                                    {editForm.data_prazo_final ? new Date(editForm.data_prazo_final).toLocaleDateString('pt-BR', {timeZone:'UTC'}) : 'Não definido'}

                                </span>

                            )}

                        </div>

                    </div>

                </div>

            </div>



            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">

              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Definir Status</label>

              <div className="flex flex-wrap gap-2">{['pendente', 'analisado', 'frustrada'].map((status) => (<button key={status} onClick={() => setCurrentStatus(status)} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${currentStatus === status ? (status === 'pendente' ? 'bg-yellow-50 border-yellow-400 text-yellow-700' : status === 'analisado' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-400 text-red-700') : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 bg-white dark:bg-gray-800'}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</button>))}</div>

            </div>

            

            <div>

              <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-2">Partes / Cliente</h3>

              {isEditing ? (

                 <input type="text" value={editForm.cliente_nome} onChange={e => setEditForm({...editForm, cliente_nome: e.target.value})} className="w-full text-sm bg-gray-50 border border-gray-300 rounded px-3 py-2 dark:bg-gray-900 dark:border-gray-600 dark:text-white mb-2" />

              ) : (

                 <p className="text-gray-600 dark:text-gray-300 text-sm">{editForm.cliente_nome}</p>

              )}

              <div className="flex mt-2 gap-2">

                 {isEditing ? (

                   <>

                    <input type="text" placeholder="Tribunal" value={editForm.tribunal} onChange={e => setEditForm({...editForm, tribunal: e.target.value})} className="text-xs bg-gray-50 border border-gray-300 rounded px-2 py-1 w-24 dark:bg-gray-900 dark:border-gray-600 dark:text-white" />

                    <input type="text" placeholder="UF" value={editForm.estado_uf} onChange={e => setEditForm({...editForm, estado_uf: e.target.value})} className="text-xs bg-gray-50 border border-gray-300 rounded px-2 py-1 w-16 dark:bg-gray-900 dark:border-gray-600 dark:text-white" />

                   </>

                 ) : (

                   <>

                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold px-2 py-1 rounded">{editForm.tribunal}</span>

                    <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold px-2 py-1 rounded">{editForm.estado_uf}</span>

                   </>

                 )}

              </div>

            </div>
            <div ref={formRef} className="pt-2 border-t border-gray-100 dark:border-gray-700" onKeyDown={handleKeyDown}>

              <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-3 flex items-center"><Plus className="w-4 h-4 mr-1"/> Nova Movimentação Manual</h3>

              <div className="space-y-4">

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Relato do que aconteceu</label>
                  <textarea
                    ref={relatoRef}
                    rows={3}
                    value={relato}
                    onChange={handleRelatoInput}
                    className={`w-full bg-white dark:bg-gray-900 border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200 ${isRelatoValid ? 'border-gray-300 dark:border-gray-600' : 'border-red-300'}`}
                    placeholder="Descreva o andamento..."
                  />
                  <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                    <span>{relatoLength}/{maxRelatoLength}</span>
                    {!isRelatoValid && <span className="text-red-500">Mínimo {minRelatoLength} caracteres.</span>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Sugestão</label>
                    <input
                      type="text"
                      value={sugestao}
                      onChange={handleOptionalInput(setSugestao)}
                      className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200"
                      placeholder="Opcional"
                    />
                    {sugestao && !acao && <p className="text-[11px] text-gray-400 mt-1">Opcional, mas recomendado preencher “Ação tomada”.</p>}
                    <p className="text-[11px] text-gray-400 mt-1">{sugestaoLength}/{maxOptionalLength}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Ação tomada</label>
                    <input
                      type="text"
                      value={acao}
                      onChange={handleOptionalInput(setAcao)}
                      className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200"
                      placeholder="Opcional"
                    />
                    {acao && !sugestao && <p className="text-[11px] text-gray-400 mt-1">Opcional, mas recomendado preencher “Sugestão”.</p>}
                    <p className="text-[11px] text-gray-400 mt-1">{acaoLength}/{maxOptionalLength}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">Anexar comprovante</label>
                  <div
                    className={`relative border border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-xs transition-colors ${isDraggingFile ? 'border-blue-400 bg-blue-50' : 'border-gray-300 dark:border-gray-600'} text-gray-400`}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={handleDrop}
                  >
                    <input type="file" accept="image/*,.pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleFile(e.target.files[0])} />
                    <UploadCloud className="w-4 h-4 mb-2" />
                    <span>Arraste e solte ou clique para selecionar (PDF ou imagem até 10MB)</span>
                  </div>
                  {printFile && (
                    <div className="mt-2 flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                      <span className="text-gray-600 dark:text-gray-300">{printFile.name} • {(printFile.size / 1024 / 1024).toFixed(1)}MB</span>
                      <button type="button" onClick={() => setPrintFile(null)} className="text-red-500 hover:underline">Remover</button>
                    </div>
                  )}
                </div>

                {formError && <p className="text-xs text-red-500">{formError}</p>}

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveTask}
                    disabled={saving || !isFormValid}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                </div>

              </div>

            </div>

          </div>



          <div ref={timelineRef} className="w-full md:w-1/2 bg-gray-50 dark:bg-gray-900/50 p-8 overflow-y-auto custom-scrollbar">

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center"><Clock className="w-4 h-4 mr-2"/> Linha do Tempo</h3>
              <div className="flex items-center gap-2">
                {[
                  { key: 'all', label: 'Todos' },
                  { key: 'pending', label: 'Pendentes' },
                  { key: 'done', label: 'Concluídos' },
                  { key: 'manual', label: 'Manuais' }
                ].map(filter => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setTimelineFilter(filter.key)}
                    className={`text-xs px-2 py-1 rounded-full border ${timelineFilter === filter.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-200 dark:border-gray-700'}`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {timelineError && (
              <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">{timelineError}</div>
            )}

            {loadingData ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-white/70 dark:bg-gray-800/40 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : groupedTimeline.length === 0 ? (
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white text-sm text-gray-500">
                Nenhuma movimentação encontrada.
                <button
                  type="button"
                  onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="ml-2 text-blue-600 font-semibold"
                >
                  Adicionar manualmente
                </button>
              </div>
            ) : (
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-3.5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
                {groupedTimeline.map(([label, items]) => (
                  <div key={label} className="space-y-4">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide pl-10">{label}</div>
                    {items.map((item) => {
                      const isExpanded = expandedTimelineItems.includes(item.id);
                      const resumo = item.resumo || 'Sem descrição.';
                      const shortResumo = resumo.length > 140 ? `${resumo.slice(0, 140)}...` : resumo;
                      const showExpand = resumo.length > 140;

                      return (
                        <div key={item.id} className="relative pl-10 group">
                          <div className={`absolute left-0 top-1 flex items-center justify-center w-7 h-7 rounded-full border-2 ${item.type === 'system' ? 'border-white dark:border-gray-800 bg-gray-400 text-white' : 'border-white dark:border-gray-800 bg-blue-500 text-white'} shadow z-10`}>
                            {item.type === 'system' ? <Bot className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                          </div>
                          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                {item.status || 'Sistema'}
                              </span>
                              <span className="text-xs text-gray-400">{new Date(item.date).toLocaleDateString('pt-BR')}</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {isExpanded ? resumo : shortResumo}
                            </p>
                            {item.type === 'manual' && item.raw?.print_url && (
                              <a
                                href={item.raw.print_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center text-xs text-blue-600 hover:underline mt-2 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded"
                              >
                                <ExternalLink className="w-3 h-3 mr-1"/> Ver anexo
                              </a>
                            )}
                            {showExpand && (
                              <button
                                type="button"
                                onClick={() => setExpandedTimelineItems(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])}
                                className="mt-2 text-xs font-semibold text-blue-600"
                              >
                                {isExpanded ? 'Ver menos' : 'Expandir'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

          </div>

        </div>

        ) : (

          /* ABA DE CHAT (RAG) */

          <div className="flex flex-col p-8 gap-4 h-full">

            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">

              <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{process.numero_cnj}</span>

              {process.risco && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${riskBadgeClass}`}>Risco: {process.risco}</span>}

            </div>

            <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 overflow-y-auto space-y-3 custom-scrollbar">

              {chatMessages.length === 0 && !isChatLoading && (

                <div className="text-sm text-gray-500 dark:text-gray-400 text-center mt-10 space-y-4">

                  <Bot className="w-8 h-8 mx-auto text-gray-300"/>

                  <p className="font-semibold">Assistente Jurídico do Processo</p>

                  <p className="text-xs">Faça perguntas sobre este processo, como:</p>

                  <div className="flex flex-col gap-2 items-start text-left max-w-xs mx-auto">

                    <button onClick={() => setChatInput('O que devo fazer agora neste processo?')} className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">O que devo fazer agora?</button>

                    <button onClick={() => setChatInput('Quando este processo vai vencer?')} className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">Quando vai vencer?</button>

                    <button onClick={() => setChatInput('Qual é o melhor argumento jurisprudencial para este caso?')} className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">Qual jurisprudência usar?</button>

                    <button onClick={() => setChatInput('Qual é o nível de risco deste processo?')} className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">Qual o risco?</button>

                  </div>

                </div>

              )}

              {chatMessages.map((msg, idx) => {
                const isAssistant = msg.role !== 'user';
                const content = msg.content || '';
                const isLong = isAssistant && content.length > 450;
                const isExpanded = !!expandedMessages[idx];
                const displayContent = isLong && !isExpanded ? `${content.slice(0, 450)}...` : content;

                return (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700'}`}>
                      <div className="whitespace-pre-wrap leading-relaxed">{displayContent}</div>
                      {isLong && (
                        <button onClick={() => toggleExpandedMessage(idx)} className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-300 hover:underline">
                          {isExpanded ? 'Ver menos' : 'Ver mais'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {isChatLoading && (

                <div className="flex items-center gap-2 text-xs text-gray-500">

                  <Loader2 className="w-4 h-4 animate-spin" /> IA digitando...

                </div>

              )}

              <div ref={chatEndRef}></div>

            </div>

            <div className="flex gap-3">

              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }} placeholder="Pergunte algo sobre este processo..." className="flex-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />

              <button onClick={handleSendChat} disabled={isChatLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold shadow-sm disabled:opacity-60 transition-colors"><Send className="w-4 h-4" /> Enviar</button>

            </div>

          </div>

        )}

      </div>

    </div>

  );

};



// --- 9. APP PRINCIPAL ---

function App() {

  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState('user'); // 'admin' ou 'user'

  const [selectedProcess, setSelectedProcess] = useState(null);

  const [processes, setProcesses] = useState([]);

  const [loading, setLoading] = useState(true);

  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [isSosOpen, setIsSosOpen] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false); // Estado para o modal de exclusão
  const [isDeleteProcessOpen, setIsDeleteProcessOpen] = useState(false);
  const [processToDelete, setProcessToDelete] = useState(null);
  const [isDeletingProcess, setIsDeletingProcess] = useState(false);

  const [darkMode, setDarkMode] = useState(() => { const saved = localStorage.getItem('theme'); return saved === 'dark'; });

  const [officeSettings, setOfficeSettings] = useState(() => {
    try {
      const raw = localStorage.getItem('office_settings_cache');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Função para buscar o perfil do usuário e criar se não existir
  const fetchUserProfile = useCallback(async (userId, userEmail) => {
    try {
      // Tenta buscar o perfil existente
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error && error.code === 'PGRST116') {
        // Perfil não existe, criar um novo com role padrão 'user'
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: userId, email: userEmail, role: 'user' })
          .select('role')
          .single();
        
        if (insertError) {
          console.error('Erro ao criar perfil:', insertError);
          setUserRole('user');
          return;
        }
        profile = newProfile;
      } else if (error) {
        console.error('Erro ao buscar perfil:', error);
        setUserRole('user');
        return;
      }
      
      setUserRole(profile?.role || 'user');
    } catch (err) {
      console.error('Erro ao carregar perfil:', err);
      setUserRole('user');
    }
  }, []);

  

  // Filtros

  const [filters, setFilters] = useState({ search: '', status: '', uf: '', date: '', risk: '', uploadDate: '' });

  // Persistence of viewMode and currentView
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('app_viewMode') || 'tiles');
  const [isBackgroundProcessing, setIsBackgroundProcessing] = useState(false);
  const [currentView, setCurrentView] = useState(() => localStorage.getItem('app_currentView') || 'dashboard');

  // Persist state changes
  useEffect(() => { localStorage.setItem('app_viewMode', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('app_currentView', currentView); }, [currentView]);

  // Scroll restoration logic
  useEffect(() => {
    const handleScroll = () => {
      // Save scroll position only if not loading
      if (!loading) sessionStorage.setItem('app_scrollPosition', window.scrollY.toString());
    };
    
    // Throttle scroll save ideally, but simple for now
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading]);

  useEffect(() => {
    if (!loading) {
      const savedScroll = sessionStorage.getItem('app_scrollPosition');
      if (savedScroll) {
        // Small timeout to ensure DOM is fully rendered
        setTimeout(() => window.scrollTo(0, parseInt(savedScroll)), 100);
      }
    }
  }, [loading]);

  const [drafts, setDrafts] = useState({}); 



  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setSession(session); 
      if(session?.user) fetchUserProfile(session.user.id, session.user.email);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { 
      setSession(session); 
      if(session?.user) fetchUserProfile(session.user.id, session.user.email);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  useEffect(() => {
    const handler = (e) => {
      try {
        if (e?.detail) setOfficeSettings(e.detail);
      } catch {}
    };
    window.addEventListener('office_settings_updated', handler);
    return () => window.removeEventListener('office_settings_updated', handler);
  }, []);

  useEffect(() => {
    const loadOfficeSettings = async () => {
      if (!session) return;
      try {
        const { data, error } = await supabase
          .from('office_settings')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1);
        if (error) return;
        const next = data?.[0] ? {
          id: 1,
          alert_window_days: data[0].alert_window_days ?? 7,
          risk_high_terms: data[0].risk_high_terms ?? 'alto',
          risk_medium_terms: data[0].risk_medium_terms ?? 'médio,medio',
          template_minuta: data[0].template_minuta ?? ''
        } : null;
        if (next) {
          setOfficeSettings(next);
          try { localStorage.setItem('office_settings_cache', JSON.stringify(next)); } catch {}
        }
      } catch {}
    };
    loadOfficeSettings();
  }, [session]);



  useEffect(() => {

    if (darkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); } 

    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }

  }, [darkMode]);



  const fetchProcesses = useCallback((silent = false) => {

    if (!session) return;

    if (!silent) setLoading(true); 

    const urlSemCache = `${API_GET_URL}?t=${new Date().getTime()}`;

    fetch(urlSemCache)

      .then(response => response.json())

      .then(data => {

        const listaRaw = Array.isArray(data) ? data : (data.data || []);

        





        const agrupadosMap = listaRaw.reduce((acc, item) => {

          const cnj = item.numero_cnj;

          if (!acc[cnj]) { 

              acc[cnj] = { ...item, total_updates: 0, history: [] }; 

          }

          acc[cnj].history.push(item);

          acc[cnj].total_updates += 1;

          

          if (new Date(item.data_andamento) > new Date(acc[cnj].data_andamento)) {

            acc[cnj].texto_resumo = item.texto_resumo;

            acc[cnj].data_andamento = item.data_andamento;

            acc[cnj].prazo_ia = item.prazo_ia; 

            acc[cnj].data_prazo_final = item.data_prazo_final;

            acc[cnj].risco = item.risco || acc[cnj].risco;

            acc[cnj].analise_risco = item.analise_risco || acc[cnj].analise_risco;

          }

          return acc;

        }, {});

        

        const listaUnica = Object.values(agrupadosMap);

        listaUnica.sort((a, b) => {

            const dateA = new Date(a.created_at || a.data_andamento);

            const dateB = new Date(b.created_at || b.data_andamento);

            return dateB - dateA;

        });

        

        setProcesses(listaUnica);

        if (!silent) setLoading(false);

      })

      .catch(error => { console.error("Erro no fetch:", error); if (!silent) setLoading(false); });

  }, [session]);



  useEffect(() => { fetchProcesses(); }, [fetchProcesses]);



  useEffect(() => {

    let interval;

    if (isBackgroundProcessing) {

        interval = setInterval(() => { fetchProcesses(true); }, 10000);

    }

    return () => clearInterval(interval);

  }, [isBackgroundProcessing, fetchProcesses]);



  const handleUpdateProcessStatus = (processId, newStatus) => {

    setProcesses(prev => prev.map(p => p.id === processId ? { ...p, status_manual: newStatus } : p));

  };

  const handleUpdateProcessData = (processId, newData) => {

    setProcesses(prev => prev.map(p => p.id === processId ? { ...p, ...newData } : p));

  };

  const handleFileUpload = (file) => {

    setIsUploadOpen(false);

    toast.success('Upload iniciado! IA processando...');

    setIsBackgroundProcessing(true);

    const formData = new FormData();

    formData.append('file', file);
    if (session?.user?.id) formData.append('user_id', session.user.id);
    formData.append('role', userRole);

    fetch(API_UPLOAD_URL, { method: 'POST', body: formData })

      .then(() => {

          toast.success('Processamento concluído!');

          fetchProcesses(); 

          setIsBackgroundProcessing(false);

      })

      .catch((error) => { console.error('Erro:', error); toast.error('Erro no envio.'); setIsBackgroundProcessing(false); });

  };

  const handleOpenProcessFromAdmin = useCallback((processRef) => {
    if (!processRef) return;
    const match = processes.find(p => p.id === processRef.id || p.numero_cnj === processRef.numero_cnj);
    setSelectedProcess(match || processRef);
  }, [processes]);

  const openDeleteProcess = (process) => {
    setProcessToDelete(process);
    setIsDeleteProcessOpen(true);
  };

  const executeDeleteProcess = async () => {
    if (!processToDelete?.id) return;
    setIsDeletingProcess(true);
    try {
      const processId = processToDelete.id;
      const { error: errorTasks } = await supabase.from('tarefas').delete().eq('processo_id', processId);
      if (errorTasks) throw errorTasks;

      const { error: errorAndamentos } = await supabase.from('andamentos').delete().eq('processo_id', processId);
      if (errorAndamentos) throw errorAndamentos;

      const { error: errorProcess } = await supabase.from('processos').delete().eq('id', processId);
      if (errorProcess) throw errorProcess;

      await logAction(session?.user?.id, 'DELETE_PROCESS', processId, {
        resource: 'processos',
        cnj: processToDelete.numero_cnj,
        actor_name: session?.user?.user_metadata?.full_name || session?.user?.email || 'User',
        actor_email: session?.user?.email || null
      });

      setProcesses(prev => prev.filter(p => p.id !== processId));
      setDrafts(prev => {
        const next = { ...prev };
        delete next[processId];
        return next;
      });
      if (selectedProcess?.id === processId) setSelectedProcess(null);
      toast.success('Processo excluído com sucesso!');
      setIsDeleteProcessOpen(false);
      setProcessToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir processo: ' + error.message);
    } finally {
      setIsDeletingProcess(false);
    }
  };

  // --- Funcao para limpar DB (CORRIGIDA) ---
  const executeClearDatabase = async () => {
    setLoading(true);
    try {
        // 1. Apaga Tarefas (Filhos)
        const { error: errorTasks } = await supabase.from('tarefas').delete().not('id', 'is', null);
        if(errorTasks) throw errorTasks;

        // 2. Apaga Andamentos (Filhos) <--- ESTA PARTE FALTAVA
        const { error: errorAndamentos } = await supabase.from('andamentos').delete().not('id', 'is', null);
        // Não lançamos erro aqui pois pode não haver andamentos, mas logamos se der ruim
        if(errorAndamentos) console.error("Erro ao apagar andamentos:", errorAndamentos);

        // 3. Apaga Processos (Pai) - Agora o banco permite!
        const { error: errorProcess } = await supabase.from('processos').delete().not('id', 'is', null);
        if(errorProcess) throw errorProcess;

        setProcesses([]);
        toast.success("Banco de dados limpo com sucesso!");
        setIsDeleteModalOpen(false);
    } catch (error) {
        console.error(error);
        toast.error("Erro ao limpar banco: " + error.message);
        // Se der erro, recarrega a lista para o usuário ver o que sobrou
        fetchProcesses(true); 
    } finally {
        setLoading(false);
    }
};



  const findTextInObject = (obj) => {

    if (typeof obj === 'string') return obj;

    if (typeof obj === 'object' && obj !== null) {

        if (obj.content) return findTextInObject(obj.content);

        if (obj.text) return findTextInObject(obj.text);

        if (obj.minuta) return findTextInObject(obj.minuta);

        if (obj.message && obj.message.content) return findTextInObject(obj.message.content);

        if (obj.output) return findTextInObject(obj.output);

        for (let key in obj) {

            if (typeof obj[key] === 'string' && obj[key].length > 20) return obj[key];

        }

    }

    return "Não foi possível extrair o texto da resposta.";

  };



  const handleGenerateDraft = async (processId, resumo) => {

    setDrafts(prev => ({ ...prev, [processId]: { loading: true, text: '' } }));

    toast.info("IA iniciou a redação da minuta...");

    try {

      const response = await fetch(API_DRAFTER_URL, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ texto_resumo: resumo, template_minuta: officeSettings?.template_minuta || '' })

      });

      const data = await response.json();

      const finalText = findTextInObject(data);

      const { error } = await supabase.from('tarefas').insert({

          processo_id: processId, user_id: session.user.id, relato: 'Minuta IA', acao_feita: finalText, status_tarefa: 'minuta' 

      });

      if (error) throw error;

      setDrafts(prev => ({ ...prev, [processId]: { loading: false, text: finalText } }));

      toast.success(`Minuta pronta!`);

    } catch (error) {

      console.error(error);

      setDrafts(prev => ({ ...prev, [processId]: { loading: false, text: "Erro na geração." } }));

      toast.error("Erro ao gerar minuta.");

    }

  };

  const handleDeleteTask = async (taskId) => {

      if(window.confirm("Tem certeza que deseja excluir este item?")) {

          try {

              const { error } = await supabase.from('tarefas').delete().eq('id', taskId);

              if (error) throw error;

              toast.success("Item removido.");

          } catch (error) { console.error(error); toast.error("Erro ao excluir."); }

      }

  };



  // --- LÓGICA DE FILTROS ---

  

  const uniqueUFs = useMemo(() => [...new Set(processes.map(p => p.estado_uf))].sort(), [processes]);

  const uniqueRisks = useMemo(() => [...new Set(processes.map(p => p.risco).filter(Boolean))].sort(), [processes]);



  // Data do Andamento

  const uniqueDates = useMemo(() => [...new Set(processes.map(p => { 

      const raw = p.data_andamento; 

      if (!raw) return null;

      try { return raw.includes('T') ? raw.split('T')[0] : raw; } catch(error) { console.error(error); return null; }

  }))].filter(Boolean).sort().reverse(), [processes]);

  

  // Data de Upload (created_at) - COM FALLBACK

  const uniqueUploadDates = useMemo(() => {

    const dates = processes.map(p => {

        const raw = p.created_at || p.data_andamento; 

        if (!raw) return null;

        try {

            return raw.includes('T') ? raw.split('T')[0] : raw;

        } catch (error) {

            console.error(error);

            return null;

        }

    });

    return [...new Set(dates)].filter(Boolean).sort().reverse();

  }, [processes]);



  // Filtragem Principal

  const filteredProcesses = useMemo(() => {

    return processes.filter(p => {
      // 1. Permissões de Visualização (Admin vs User)
      const isOwner = session?.user?.id && (p.responsavel_id === session.user.id);
      // Assumir aprovado se null (legado)
      const isApproved = (p.status_aprovacao === 'approved') || (!p.status_aprovacao); 
      
      if (userRole !== 'admin') {
          // Usuário vê apenas aprovados OU seus (mesmo pendentes)
          if (!isApproved && !isOwner) return false;
      }

      const searchMatch = p.cliente_nome?.toLowerCase().includes(filters.search.toLowerCase()) || p.numero_cnj?.includes(filters.search);

      const currentStatus = p.status_manual || p.status || 'pendente';

      let statusMatch = true;
      if (filters.status === 'aguardando_aprovacao') {
          statusMatch = p.status_aprovacao === 'pending';
      } else if (filters.status) {
          statusMatch = currentStatus.toLowerCase() === filters.status;
      }

      const ufMatch = filters.uf ? p.estado_uf === filters.uf : true;

      const riskMatch = filters.risk ? (p.risco && p.risco === filters.risk) : true;

      

      // Data Andamento

      let dateMatch = true;

      if (filters.date) {

         const pDate = p.data_andamento ? (p.data_andamento.includes('T') ? p.data_andamento.split('T')[0] : p.data_andamento) : '';

         dateMatch = pDate === filters.date;

      }



      // Data Upload

      let uploadMatch = true;

      if (filters.uploadDate) {

         const rawUpload = p.created_at || p.data_andamento;

         const uDate = rawUpload ? (rawUpload.includes('T') ? rawUpload.split('T')[0] : rawUpload) : '';

         uploadMatch = uDate === filters.uploadDate;

      }



      return searchMatch && statusMatch && ufMatch && dateMatch && riskMatch && uploadMatch;

    });

  }, [processes, filters, userRole, session]);



  // --- DEFINIÇÃO DO COMPONENTE UFGROUP (AGORA DENTRO DO ESCOPO CORRETO) ---

  const UFGroup = ({ uf, processes, onProcessClick, drafts, onDeleteProcess, viewMode, userRole }) => {

    const [isExpanded, setIsExpanded] = useState(true);
    const gridClass = viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

    return (

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors overflow-hidden">

        <button onClick={() => setIsExpanded(!isExpanded)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">

          <div className="flex items-center space-x-3">

            <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-bold px-3 py-1.5 rounded-lg">{uf}</div>

            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{processes.length} Processo{processes.length !== 1 ? 's' : ''}</h3>

          </div>

          <ChevronDown className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`} />

        </button>

        <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[5000px]' : 'max-h-0'}`}>

          <div className={`p-6 pt-0 grid ${gridClass} gap-4`}>

            {processes.map((p) => (
              <ProcessCard
                key={p.numero_cnj}
                process={p}
                onClick={() => onProcessClick(p)}
                hasDraft={drafts[p.id]?.text}
                isDraftLoading={drafts[p.id]?.loading}
                onDelete={onDeleteProcess}
                userRole={userRole}
              />
            ))}

          </div>

        </div>

      </div>

    );

  };



  // Funções de exportação que usam filteredProcesses

  const exportToExcel = () => {

    const dataToExport = filteredProcesses.map(p => ({

      'CNJ': p.numero_cnj,

      'Cliente': p.cliente_nome,

      'Tribunal': p.tribunal,

      'UF': p.estado_uf,

      'Status': (p.status_manual || p.status || 'pendente').toUpperCase(),

      'Risco': p.risco || '-',

      'Data Andamento': formatDateDisplay(p.data_andamento),

      'Data Upload': formatDateDisplay(p.created_at || p.data_andamento),

      'Último Resumo': p.texto_resumo

    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Processos");

    XLSX.writeFile(workbook, `Relatorio_JVB_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);

    toast.success("Relatório Excel gerado!");

  };



  const exportToPDF = () => {

    try {

      const doc = new jsPDF();

      doc.text(`Relatório de Processos - JVB`, 14, 15);

      doc.setFontSize(10);

      doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 14, 20);

      doc.text(`Filtros: Status: ${filters.status || 'Todos'} | UF: ${filters.uf || 'Todos'}`, 14, 25);



      const tableColumn = ["CNJ", "Cliente", "UF", "Status", "Risco", "Data Andamento", "Data Upload"];

      const tableRows = [];



      filteredProcesses.forEach(process => {

        const processData = [

          process.numero_cnj,

          process.cliente_nome,

          process.estado_uf,

          (process.status_manual || process.status || 'pendente').toUpperCase(),

          process.risco || '-',

          formatDateDisplay(process.data_andamento),

          formatDateDisplay(process.created_at || process.data_andamento)

        ];

        tableRows.push(processData);

      });



      autoTable(doc, {

        head: [tableColumn],

        body: tableRows,

        startY: 30,

        styles: { fontSize: 8 },

        headStyles: { fillColor: [41, 128, 185] }

      });



      doc.save(`Relatorio_JVB_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);

      toast.success("Relatório PDF gerado!");

    } catch (error) {

      console.error(error);

      toast.error("Erro ao gerar PDF. Verifique o console.");

    }

  };



  // --- DEFINIÇÃO DE processesByUF (AGORA DENTRO DO ESCOPO CORRETO) ---

  const processesByUF = filteredProcesses.reduce((acc, p) => { 

    const uf = p.estado_uf || 'Outros';

    if (!acc[uf]) acc[uf] = [];

    acc[uf].push(p); 

    return acc; 

  }, {});



  if (!session) return <><Toaster position="top-center" richColors closeButton /><LoginPage /></>;



  return (

    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 font-sans flex flex-col transition-colors duration-200">

      <Toaster position="top-right" richColors closeButton />

      <Header 

        onAddClick={() => setIsUploadOpen(true)} 

        onRefresh={() => fetchProcesses(false)} 

        loading={loading} 

        darkMode={darkMode} 

        toggleDarkMode={() => setDarkMode(!darkMode)} 

        user={session.user} 

        onOpenProfile={() => setIsProfileOpen(true)} 

        isProcessing={isBackgroundProcessing} 

        currentView={currentView} 

        setView={setCurrentView}

        onClearDatabase={() => setIsDeleteModalOpen(true)}

        userRole={userRole}

      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">

        {currentView === 'agenda' ? (

            <AgendaView processes={processes} onProcessClick={(p) => setSelectedProcess(p)} onUpdateData={handleUpdateProcessData} />

        ) : currentView === 'admin' ? (
            <AdminDashboard
              onBack={() => setCurrentView('dashboard')}
              session={session}
              onOpenProcess={handleOpenProcessFromAdmin}
            />
        ) : (

            <>

                <StatsBar processes={filteredProcesses} />

                

                {/* FilterBar LIMPA (sem props extras) */}

                <FilterBar 

                  filters={filters} 

                  setFilters={setFilters} 

                  uniqueUFs={uniqueUFs} 

                  uniqueDates={uniqueDates} 

                  uniqueRisks={uniqueRisks}

                  uniqueUploadDates={uniqueUploadDates} 

                  onExportExcel={exportToExcel} 

                  onExportPDF={exportToPDF} 

                  viewMode={viewMode}

                  setViewMode={setViewMode}

                  userRole={userRole}

                />

                

                <div className="mb-6 flex items-center justify-between">
                  <p className="text-gray-600 dark:text-gray-400">Visualizando <strong>{filteredProcesses.length}</strong> processos encontrados.</p>
                  {loading && <div className="flex items-center text-blue-600 dark:text-blue-400"><Loader2 className="w-5 h-5 animate-spin mr-2"/> Carregando dados...</div>}
                </div>

                {!loading && filteredProcesses.length === 0 && (
                  <div className="text-center py-16 bg-white/90 dark:bg-gray-800/90 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                    <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-300 mb-4">
                      <Search className="w-6 h-6" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 font-semibold">Nenhum processo encontrado</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ajuste os filtros ou limpe para ver todos os resultados.</p>
                    <button onClick={() => setFilters({search:'', status:'', uf:'', date:'', risk: '', uploadDate:''})} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors">Limpar filtros</button>
                  </div>
                )}

                {viewMode === 'table' ? (
                  <div className="bg-white/90 dark:bg-gray-800/90 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400">
                          <tr>
                            <th className="text-left px-4 py-3 font-semibold">CNJ</th>
                            <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                            <th className="text-left px-4 py-3 font-semibold">Tribunal/UF</th>
                            <th className="text-left px-4 py-3 font-semibold">Risco</th>
                            <th className="text-left px-4 py-3 font-semibold">Status</th>
                            <th className="text-left px-4 py-3 font-semibold">Data Andamento</th>
                            <th className="text-right px-4 py-3 font-semibold">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {filteredProcesses.map((p) => {
                            const statusValue = (p.status_manual || p.status || 'pendente').toLowerCase();
                            const statusClass = statusValue === 'analisado'
                              ? 'bg-green-100 text-green-700'
                              : statusValue === 'frustrada'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700';

                            return (
                              <tr key={p.numero_cnj} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer" onClick={() => setSelectedProcess(p)}>
                                <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-200">{p.numero_cnj}</td>
                                <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{p.cliente_nome || '-'}</td>
                                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.tribunal} - {p.estado_uf}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${getRiskColor(p.risco)}`}>{p.risco || '-'}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusClass}`}>{statusValue}</span>
                                </td>
                                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDateDisplay(p.data_andamento)}</td>
                                <td className="px-4 py-3 text-right">
                                  {userRole === 'admin' && (
                                    <button onClick={(e) => { e.stopPropagation(); openDeleteProcess(p); }} className="text-red-500 hover:text-red-600" title="Excluir">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">

                    {Object.entries(processesByUF)
                      .sort(([ufA], [ufB]) => ufA.localeCompare(ufB))
                      .map(([uf, items]) => (
                        <UFGroup
                          key={uf}
                          uf={uf}
                          processes={items}
                          onProcessClick={setSelectedProcess}
                          drafts={drafts}
                          onDeleteProcess={openDeleteProcess}
                          viewMode={viewMode}
                          userRole={userRole}
                        />
                      ))}

                  </div>
                )}

            </>

        )}

      </main>

      

      <button onClick={() => setIsSosOpen(true)} className="fixed bottom-6 right-6 bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-xl z-40 transition-transform hover:scale-110 flex items-center justify-center group" title="Reportar Problema"><LifeBuoy className="w-6 h-6 group-hover:animate-spin-slow" /></button>



      {selectedProcess && (

        <ProcessDetailsModal process={selectedProcess} onClose={() => setSelectedProcess(null)} user={session.user} onUpdateStatus={handleUpdateProcessStatus} onUpdateData={handleUpdateProcessData} draftState={drafts[selectedProcess.id] || { loading: false, text: '' }} onGenerateDraft={() => handleGenerateDraft(selectedProcess.id, selectedProcess.texto_resumo)} onDeleteTask={handleDeleteTask} onRefresh={() => fetchProcesses(false)} />

      )}

      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUpload={handleFileUpload} />

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={session.user} onUserUpdated={(updatedUser) => setSession(prev => prev ? { ...prev, user: updatedUser } : prev)} />

      <SosModal isOpen={isSosOpen} onClose={() => setIsSosOpen(false)} user={session.user} />

      <ConfirmModal 
        isOpen={isDeleteProcessOpen} 
        onClose={() => { setIsDeleteProcessOpen(false); setProcessToDelete(null); }} 
        onConfirm={executeDeleteProcess} 
        loading={isDeletingProcess}
        title="Excluir este processo?" 
        description={
          processToDelete
            ? `Esta ação removerá permanentemente o processo ${processToDelete.numero_cnj} e seus históricos do banco de dados. Tem certeza?`
            : 'Esta ação removerá permanentemente este processo e seus históricos do banco de dados. Tem certeza?'
        }
        confirmText="Sim, excluir"
        variant="danger"
      />

      <ConfirmModal 

        isOpen={isDeleteModalOpen} 

        onClose={() => setIsDeleteModalOpen(false)} 

        onConfirm={executeClearDatabase} 

        loading={loading}

        title="Apagar TODOS os processos?" 

        description="Esta ação removerá permanentemente todos os processos e seus históricos do banco de dados. Tem certeza absoluta?" 

        confirmText="Sim, apagar tudo"

        variant="danger"

      />

    </div>

  );

}



export default App;