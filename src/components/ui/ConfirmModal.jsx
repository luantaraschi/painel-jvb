import React from 'react';
import { AlertOctagon, Loader2 } from 'lucide-react';

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  loading,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const confirmBtnClass =
    variant === 'success'
      ? 'bg-green-600 hover:bg-green-700'
      : variant === 'primary'
        ? 'bg-blue-600 hover:bg-blue-700'
        : 'bg-red-600 hover:bg-red-700';

  const iconWrapClass =
    variant === 'success'
      ? 'bg-green-100 dark:bg-green-900/30'
      : variant === 'primary'
        ? 'bg-blue-100 dark:bg-blue-900/30'
        : 'bg-red-100 dark:bg-red-900/30';

  const iconClass =
    variant === 'success'
      ? 'text-green-600 dark:text-green-400'
      : variant === 'primary'
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" onClick={!loading ? onClose : undefined}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6 animate-fade-in border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-center text-center">
          <div className={`${iconWrapClass} p-4 rounded-full mb-4`}>
            <AlertOctagon className={`w-8 h-8 ${iconClass}`} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{description}</p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 px-4 py-2.5 ${confirmBtnClass} text-white rounded-lg font-medium transition-colors flex items-center justify-center disabled:opacity-50`}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
