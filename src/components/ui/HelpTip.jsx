import React from 'react';
import { HelpCircle } from 'lucide-react';

const HelpTip = ({ text }) => {
  if (!text) return null;
  return (
    <span className="relative inline-flex items-center group">
      <button
        type="button"
        aria-label="Ajuda"
        className="ml-2 inline-flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/60 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      <div className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-72">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-3 text-xs text-gray-700 dark:text-gray-200">
          {text}
        </div>
      </div>
    </span>
  );
};

export default HelpTip;
