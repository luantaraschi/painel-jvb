import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Toaster, toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// Imports para geração de Word (.docx)
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Header as DocHeader, Footer as DocFooter } from 'docx';
import { saveAs } from 'file-saver';
// Ícones
import { 
  Menu, Bell, Plus, Calendar, Copy, CheckCircle2, AlertCircle,
  FileText, UploadCloud, Save, Loader2, X, Moon, Sun, Filter,
  Search, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, LifeBuoy,
  User as UserIcon, LogOut, FileIcon, Send, Activity, FileDown, FileInput, FileUp, FileCheck2, FileX2,
  RefreshCw, Lock, ExternalLink, Bot, MapPin, Briefcase, Clock, Settings,
  FileSpreadsheet, File, Pencil, Check, Zap, Scale, FileSignature, AlertTriangle, PenTool, Trash2,
  LayoutDashboard, CalendarDays, ChevronsUpDown, ChevronFirst, ChevronLast, ChevronsLeft, ChevronsRight
} from 'lucide-react';

// --- CONFIGURAÇÃO DOS LINKS ---
const API_GET_URL = "https://jvbadvocacia-n8n.cloudfy.live/webhook/processos";
const API_UPLOAD_URL = "https://jvbadvocacia-n8n.cloudfy.live/webhook/upload-pdf";
const API_DRAFTER_URL = "https://jvbadvocacia-n8n.cloudfy.live/webhook/minuta";
const API_SOS_URL = "https://jvbadvocacia-n8n.cloudfy.live/webhook/sos";
// Certifique-se de criar este webhook no n8n (POST)
const API_CHAT_URL = "https://jvbadvocacia-n8n.cloudfy.live/webhook/chat-processo";

// --- HELPER: Cores de Risco ---
const getRiskColor = (riskLevel = '') => {
  const level = riskLevel ? riskLevel.toString().toLowerCase() : '';
  if (level.includes('alto')) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 border border-red-200 dark:border-red-800';
  if (level.includes('médio') || level.includes('medio')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800';
  if (level.includes('baixo')) return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 border border-green-200 dark:border-green-800';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700';
};

// --- 1. COMPONENTE DE LOGIN ---
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error('Erro ao entrar: Verifique suas credenciais.'); setLoading(false); }
    else { toast.success('Bem-vindo ao Painel JVB!'); }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-200">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-3 rounded-xl mb-4 shadow-lg shadow-blue-200"><Lock className="w-8 h-8 text-white" /></div>
          <h1 className="text-2xl font-bold text-gray-800">Painel JVB</h1>
          <p className="text-gray-500 text-sm mt-2">Acesso restrito à equipe jurídica</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" required className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Senha</label><input type="password" required className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-md hover:shadow-lg transition-all flex justify-center items-center">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar no Sistema'}</button>
        </form>
      </div>
    </div>
  );
};

