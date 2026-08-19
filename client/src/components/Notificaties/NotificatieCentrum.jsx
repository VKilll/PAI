import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, FileText, Sparkles, X } from 'lucide-react';
import api from '../../utils/api';
import Modal from '../UI/Modal';

const POLL_INTERVAL = 30000;

// Deze typen verdienen een pop-up in het gezicht; de rest alleen de bel.
const POPUP_TYPES = ['samenwerking_afgerond', 'factuur_vrijgegeven'];

const iconen = {
  samenwerking_afgerond:       Sparkles,
  factuur_vrijgegeven:         FileText,
  influencer_factuur_ontvangen: FileText,
};

function Regel({ notificatie, onOpen }) {
  const Icoon = iconen[notificatie.type] || Bell;
  return (
    <button
      onClick={() => onOpen(notificatie)}
      className={`w-full text-left flex gap-3 px-4 py-3 rounded-editorial transition-colors ${
        notificatie.gelezen ? 'hover:bg-cream-50' : 'bg-cream-50 hover:bg-cream-100'
      }`}
    >
      <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        notificatie.prioriteit === 'hoog' ? 'bg-goud-300/40 text-goud-600' : 'bg-cream-200 text-antraciet-700'
      }`}>
        <Icoon size={15} />
      </span>
      <span className="min-w-0">
        <span className="block font-sans text-sm font-medium text-antraciet-800">{notificatie.titel}</span>
        <span className="block font-sans text-xs text-gray-500 mt-0.5 line-clamp-2">{notificatie.bericht}</span>
      </span>
      {!notificatie.gelezen && <span className="w-2 h-2 rounded-full bg-goud-500 mt-1.5 flex-shrink-0" />}
    </button>
  );
}

export default function NotificatieCentrum() {
  const navigate = useNavigate();
  const [items, setItems]         = useState([]);
  const [ongelezen, setOngelezen] = useState(0);
  const [lijstOpen, setLijstOpen] = useState(false);
  const [popup, setPopup]         = useState(null);
  const [getoond, setGetoond]     = useState(() => new Set());

  const laad = useCallback(async () => {
    try {
      const r = await api.get('/notifications', { params: { limiet: 25 } });
      setItems(r.data.items);
      setOngelezen(r.data.ongelezen);

      // Eerstvolgende openstaande melding die een pop-up verdient
      setGetoond(eerder => {
        const kandidaat = r.data.items.find(
          n => POPUP_TYPES.includes(n.type) && !n.afgehandeld && !eerder.has(n.id)
        );
        if (!kandidaat) return eerder;
        setPopup(huidig => huidig || kandidaat);
        return new Set(eerder).add(kandidaat.id);
      });
    } catch {
      // stil: de bel mag nooit de pagina blokkeren
    }
  }, []);

  useEffect(() => {
    laad();
    const t = setInterval(laad, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [laad]);

  async function open(notificatie) {
    setLijstOpen(false);
    setPopup(null);
    if (!notificatie.gelezen) {
      await api.patch(`/notifications/${notificatie.id}/gelezen`).catch(() => {});
    }
    laad();
    if (notificatie.link) navigate(notificatie.link);
  }

  async function handelAf(notificatie) {
    await api.patch(`/notifications/${notificatie.id}/afgehandeld`).catch(() => {});
    setPopup(null);
    laad();
  }

  async function allesGelezen() {
    await api.post('/notifications/alles-gelezen').catch(() => {});
    laad();
  }

  return (
    <>
      {/* ── Bel ── */}
      <button
        onClick={() => setLijstOpen(o => !o)}
        className="relative p-2 text-gray-400 hover:text-antraciet-800 hover:bg-cream-100 rounded-editorial transition-colors"
        title="Meldingen"
      >
        <Bell size={17} />
        {ongelezen > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-goud-500 text-white text-[10px] font-sans font-medium flex items-center justify-center">
            {ongelezen > 9 ? '9+' : ongelezen}
          </span>
        )}
      </button>

      {/* ── Uitklaplijst ── */}
      {lijstOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setLijstOpen(false)} />
          <div className="absolute right-6 top-16 z-50 w-96 max-h-[70vh] overflow-y-auto bg-white rounded-editorial shadow-card border border-cream-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-cream-200 sticky top-0 bg-white">
              <p className="font-serif text-base text-antraciet-800">Meldingen</p>
              <div className="flex items-center gap-1">
                {ongelezen > 0 && (
                  <button onClick={allesGelezen} className="font-sans text-xs text-goud-600 hover:text-goud-500 px-2 py-1">
                    Alles gelezen
                  </button>
                )}
                <button onClick={() => setLijstOpen(false)} className="p-1 text-gray-400 hover:text-antraciet-800">
                  <X size={15} />
                </button>
              </div>
            </div>
            <div className="p-2 space-y-1">
              {items.length === 0 ? (
                <p className="font-sans text-sm text-gray-400 text-center py-8">Geen meldingen</p>
              ) : (
                items.map(n => <Regel key={n.id} notificatie={n} onOpen={open} />)
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Pop-up ── */}
      <Modal open={Boolean(popup)} onSluit={() => setPopup(null)} titel={popup?.titel || ''}>
        {popup && (
          <div className="space-y-5">
            <div className="flex gap-3">
              <span className="w-10 h-10 rounded-full bg-goud-300/40 text-goud-600 flex items-center justify-center flex-shrink-0">
                {React.createElement(iconen[popup.type] || Bell, { size: 18 })}
              </span>
              <p className="font-sans text-sm text-antraciet-700 leading-relaxed">{popup.bericht}</p>
            </div>
            <div className="flex gap-2">
              {popup.link && (
                <button onClick={() => open(popup)} className="btn-primair flex-1">
                  {popup.type === 'samenwerking_afgerond' ? 'Naar de factuur' : 'Factuur opstellen'}
                </button>
              )}
              <button onClick={() => handelAf(popup)} className="btn-secundair flex items-center justify-center gap-2 flex-1">
                <CheckCircle2 size={15} />
                Later
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
