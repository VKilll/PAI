import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onSluit, titel, children, breedte = 'max-w-lg' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-antraciet-900/40 backdrop-blur-sm"
        onClick={onSluit}
      />
      {/* Paneel */}
      <div className={`relative w-full ${breedte} bg-white rounded-editorial shadow-card max-h-[90vh] flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-cream-200">
          <h2 className="font-serif text-xl text-antraciet-800">{titel}</h2>
          <button
            onClick={onSluit}
            className="p-1.5 text-gray-400 hover:text-antraciet-800 hover:bg-cream-100 rounded-editorial transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {/* Inhoud */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
