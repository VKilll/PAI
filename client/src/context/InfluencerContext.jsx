import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext';

// ============================================================
// Influencer-switch
// PA en manager werken met álle influencers en wisselen bovenin van dossier.
// Een influencer ziet alleen zichzelf en heeft dus geen switch.
// ============================================================

const InfluencerContext = createContext(null);
const OPSLAG_SLEUTEL = 'pa_actieve_influencer';

export function InfluencerProvider({ children }) {
  const { gebruiker, magWisselen } = useAuth();
  const [influencers, setInfluencers] = useState([]);
  const [actiefId, setActiefId] = useState(() => {
    const opgeslagen = localStorage.getItem(OPSLAG_SLEUTEL);
    return opgeslagen ? Number(opgeslagen) : null;
  });
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    if (!gebruiker) { setInfluencers([]); setLaden(false); return; }
    let actueel = true;
    setLaden(true);
    api.get('/influencers')
      .then(r => {
        if (!actueel) return;
        setInfluencers(r.data);
        setActiefId(huidig => {
          // Influencer zonder switch: altijd het eigen dossier
          if (!magWisselen) return r.data[0]?.id ?? null;
          if (huidig && r.data.some(i => i.id === huidig)) return huidig;
          return null; // null = alle influencers
        });
      })
      .catch(() => actueel && setInfluencers([]))
      .finally(() => actueel && setLaden(false));
    return () => { actueel = false; };
  }, [gebruiker, magWisselen]);

  useEffect(() => {
    if (actiefId) localStorage.setItem(OPSLAG_SLEUTEL, String(actiefId));
    else localStorage.removeItem(OPSLAG_SLEUTEL);
  }, [actiefId]);

  const waarde = useMemo(() => {
    const actief = influencers.find(i => i.id === actiefId) || null;
    return {
      influencers,
      laden,
      actiefId,
      actief,
      magWisselen,
      kiesInfluencer: setActiefId,
      // Handig als queryparameter: laat 'm weg wanneer alle influencers gelden
      params: actiefId ? { influencer_id: actiefId } : {},
    };
  }, [influencers, laden, actiefId, magWisselen]);

  return <InfluencerContext.Provider value={waarde}>{children}</InfluencerContext.Provider>;
}

export function useInfluencer() {
  return useContext(InfluencerContext) || {
    influencers: [], laden: false, actiefId: null, actief: null,
    magWisselen: false, kiesInfluencer: () => {}, params: {},
  };
}
