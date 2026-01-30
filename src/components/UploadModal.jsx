import React, { useState } from 'react';
import { toast } from 'sonner';
import { UploadCloud, X } from 'lucide-react';

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
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-200">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Importar Processos</h2>
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer relative">
          <input
            type="file"
            accept=".pdf"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => setFile(e.target.files[0])}
          />
          <UploadCloud className={`w-12 h-12 mb-3 ${file ? 'text-blue-500' : 'text-gray-400'}`} />
          <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
            {file ? file.name : "Clique ou arraste o PDF aqui"}
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg text-white font-medium flex items-center bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Enviar para Análise
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