// --- 2. MODAL DE PERFIL ---
const ProfileModal = ({ isOpen, onClose, user, onUserUpdated }) => {
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || '');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setFullName(user?.user_metadata?.full_name || '');
      setAvatarUrl(user?.user_metadata?.avatar_url || '');
      setAvatarPreview('');
      setAvatarFile(null);
      setNewPassword('');
    }
  }, [isOpen, user]);

  useEffect(() => {
    return () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); };
  }, [avatarPreview]);

  if (!isOpen) return null;

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('A imagem deve ter ate 5MB.'); return; }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      let uploadedAvatarUrl = avatarUrl;
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `avatars/${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
        uploadedAvatarUrl = publicUrl;
      }
      const updates = { data: { full_name: fullName, avatar_url: uploadedAvatarUrl } };
      if (newPassword) { updates.password = newPassword; }
      const { data, error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
      if (data?.user && onUserUpdated) onUserUpdated(data.user);
      toast.success('Perfil atualizado com sucesso!');
      onClose();
    } catch (error) { toast.error('Erro ao atualizar: ' + error.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Meu Perfil</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" /></button>
        </div>
        <div className="space-y-4">
          <div className="flex flex-col items-center mb-6 space-y-3">
            <div className="relative">
              {avatarPreview || avatarUrl ? (
                <img src={avatarPreview || avatarUrl} alt="Foto de perfil" className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-md" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-3xl font-bold text-blue-600 dark:text-blue-300 border-4 border-white dark:border-gray-700 shadow-md">
                  {fullName ? fullName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
              )}
              <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow border border-white dark:border-gray-800 transition-colors" title="Enviar foto">
                <UploadCloud className="w-4 h-4" />
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome de Exibição</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Seu nome completo" /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nova Senha (Opcional)</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Deixe em branco para manter a atual" /></div>
          <div className="pt-4"><button onClick={handleSaveProfile} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg flex justify-center items-center transition-colors">{saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Alterações'}</button></div>
        </div>
      </div>
    </div>
  );
};

// --- 2.5 MODAL SOS ---
const SosModal = ({ isOpen, onClose, user }) => {
  const [message, setMessage] = useState('');
  const [type, setType] = useState('bug');
  const [sending, setSending] = useState(false);
  const [screenshots, setScreenshots] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => { screenshots.forEach(screenshot => URL.revokeObjectURL(screenshot.preview)); };
  }, [screenshots]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const newScreenshots = files.map(file => ({ file, preview: URL.createObjectURL(file) }));
    setScreenshots(prev => [...prev, ...newScreenshots].slice(0, 5));
  };

  const removeScreenshot = (index) => {
    setScreenshots(prev => {
      const newScreenshots = [...prev];
      URL.revokeObjectURL(newScreenshots[index].preview);
      newScreenshots.splice(index, 1);
      return newScreenshots;
    });
  };

  const handleSend = async () => {
    if(!message.trim()) return toast.warning("Digite uma mensagem.");
    setSending(true);
    try {
      const screenshotUrls = [];
      for (const screenshot of screenshots) {
        const fileExt = screenshot.file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('screenshots').upload(`bug-reports/${fileName}`, screenshot.file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('screenshots').getPublicUrl(`bug-reports/${fileName}`);
        screenshotUrls.push(publicUrl);
      }
      await supabase.from('chamados_sos').insert({ 
        user_id: user.id, mensagem: message, tipo: type, contato: user.email, screenshots: screenshotUrls
      });
      await fetch(API_SOS_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_email: user.email, mensagem: message, tipo: type, screenshots: screenshotUrls })
      });
      toast.success("Solicitação enviada! Analisaremos em breve.");
      setMessage(''); setScreenshots([]); onClose();
    } catch (error) { console.error(error); toast.error("Erro ao enviar: " + (error.message || 'Tente novamente.')); } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center"><LifeBuoy className="w-5 h-5 mr-2 text-red-500"/> Central de Ajuda (SOS)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo de Relato</label>
            <div className="flex gap-2">
              <button onClick={() => setType('bug')} className={`flex-1 py-2 rounded-lg text-sm border ${type === 'bug' ? 'bg-red-50 border-red-500 text-red-700 dark:bg-red-900/20 dark:text-red-300' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'}`}>🐞 Bug / Erro</button>
              <button onClick={() => setType('sugestao')} className={`flex-1 py-2 rounded-lg text-sm border ${type === 'sugestao' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'}`}>💡 Sugestão</button>
            </div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descreva o problema ou ideia</label><textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200 resize-none" placeholder="Ex: O botão de gerar minuta não está funcionando..." /></div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Capturas de Tela ({screenshots.length}/5)</label>
            <div className="space-y-3">
              {screenshots.length < 5 && (
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <UploadCloud className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Clique ou arraste imagens aqui</p>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple max={5 - screenshots.length} className="hidden" />
                </div>
              )}
              {screenshots.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                  {screenshots.map((screenshot, index) => (
                    <div key={index} className="relative group">
                      <img src={screenshot.preview} alt={`Screenshot ${index + 1}`} className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
                      <button onClick={(e) => { e.stopPropagation(); removeScreenshot(index); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Remover imagem"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button onClick={onClose} disabled={sending} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancelar</button>
          <button onClick={handleSend} disabled={sending || !message.trim()} className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${sending ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}>{sending ? 'Enviando...' : 'Enviar Relatório'}</button>
        </div>
      </div>
    </div>
  );
};

// --- 3. HEADER ---
const Header = ({ onAddClick, onRefresh, loading, darkMode, toggleDarkMode, user, onOpenProfile, isProcessing, currentView, setView }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const handleLogout = async () => { await supabase.auth.signOut(); };

  useEffect(() => {
    const handleClickOutside = (event) => { if (menuRef.current && !menuRef.current.contains(event.target)) { setMenuOpen(false); } };
    document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0];
  const initials = displayName.charAt(0).toUpperCase();
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between sticky top-0 z-20 transition-colors duration-200">
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2"><div className="bg-blue-600 p-2 rounded-lg"><FileText className="w-5 h-5 text-white" /></div><h1 className="text-xl font-semibold text-gray-800 dark:text-white hidden md:block">Painel JVB</h1></div>
        <nav className="flex space-x-1 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg">
            <button onClick={() => setView('dashboard')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center ${currentView === 'dashboard' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}><LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard</button>
            <button onClick={() => setView('agenda')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center ${currentView === 'agenda' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}><CalendarDays className="w-4 h-4 mr-2" /> Agenda</button>
        </nav>
        {isProcessing && (<div className="hidden lg:flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-800 animate-pulse"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs font-bold uppercase tracking-wide">IA Trabalhando...</span></div>)}
      </div>
      <div className="flex items-center space-x-3">
        <button onClick={onRefresh} disabled={loading} className={`p-2 rounded-full transition-colors ${loading ? 'text-blue-400 cursor-not-allowed' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`} title="Atualizar Lista"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
        <button onClick={toggleDarkMode} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 transition-colors">{darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
        <button onClick={onAddClick} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 font-medium shadow-sm transition-colors mr-2"><Plus className="w-5 h-5" /><span>Importar</span></button>
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-900 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 transition-colors">
            {avatarUrl ? (<img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-white dark:border-gray-700" />) : (<div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs">{initials}</div>)}
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 animate-fade-in-up z-30">
              <button onClick={() => { setMenuOpen(false); onOpenProfile(); }} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"><Settings className="w-4 h-4 mr-2" /> Meu Perfil</button>
              <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
              <button onClick={handleLogout} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"><LogOut className="w-4 h-4 mr-2" /> Sair</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

// --- 4. AGENDA VIEW ---
const AgendaView = ({ processes, onProcessClick }) => {
    const processosComPrazo = processes.filter(p => p.prazo_ia || p.data_prazo_final);
    processosComPrazo.sort((a, b) => {
        if (a.data_prazo_final && b.data_prazo_final) return new Date(a.data_prazo_final) - new Date(b.data_prazo_final);
        if (a.data_prazo_final) return -1;
        if (b.data_prazo_final) return 1;
        return 0;
    });

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center"><CalendarDays className="w-6 h-6 mr-2 text-blue-600" /> Agenda de Prazos</h2>
                <p className="text-sm text-gray-500">Visualizando {processosComPrazo.length} processos com alerta de prazo.</p>
            </div>
            {processosComPrazo.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-800 dark:text-white">Tudo limpo!</h3>
                    <p className="text-gray-500">Nenhum prazo detectado pela IA ou agendado manualmente.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        {processosComPrazo.map(process => (
                            <div key={process.id} onClick={() => onProcessClick(process)} className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-blue-400 cursor-pointer transition-all group">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-mono px-2 py-0.5 rounded">{process.numero_cnj}</span>
                                            {process.data_prazo_final ? (<span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded flex items-center"><Clock className="w-3 h-3 mr-1"/> Vence: {new Date(process.data_prazo_final).toLocaleDateString('pt-BR')}</span>) : (<span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> Definir Data</span>)}
                                        </div>
                                        <h3 className="font-semibold text-gray-800 dark:text-white">{process.cliente_nome}</h3>
                                        <p className="text-sm text-gray-500 mt-1">{process.prazo_ia ? `IA Detectou: "${process.prazo_ia}"` : 'Prazo manual definido.'}</p>
                                    </div>
                                    <ChevronRight className="text-gray-300 group-hover:text-blue-500" />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 h-fit">
                        <h3 className="text-sm font-bold uppercase text-gray-500 mb-4">Resumo do Mês</h3>
                        <div className="space-y-2">
                            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"><p className="text-xs text-gray-500">Use a lista ao lado para clicar nos processos e definir a data final exata no calendário.</p></div>
                            <div className="mt-4">
                                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Próximos Vencimentos:</p>
                                {processosComPrazo.filter(p => p.data_prazo_final).slice(0, 5).map(p => (
                                    <div key={p.id} className="flex justify-between text-sm py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                        <span className="text-gray-600 dark:text-gray-400 truncate w-32">{p.cliente_nome}</span>
                                        <span className="text-red-600 font-medium">{new Date(p.data_prazo_final).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                ))}
                                {processosComPrazo.filter(p => p.data_prazo_final).length === 0 && <p className="text-xs text-gray-400 italic">Nenhuma data confirmada ainda.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// --- 4.1 STATS BAR ---
const StatsBar = ({ processes }) => {
  const total = processes.length;
  const pendentes = processes.filter(p => !p.status_manual || p.status_manual === 'pendente').length;
  const analisados = processes.filter(p => p.status_manual === 'analisado').length;
  const progress = total > 0 ? Math.round((analisados / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-fade-in-up">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
        <div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Importado</p><h3 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{total}</h3></div>
        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-gray-600 dark:text-gray-400"><FileText className="w-6 h-6" /></div>
      </div>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
        <div><p className="text-xs font-bold text-yellow-600 dark:text-yellow-500 uppercase tracking-wider">Pendentes</p><h3 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{pendentes}</h3></div>
        <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg text-yellow-600 dark:text-yellow-400"><AlertCircle className="w-6 h-6" /></div>
      </div>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
        <div><p className="text-xs font-bold text-green-600 dark:text-green-500 uppercase tracking-wider">Concluídos</p><h3 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{analisados}</h3></div>
        <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg text-green-600 dark:text-green-400"><CheckCircle2 className="w-6 h-6" /></div>
      </div>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-blue-200 dark:border-blue-900 shadow-sm relative overflow-hidden">
        <div className="flex justify-between items-end mb-2">
          <div><p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Progresso do Lote</p><h3 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{progress}%</h3></div>
          <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400"><Activity className="w-6 h-6" /></div>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-2"><div className="bg-blue-600 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div></div>
      </div>
    </div>
  );
};

// --- 5. FILTER BAR ---
const FilterBar = ({ filters, setFilters, uniqueUFs, uniqueDates, onExportExcel, onExportPDF }) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 flex flex-col gap-4 transition-colors">
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:w-1/3"><Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" /><input type="text" placeholder="Buscar por Cliente ou CNJ..." className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 transition-all" value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})} /></div>
        <div className="relative w-full md:w-1/4"><Filter className="w-4 h-4 absolute left-3 top-3 text-gray-400" /><select className="w-full pl-10 pr-8 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 cursor-pointer" value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}><option value="">Todos os Status</option><option value="pendente">🟡 Pendentes</option><option value="analisado">🟢 Analisados</option><option value="frustrada">🔴 Frustrados</option></select><ChevronDown className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" /></div>
        <div className="relative w-full md:w-1/6"><MapPin className="w-4 h-4 absolute left-3 top-3 text-gray-400" /><select className="w-full pl-10 pr-8 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 cursor-pointer" value={filters.uf} onChange={(e) => setFilters({...filters, uf: e.target.value})}><option value="">Todos UF</option>{uniqueUFs.map(uf => <option key={uf} value={uf}>{uf}</option>)}</select><ChevronDown className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" /></div>
        <div className="relative w-full md:w-1/4"><Calendar className="w-4 h-4 absolute left-3 top-3 text-gray-400" /><select className="w-full pl-10 pr-8 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 cursor-pointer" value={filters.date} onChange={(e) => setFilters({...filters, date: e.target.value})}><option value="">Todas as Datas</option>{uniqueDates.map(date => ( <option key={date} value={date}>{date === 'Sem Data' ? 'Sem Data' : new Date(date).toLocaleDateString('pt-BR')}</option> ))}</select><ChevronDown className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" /></div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <button onClick={onExportExcel} className="flex items-center px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-md transition-colors dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/40"><FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Exportar Excel</button>
        <button onClick={onExportPDF} className="flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/40"><FileIcon className="w-3.5 h-3.5 mr-1.5" /> Exportar PDF</button>
      </div>
    </div>
  );
};

// --- 6. UPLOAD MODAL ---
const UploadModal = ({ isOpen, onClose, onUpload }) => {
  const [file, setFile] = useState(null);
  
  if (!isOpen) return null;
  const handleSubmit = () => {
    if (!file) return toast.warning("Selecione um arquivo!");
    onUpload(file); 
    setFile(null);
  };
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-fade-in border border-gray-200 dark:border-gray-700">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-200"><X className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Importar Processos</h2>
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer relative">
          <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => setFile(e.target.files[0])} />
          <UploadCloud className={`w-12 h-12 mb-3 ${file ? 'text-blue-500' : 'text-gray-400'}`} />
          <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">{file ? file.name : "Clique ou arraste o PDF aqui"}</p>
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={handleSubmit} className="px-4 py-2 rounded-lg text-white font-medium flex items-center bg-blue-600 hover:bg-blue-700 transition-colors">Enviar para Análise</button>
        </div>
      </div>
    </div>
  );
};

// --- 7. PROCESS CARD ---
const ProcessCard = ({ process, onClick, hasDraft, isDraftLoading }) => {
  const statusParaExibir = process.status_manual || process.status || 'pendente';
  const statusColors = { pendente: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', icon: AlertCircle, label: 'Pendente' }, analisado: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', icon: CheckCircle2, label: 'Analisado' }, frustrada: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', icon: AlertCircle, label: 'Frustrada' } };
  const { bg, text, icon: Icon, label } = statusColors[statusParaExibir.toLowerCase()] || statusColors.pendente;
  const dataFormatada = process.data_andamento ? new Date(process.data_andamento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-';
  const updatesBadgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 text-xs px-2 py-0.5 rounded-full font-medium";

  return (
    <div onClick={onClick} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500 transition-all cursor-pointer relative group">
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2">
            <div className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}><Icon className="w-3.5 h-3.5" /><span>{label}</span></div>
            {process.risco && (
                <div className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRiskColor(process.risco)}`}>
                    <Activity className="w-3 h-3 mr-1"/> {process.risco}
                </div>
            )}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{dataFormatada}</span>
      </div>
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg mb-3 group-hover:bg-gray-100 dark:group-hover:bg-gray-700 transition-colors"><span className="text-sm font-mono font-medium text-gray-700 dark:text-gray-200 truncate" title={process.numero_cnj}>{process.numero_cnj}</span><button className="p-1 text-gray-400 hover:text-blue-500"><Copy className="w-4 h-4" /></button></div>
      <div className="mb-3"><p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase mb-1">Cliente / Partes</p><p className="text-sm text-gray-800 dark:text-gray-200 font-medium truncate">{process.cliente_nome}</p></div>
      <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-2">
          <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400 text-sm"><span className="font-semibold">{process.tribunal}</span> - {process.estado_uf}</div>
          <div className="flex items-center gap-2">
             {isDraftLoading && <span title="IA Escrevendo Minuta..." className="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 text-xs p-1 rounded-full animate-spin"><Loader2 className="w-3 h-3" /></span>}
             {hasDraft && !isDraftLoading && <span title="Minuta pronta!" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 text-xs p-1 rounded-full animate-pulse"><PenTool className="w-3 h-3" /></span>}
             {process.total_updates > 1 && <span className={updatesBadgeClass}>+{process.total_updates - 1}</span>}
          </div>
      </div>
    </div>
  );
};

// --- 8. PROCESS DETAILS MODAL ---
const ProcessDetailsModal = ({ process, onClose, user, onUpdateStatus, onUpdateData, draftState, onGenerateDraft, onDeleteTask }) => {
  const [currentStatus, setCurrentStatus] = useState(process.status_manual || process.status || 'pendente');
  const [relato, setRelato] = useState('');
  const [sugestao, setSugestao] = useState('');
  const [acao, setAcao] = useState('');
  const [printFile, setPrintFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [taskHistory, setTaskHistory] = useState([]);

  // Estados do Chat
  const [activeTab, setActiveTab] = useState('resumo');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

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
      try {
        const { data } = await supabase.from('tarefas').select('*').eq('processo_id', process.id).order('created_at', { ascending: false });
        if (data) { setTaskHistory(data); if (data.length > 0 && data[0].status_tarefa !== 'minuta') setCurrentStatus(data[0].status_tarefa || 'pendente'); }
      } catch (err) { console.error('Erro:', err); } finally { setLoadingData(false); }
    };
    if (process?.id) loadTasks();
  }, [process, draftState.text]); 

  // Reset do Chat ao abrir outro processo
  useEffect(() => {
    setActiveTab('resumo');
    setChatMessages([]);
    setChatInput('');
    setIsChatLoading(false);
  }, [process]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  const handleSaveEdit = async () => {
    try {
      const { error } = await supabase.from('processos').update(editForm).eq('id', process.id);
      if (error) throw error;
      toast.success("Dados atualizados!");
      setIsEditing(false);
      onUpdateData(process.id, editForm);
    } catch (error) {
      toast.error("Erro ao atualizar: " + error.message);
    }
  };

  const handleSaveTask = async () => {
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
      toast.success('Movimentação salva!');
      onUpdateStatus(process.id, currentStatus);
      onClose();
    } catch (error) { toast.error('Erro: ' + error.message); } finally { setSaving(false); }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return toast.warning('Digite uma pergunta.');
    const question = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: question }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await fetch(API_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, processo_id: process.id })
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
  
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
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
               <p className="text-sm text-gray-500 mt-1 font-mono">{editForm.numero_cnj}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 transition-colors"><X className="w-6 h-6" /></button>
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

            <div className="pt-2">
                <button onClick={onGenerateDraft} disabled={draftState.loading} className={`w-full bg-gradient-to-r from-gray-700 to-gray-900 hover:from-gray-800 hover:to-black text-white font-medium py-2.5 rounded-lg shadow-md flex items-center justify-center transition-all group ${draftState.loading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                    <FileSignature className="w-4 h-4 mr-2" />
                    {draftState.loading ? 'Gerando Minuta (pode fechar a janela)...' : 'Gerar Minuta de Resposta (IA)'}
                </button>
                
                {showAiPanel && (
                    <div className="mt-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase flex items-center"><Scale className="w-3 h-3 mr-1"/> Rascunho Jurídico</span>
                            {displayText && (
                                <div className="flex gap-2">
                                    <button onClick={handleDownloadDocx} className="text-xs flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 transition-colors font-medium" title="Baixar em Word"><FileIcon className="w-3 h-3 mr-1"/> Baixar .docx</button>
                                    <button onClick={copyToClipboard} className="text-xs flex items-center px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 transition-colors" title="Copiar para área de transferência"><Copy className="w-3 h-3 mr-1"/> Copiar</button>
                                </div>
                            )}
                        </div>
                        {draftState.loading ? (
                            <div className="flex items-center justify-center py-6 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mr-2"/> Redigindo peça processual...</div>
                        ) : (
                            <textarea readOnly value={displayText} className="w-full text-sm font-mono bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-gray-800 dark:text-gray-200 resize-none focus:ring-0 shadow-inner leading-relaxed" rows={8}/>
                        )}
                    </div>
                )}
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-3 flex items-center"><Plus className="w-4 h-4 mr-1"/> Nova Movimentação Manual</h3>
              <div className="space-y-3">
                <textarea rows={2} value={relato} onChange={e => setRelato(e.target.value)} className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200" placeholder="Relato do que aconteceu..." />
                <div className="grid grid-cols-2 gap-3"><input type="text" value={sugestao} onChange={e => setSugestao(e.target.value)} className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200" placeholder="Sugestão..." /><input type="text" value={acao} onChange={e => setAcao(e.target.value)} className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200" placeholder="Ação tomada..." /></div>
                <div className="relative border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 flex items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-400 text-xs"><input type="file" accept="image/*,.pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => setPrintFile(e.target.files[0])} /><UploadCloud className="w-4 h-4 mr-2" /> {printFile ? <span className="text-blue-500 font-medium">{printFile.name}</span> : "Anexar Comprovante"}</div>
                <button onClick={handleSaveTask} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-95 flex justify-center items-center">{saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Salvar Alterações</>}</button>
              </div>
            </div>
          </div>

          <div className="w-full md:w-1/2 bg-gray-50 dark:bg-gray-900/50 p-8 overflow-y-auto custom-scrollbar">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6 flex items-center"><Clock className="w-4 h-4 mr-2"/> Linha do Tempo</h3>
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-3.5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
              {!loadingData && taskHistory.map((task) => (
                 <div key={task.id} className="relative pl-10 group">
                    <div className={`absolute left-0 top-1 flex items-center justify-center w-7 h-7 rounded-full border-2 ${task.status_tarefa === 'minuta' ? 'border-purple-200 bg-purple-100 text-purple-600' : 'border-white dark:border-gray-800 bg-blue-500 text-white'} shadow z-10`}>
                        {task.status_tarefa === 'minuta' ? <Scale className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-center mb-2">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${task.status_tarefa === 'minuta' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : (task.status_tarefa === 'analisado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}`}>{task.status_tarefa === 'minuta' ? 'Rascunho IA' : task.status_tarefa}</span>
                          <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-400">{new Date(task.created_at).toLocaleDateString('pt-BR')}</span>
                              {task.status_tarefa === 'minuta' && (<button onClick={() => handleDelete(task.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Excluir este rascunho"><Trash2 className="w-4 h-4" /></button>)}
                          </div>
                      </div>
                      {task.status_tarefa === 'minuta' ? (
                          <div className="mt-2 text-xs font-mono text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 whitespace-pre-wrap max-h-32 overflow-hidden relative">
                              {task.acao_feita}
                              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-50 dark:from-gray-800 to-transparent pointer-events-none"></div>
                          </div>
                      ) : (
                          <>
                            {task.relato && <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{task.relato}</p>}
                            {task.sugestao && <p className="text-xs text-gray-500 mb-1"><strong>Sugestão:</strong> {task.sugestao}</p>}
                          </>
                      )}
                      {task.print_url && (<a href={task.print_url} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-blue-600 hover:underline mt-2 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded"><ExternalLink className="w-3 h-3 mr-1"/> Ver Anexo</a>)}
                    </div>
                 </div>
              ))}
              <div className="relative pl-10 group">
                <div className="absolute left-0 top-1 flex items-center justify-center w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 bg-gray-400 text-white shadow z-10"><Bot className="w-3 h-3" /></div>
                <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm opacity-80">
                  <div className="flex justify-between items-start mb-2"><span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Sistema</span><span className="text-xs text-gray-400">{dataFormatada}</span></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">"{process.texto_resumo}"</p>
                  {process.history && process.history.length > 1 && (<div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2"><p className="text-xs font-bold text-gray-400 uppercase">Outras movimentações importadas:</p>{process.history.slice(1).map((hist, idx) => (<div key={idx} className="text-xs text-gray-500 dark:text-gray-500 pl-2 border-l-2 border-gray-200">{hist.texto_resumo} <span className="text-[10px] text-gray-400">({new Date(hist.data_andamento).toLocaleDateString('pt-BR')})</span></div>))}</div>)}
                </div>
              </div>
            </div>
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
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-10">
                  <Bot className="w-8 h-8 mx-auto mb-2 text-gray-300"/>
                  Envie uma pergunta para consultar o processo com base nos documentos.
                </p>
              )}
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
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
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSosOpen, setIsSosOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => { const saved = localStorage.getItem('theme'); return saved === 'dark'; });
  const [filters, setFilters] = useState({ search: '', status: '', uf: '', date: '' });
  const [isBackgroundProcessing, setIsBackgroundProcessing] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [drafts, setDrafts] = useState({}); 

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); });
    return () => subscription.unsubscribe();
  }, []);

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
          if (!acc[cnj]) { acc[cnj] = { ...item, total_updates: 0, history: [] }; }
          acc[cnj].history.push(item);
          acc[cnj].total_updates += 1;
          acc[cnj].risco = item.risco || acc[cnj].risco;
          acc[cnj].analise_risco = item.analise_risco || acc[cnj].analise_risco;
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
        listaUnica.sort((a, b) => new Date(b.created_at || b.data_andamento) - new Date(a.created_at || a.data_andamento));
        setProcesses(listaUnica);
        if (!silent) setLoading(false);
      })
      .catch(err => { console.error("Erro:", err); if (!silent) setLoading(false); });
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
    toast.success('Upload iniciado! O processamento da IA ocorrerá em segundo plano.');
    setIsBackgroundProcessing(true);
    const formData = new FormData();
    formData.append('file', file);
    fetch(API_UPLOAD_URL, { method: 'POST', body: formData })
      .then(() => {
          toast.success('Processamento concluído pelo servidor!');
          fetchProcesses(); 
          setIsBackgroundProcessing(false);
      })
      .catch((error) => { console.error('Erro:', error); toast.error('Ocorreu um erro no envio para o servidor.'); setIsBackgroundProcessing(false); });
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
    toast.info("IA iniciou a redação da minuta em segundo plano...");

    try {
      const response = await fetch(API_DRAFTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto_resumo: resumo })
      });
      
      const data = await response.json();
      const finalText = findTextInObject(data);

      const { error } = await supabase.from('tarefas').insert({
          processo_id: processId,
          user_id: session.user.id,
          relato: 'Minuta de Resposta Gerada via IA',
          acao_feita: finalText,
          status_tarefa: 'minuta' 
      });

      if (error) throw error;

      setDrafts(prev => ({ ...prev, [processId]: { loading: false, text: finalText } }));
      toast.success(`Minuta pronta e salva no histórico!`);

    } catch (error) {
      console.error(error);
      setDrafts(prev => ({ ...prev, [processId]: { loading: false, text: "Erro na geração." } }));
      toast.error("Erro ao gerar minuta.");
    }
  };

  const handleDeleteTask = async (taskId) => {
      try {
          const { error } = await supabase.from('tarefas').delete().eq('id', taskId);
          if (error) throw error;
          toast.success("Item removido da linha do tempo.");
      } catch (error) {
          console.error(error);
          toast.error("Erro ao excluir.");
      }
  };

  const filteredProcesses = useMemo(() => {
    return processes.filter(p => {
      const searchMatch = p.cliente_nome?.toLowerCase().includes(filters.search.toLowerCase()) || p.numero_cnj?.includes(filters.search);
      const currentStatus = p.status_manual || p.status || 'pendente';
      const statusMatch = filters.status ? currentStatus.toLowerCase() === filters.status : true;
      const ufMatch = filters.uf ? p.estado_uf === filters.uf : true;
      const rawDate = p.created_at || p.data_andamento;
      const dateMatch = filters.date ? rawDate && rawDate.startsWith(filters.date) : true;
      return searchMatch && statusMatch && ufMatch && dateMatch;
    });
  }, [processes, filters]);

  const exportToExcel = () => {
    const dataToExport = filteredProcesses.map(p => ({
      'CNJ': p.numero_cnj,
      'Cliente': p.cliente_nome,
      'Tribunal': p.tribunal,
      'UF': p.estado_uf,
      'Status': (p.status_manual || p.status || 'pendente').toUpperCase(),
      'Risco': p.risco || '-',
      'Data Andamento': new Date(p.data_andamento).toLocaleDateString('pt-BR'),
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

      const tableColumn = ["CNJ", "Cliente", "UF", "Status", "Risco", "Data"];
      const tableRows = [];

      filteredProcesses.forEach(process => {
        const processData = [
          process.numero_cnj,
          process.cliente_nome,
          process.estado_uf,
          (process.status_manual || process.status || 'pendente').toUpperCase(),
          process.risco || '-',
          new Date(process.data_andamento).toLocaleDateString('pt-BR')
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

  const uniqueUFs = useMemo(() => [...new Set(processes.map(p => p.estado_uf))].sort(), [processes]);
  const uniqueDates = useMemo(() => [...new Set(processes.map(p => { const raw = p.created_at || p.data_andamento; return raw ? raw.split('T')[0] : 'Sem Data'; }))].sort().reverse(), [processes]);

  const processesByUF = filteredProcesses.reduce((acc, p) => { 
    const uf = p.estado_uf || 'Outros';
    (acc[uf] = acc[uf] || []).push(p); 
    return acc; 
  }, {});

  const UFGroup = ({ uf, processes, onProcessClick, drafts }) => {
    const [isExpanded, setIsExpanded] = useState(true);
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
          <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {processes.map((p) => (<ProcessCard key={p.numero_cnj} process={p} onClick={() => onProcessClick(p)} hasDraft={drafts[p.id]?.text} isDraftLoading={drafts[p.id]?.loading} />))}
          </div>
        </div>
      </div>
    );
  };

  if (!session) return <><Toaster position="top-center" /><LoginPage /></>;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 font-sans flex flex-col transition-colors duration-200">
      <Toaster position="top-right" richColors />
      <Header onAddClick={() => setIsUploadOpen(true)} onRefresh={() => fetchProcesses(false)} loading={loading} darkMode={darkMode} toggleDarkMode={() => setDarkMode(!darkMode)} user={session.user} onOpenProfile={() => setIsProfileOpen(true)} isProcessing={isBackgroundProcessing} currentView={currentView} setView={setCurrentView} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {currentView === 'agenda' ? (
            <AgendaView processes={processes} onProcessClick={(p) => setSelectedProcess(p)} />
        ) : (
            <>
                <StatsBar processes={filteredProcesses} />
                <FilterBar filters={filters} setFilters={setFilters} uniqueUFs={uniqueUFs} uniqueDates={uniqueDates} onExportExcel={exportToExcel} onExportPDF={exportToPDF} />
                <div className="mb-6 flex items-center justify-between"><p className="text-gray-600 dark:text-gray-400">Visualizando <strong>{filteredProcesses.length}</strong> processos encontrados.</p>{loading && <div className="flex items-center text-blue-600 dark:text-blue-400"><Loader2 className="w-5 h-5 animate-spin mr-2"/> Carregando dados...</div>}</div>
                {!loading && filteredProcesses.length === 0 && (<div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700"><p className="text-gray-500 dark:text-gray-400">Nenhum processo encontrado com estes filtros.</p><button onClick={() => setFilters({search:'', status:'', uf:'', date:''})} className="mt-4 text-blue-500 hover:underline">Limpar Filtros</button></div>)}
                <div className="space-y-4">
                  {Object.entries(processesByUF).sort(([ufA], [ufB]) => ufA.localeCompare(ufB)).map(([uf, items]) => (<UFGroup key={uf} uf={uf} processes={items} onProcessClick={setSelectedProcess} drafts={drafts} />))}
                </div>
            </>
        )}
      </main>
      
      <button onClick={() => setIsSosOpen(true)} className="fixed bottom-6 right-6 bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-xl z-40 transition-transform hover:scale-110 flex items-center justify-center group" title="Reportar Problema"><LifeBuoy className="w-6 h-6 group-hover:animate-spin-slow" /></button>

      {selectedProcess && (
        <ProcessDetailsModal process={selectedProcess} onClose={() => setSelectedProcess(null)} user={session.user} onUpdateStatus={handleUpdateProcessStatus} onUpdateData={handleUpdateProcessData} draftState={drafts[selectedProcess.id] || { loading: false, text: '' }} onGenerateDraft={() => handleGenerateDraft(selectedProcess.id, selectedProcess.texto_resumo)} onDeleteTask={handleDeleteTask} />
      )}
      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUpload={handleFileUpload} />
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={session.user} onUserUpdated={(updatedUser) => setSession(prev => prev ? { ...prev, user: updatedUser } : prev)} />
      <SosModal isOpen={isSosOpen} onClose={() => setIsSosOpen(false)} user={session.user} />
    </div>
  );
}

export default App;