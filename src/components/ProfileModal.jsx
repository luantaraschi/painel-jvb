import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { X, UploadCloud, Loader2 } from 'lucide-react';

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
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  if (!isOpen) return null;

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter ate 5MB.');
      return;
    }
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
      if (newPassword) {
        updates.password = newPassword;
      }
      const { data, error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
      if (data?.user && onUserUpdated) onUserUpdated(data.user);
      toast.success('Perfil atualizado com sucesso!');
      onClose();
    } catch (error) {
      toast.error('Erro ao atualizar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Meu Perfil</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="flex flex-col items-center mb-6 space-y-3">
            <div className="relative">
              {avatarPreview || avatarUrl ? (
                <img
                  src={avatarPreview || avatarUrl}
                  alt="Foto de perfil"
                  className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-md"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-3xl font-bold text-blue-600 dark:text-blue-300 border-4 border-white dark:border-gray-700 shadow-md">
                  {fullName ? fullName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow border border-white dark:border-gray-800 transition-colors"
                title="Enviar foto"
              >
                <UploadCloud className="w-4 h-4" />
              </button>
            </div>
            <input
              id="profile-avatar-upload"
              name="avatar"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <label htmlFor="profile-full-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome de Exibição</label>
            <input
              id="profile-full-name"
              name="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Seu nome completo"
            />
          </div>
          <div>
            <label htmlFor="profile-new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nova Senha (Opcional)</label>
            <input
              id="profile-new-password"
              name="password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Deixe em branco para manter a atual"
            />
          </div>
          <div className="pt-4">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg flex justify-center items-center transition-colors"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
