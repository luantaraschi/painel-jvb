import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { LifeBuoy, X, UploadCloud } from 'lucide-react';

const API_SOS_URL = "https://jvbadvocacia-n8n.cloudfy.live/webhook/sos";

const SosModal = ({ isOpen, onClose, user }) => {
  const [message, setMessage] = useState('');
  const [type, setType] = useState('bug');
  const [sending, setSending] = useState(false);
  const [screenshots, setScreenshots] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      screenshots.forEach(screenshot => URL.revokeObjectURL(screenshot.preview));
    };
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
    if (!message.trim()) return toast.warning("Digite uma mensagem.");
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
      const basePayload = { user_id: user.id, mensagem: message, tipo: type, contato: user.email, status: 'aberto' };
      const payloadWithScreenshots = { ...basePayload, screenshots: screenshotUrls };

      let { error: sosInsertErr } = await supabase.from('chamados_sos').insert(payloadWithScreenshots);

      if (sosInsertErr && /screenshots/i.test(sosInsertErr.message || '')) {
        const retry = await supabase.from('chamados_sos').insert(basePayload);
        sosInsertErr = retry.error;
        if (!sosInsertErr) {
          toast.warning('Chamado registrado, mas sem anexos no banco (coluna screenshots ausente).');
        }
      }

      if (sosInsertErr) throw new Error(`Falha ao registrar no banco: ${sosInsertErr.message}`);

      const webhookRes = await fetch(API_SOS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: user.email, mensagem: message, tipo: type, status: 'aberto', screenshots: screenshotUrls })
      });

      if (!webhookRes.ok) {
        const text = await webhookRes.text().catch(() => '');
        throw new Error(text || `Falha ao chamar webhook SOS (HTTP ${webhookRes.status})`);
      }

      toast.success("Solicitação enviada! Analisaremos em breve.");
      setMessage('');
      setScreenshots([]);
      onClose();
    } catch (error) {
      toast.error("Erro ao enviar: " + (error.message || 'Tente novamente.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center">
            <LifeBuoy className="w-5 h-5 mr-2 text-red-500" /> Central de Ajuda (SOS)
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo de Relato</label>
            <div className="flex gap-2">
              <button
                onClick={() => setType('bug')}
                className={`flex-1 py-2 rounded-lg text-sm border ${type === 'bug' ? 'bg-red-50 border-red-500 text-red-700 dark:bg-red-900/20 dark:text-red-300' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'}`}
              >
                🐞 Bug / Erro
              </button>
              <button
                onClick={() => setType('sugestao')}
                className={`flex-1 py-2 rounded-lg text-sm border ${type === 'sugestao' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'}`}
              >
                💡 Sugestão
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descreva o problema ou ideia</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200 resize-none"
              placeholder="Ex: O botão de gerar minuta não está funcionando..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Capturas de Tela ({screenshots.length}/5)
            </label>
            <div className="space-y-3">
              {screenshots.length < 5 && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <UploadCloud className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Clique ou arraste imagens aqui</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    multiple
                    max={5 - screenshots.length}
                    className="hidden"
                  />
                </div>
              )}
              {screenshots.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                  {screenshots.map((screenshot, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={screenshot.preview}
                        alt={`Screenshot ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); removeScreenshot(index); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remover imagem"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${sending ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {sending ? 'Enviando...' : 'Enviar Relatório'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SosModal;
