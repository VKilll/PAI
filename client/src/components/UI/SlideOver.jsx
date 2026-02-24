import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function SlideOver({ open, onSluit, titel, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-antraciet-900/30 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onSluit}
      />
      {/* Paneel */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-xl bg-white shadow-card
                    transform transition-transform duration-300 ease-in-out flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-cream-200 bg-cream-50">
          <h2 className="font-serif text-xl text-antraciet-800">{titel}</h2>
          <button
            onClick={onSluit}
            className="p-1.5 text-gray-400 hover:text-antraciet-800 hover:bg-cream-200 rounded-editorial transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {/* Inhoud */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}
