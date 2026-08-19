import React, { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  RefreshCw, Instagram, Link2, Unlink, Plus, Heart, MessageCircle,
  ExternalLink, AlertTriangle, Image as ImageIcon, Trash2
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useInfluencer } from '../context/InfluencerContext';
import Modal from '../components/UI/Modal';

const statusTekst = {
  niet_gekoppeld: { label: 'Niet gekoppeld', kleur: 'text-gray-400' },
  gekoppeld:      { label: 'Gekoppeld',      kleur: 'text-green-700' },
  token_verlopen: { label: 'Token verlopen', kleur: 'text-orange-600' },
  fout:           { label: 'Fout',           kleur: 'text-red-600' },
};

function datum(waarde, patroon = 'd MMM yyyy') {
  if (!waarde) return null;
  try { return format(parseISO(waarde.replace(' ', 'T')), patroon, { locale: nl }); } catch { return waarde; }
}

// ── Koppelen ──────────────────────────────────────────────────
function KoppelModal({ open, onSluit, account, onGekoppeld, metaGeconfigureerd }) {
  const [token, setToken]   = useState('');
  const [alVerlengd, setAlVerlengd] = useState(false);
  const [bezig, setBezig]   = useState(false);
  const [fout, setFout]     = useState(null);

  async function koppel(e) {
    e.preventDefault();
    setBezig(true);
    setFout(null);
    try {
      await api.post(`/feeds/${account.influencer_id}/koppel`, { token, al_verlengd: alVerlengd });
      setToken('');
      onGekoppeld();
      onSluit();
    } catch (err) {
      setFout(err.response?.data?.error || 'Koppelen mislukt');
    } finally {
      setBezig(false);
    }
  }

  return (
    <Modal open={open} onSluit={onSluit} titel={`Instagram koppelen — ${account?.influencer_naam || ''}`} breedte="max-w-2xl">
      <form onSubmit={koppel} className="space-y-4">
        {fout && (
          <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-100 rounded-editorial px-3 py-2">{fout}</p>
        )}

        <div className="bg-cream-50 border border-cream-200 rounded-editorial px-4 py-3 space-y-2">
          <p className="font-sans text-sm font-medium text-antraciet-800">Wat je nodig hebt</p>
          <ul className="font-sans text-xs text-gray-500 space-y-1 list-disc pl-4 leading-relaxed">
            <li>Het account is een <span className="text-antraciet-700">Business- of Creator-account</span> en hangt aan een Facebook-pagina. Een persoonlijk account kan Instagram niet uitlezen.</li>
            <li>Een Meta-app met de rechten <code className="text-antraciet-700">instagram_basic</code> en <code className="text-antraciet-700">pages_show_list</code>.</li>
            <li>Een gebruikerstoken uit die app. Hieronder wordt daar een langlopend token van gemaakt (± 60 dagen).</li>
            <li>Voor accounts van klanten heeft Meta eerst App Review nodig; tot die tijd werkt alleen je eigen account.</li>
          </ul>
        </div>

        {!metaGeconfigureerd && (
          <p className="font-sans text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded-editorial px-3 py-2 flex gap-2">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            META_APP_ID en META_APP_SECRET staan nog niet in de serverconfiguratie. Zonder die twee kan een kort
            token niet verlengd worden — vink hieronder aan dat je al een langlopend token hebt.
          </p>
        )}

        <div>
          <label className="label">Toegangstoken *</label>
          <textarea
            className="input font-mono text-xs" rows={3} required
            placeholder="EAA..."
            value={token} onChange={e => setToken(e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox" checked={alVerlengd}
            onChange={e => setAlVerlengd(e.target.checked)}
            className="w-4 h-4 accent-goud-500"
          />
          <span className="font-sans text-sm text-antraciet-700">Dit is al een langlopend token</span>
        </label>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={bezig || !token} className="btn-primair flex-1 disabled:opacity-50">
            {bezig ? 'Koppelen...' : 'Koppelen'}
          </button>
          <button type="button" onClick={onSluit} className="btn-secundair flex-1">Annuleren</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Handmatige post ───────────────────────────────────────────
function HandmatigModal({ open, onSluit, influencerId, influencers, onOpgeslagen }) {
  const [form, setForm] = useState({
    influencer_id: influencerId || '', permalink: '', media_url: '', caption: '',
    gepost_op: new Date().toISOString().split('T')[0], media_type: 'IMAGE', likes: '', reacties: '',
  });
  const [bezig, setBezig] = useState(false);
  const [fout, setFout]   = useState(null);

  useEffect(() => {
    if (influencerId) setForm(f => ({ ...f, influencer_id: influencerId }));
  }, [influencerId, open]);

  const wijzig = (veld, waarde) => setForm(f => ({ ...f, [veld]: waarde }));

  async function opslaan(e) {
    e.preventDefault();
    setBezig(true);
    setFout(null);
    try {
      await api.post('/feeds', {
        ...form,
        likes: form.likes === '' ? null : Number(form.likes),
        reacties: form.reacties === '' ? null : Number(form.reacties),
      });
      onOpgeslagen();
      onSluit();
    } catch (err) {
      setFout(err.response?.data?.error || 'Opslaan mislukt');
    } finally {
      setBezig(false);
    }
  }

  return (
    <Modal open={open} onSluit={onSluit} titel="Post handmatig toevoegen" breedte="max-w-xl">
      <form onSubmit={opslaan} className="space-y-4">
        {fout && (
          <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-100 rounded-editorial px-3 py-2">{fout}</p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Influencer *</label>
            <select
              className="input" required value={form.influencer_id}
              onChange={e => wijzig('influencer_id', Number(e.target.value))}
            >
              <option value="">Kies</option>
              {influencers.map(i => <option key={i.id} value={i.id}>{i.naam}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Gepost op</label>
            <input type="date" className="input" value={form.gepost_op} onChange={e => wijzig('gepost_op', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Link naar de post</label>
          <input
            type="url" className="input" placeholder="https://www.instagram.com/p/..."
            value={form.permalink} onChange={e => wijzig('permalink', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Afbeelding (URL)</label>
          <input type="url" className="input" value={form.media_url} onChange={e => wijzig('media_url', e.target.value)} />
        </div>

        <div>
          <label className="label">Caption</label>
          <textarea className="input" rows={3} value={form.caption} onChange={e => wijzig('caption', e.target.value)} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.media_type} onChange={e => wijzig('media_type', e.target.value)}>
              {['IMAGE', 'VIDEO', 'REEL', 'CAROUSEL_ALBUM'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Likes</label>
            <input type="number" min="0" className="input" value={form.likes} onChange={e => wijzig('likes', e.target.value)} />
          </div>
          <div>
            <label className="label">Reacties</label>
            <input type="number" min="0" className="input" value={form.reacties} onChange={e => wijzig('reacties', e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={bezig} className="btn-primair flex-1 disabled:opacity-50">
            {bezig ? 'Opslaan...' : 'Toevoegen'}
          </button>
          <button type="button" onClick={onSluit} className="btn-secundair flex-1">Annuleren</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Eén post in de feed ───────────────────────────────────────
function FeedKaart({ item, onVerwijder, magBewerken }) {
  return (
    <div className="card p-0 overflow-hidden group">
      <div className="aspect-square bg-cream-100 flex items-center justify-center overflow-hidden">
        {item.thumbnail_url || item.media_url ? (
          <img
            src={item.thumbnail_url || item.media_url}
            alt={item.caption?.slice(0, 60) || 'Post'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <ImageIcon size={32} strokeWidth={1} className="text-gray-300" />
        )}
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-sans text-xs text-goud-600">{item.influencer_naam}</span>
          <span className="font-sans text-[10px] text-gray-400 uppercase tracking-wider">
            {item.bron === 'instagram' ? 'Instagram' : 'handmatig'}
          </span>
        </div>

        {item.caption && (
          <p className="font-sans text-xs text-gray-600 line-clamp-3 leading-relaxed">{item.caption}</p>
        )}

        {item.samenwerking_titel && (
          <p className="font-sans text-[11px] text-antraciet-700 bg-cream-100 rounded-editorial px-2 py-1">
            {item.klant} · {item.samenwerking_titel}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 font-sans text-xs text-gray-400">
            {item.likes != null && <span className="flex items-center gap-1"><Heart size={12} />{item.likes}</span>}
            {item.reacties != null && <span className="flex items-center gap-1"><MessageCircle size={12} />{item.reacties}</span>}
            {item.gepost_op && <span>{datum(item.gepost_op, 'd MMM')}</span>}
          </div>
          <div className="flex items-center gap-1">
            {item.permalink && (
              <a
                href={item.permalink} target="_blank" rel="noreferrer"
                className="p-1.5 text-gray-400 hover:text-antraciet-800 rounded-editorial transition-colors"
                title="Openen op Instagram"
              >
                <ExternalLink size={13} />
              </a>
            )}
            {magBewerken && (
              <button
                onClick={() => onVerwijder(item)}
                className="p-1.5 text-gray-300 hover:text-red-600 rounded-editorial transition-colors opacity-0 group-hover:opacity-100"
                title="Verwijderen"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
export default function Influencers() {
  const { isPA, isManager, isInfluencer } = useAuth();
  const { influencers, actiefId, actief, params } = useInfluencer();

  const [accounts, setAccounts] = useState([]);
  const [metaGeconfigureerd, setMetaGeconfigureerd] = useState(false);
  const [feed, setFeed]         = useState([]);
  const [laden, setLaden]       = useState(true);
  const [syncBezig, setSyncBezig] = useState(null);
  const [melding, setMelding]   = useState(null);
  const [fout, setFout]         = useState(null);
  const [koppelVoor, setKoppelVoor] = useState(null);
  const [handmatigOpen, setHandmatigOpen] = useState(false);

  const magBewerken = isPA || isManager || isInfluencer;

  const laadData = useCallback(async () => {
    setLaden(true);
    try {
      const [acc, items] = await Promise.all([
        api.get('/feeds/accounts'),
        api.get('/feeds', { params }),
      ]);
      setAccounts(acc.data.accounts);
      setMetaGeconfigureerd(acc.data.meta_geconfigureerd);
      setFeed(items.data);
    } finally {
      setLaden(false);
    }
  }, [params]);

  useEffect(() => { laadData(); }, [laadData]);

  async function sync(account) {
    setSyncBezig(account.influencer_id);
    setFout(null);
    setMelding(null);
    try {
      const r = await api.post(`/feeds/${account.influencer_id}/sync`);
      setMelding(`${r.data.opgehaald} posts opgehaald voor ${account.influencer_naam}.`);
      laadData();
    } catch (err) {
      setFout(err.response?.data?.error || 'Ophalen mislukt');
    } finally {
      setSyncBezig(null);
    }
  }

  async function ontkoppel(account) {
    if (!window.confirm(`Instagram-koppeling van ${account.influencer_naam} verbreken?`)) return;
    await api.delete(`/feeds/${account.influencer_id}/koppel`).catch(() => {});
    laadData();
  }

  async function verwijderPost(item) {
    if (!window.confirm('Deze post uit de feed verwijderen?')) return;
    await api.delete(`/feeds/${item.id}`).catch(() => {});
    laadData();
  }

  const zichtbareAccounts = actiefId
    ? accounts.filter(a => a.influencer_id === actiefId)
    : accounts;

  return (
    <div className="p-8 space-y-6 max-w-7xl">

      {/* ── Kop ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-heading text-antraciet-800">Influencers</h1>
          <p className="font-sans text-sm text-gray-400 mt-1">
            Feeds van {actief ? actief.naam : 'alle influencers'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={laadData}
            className="p-2.5 text-gray-400 hover:text-antraciet-800 hover:bg-cream-200 rounded-editorial transition-colors"
            title="Vernieuwen"
          >
            <RefreshCw size={16} className={laden ? 'animate-spin' : ''} />
          </button>
          {magBewerken && (
            <button onClick={() => setHandmatigOpen(true)} className="btn-secundair flex items-center gap-2 text-sm">
              <Plus size={15} />
              Post toevoegen
            </button>
          )}
        </div>
      </div>

      {melding && (
        <p className="font-sans text-sm text-goud-700 bg-cream-100 border border-cream-300 rounded-editorial px-4 py-3">{melding}</p>
      )}
      {fout && (
        <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-100 rounded-editorial px-4 py-3">{fout}</p>
      )}

      {/* ── Koppelingen ── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 bg-cream-50 border-b border-cream-200">
          <p className="font-serif text-base text-antraciet-800">Instagram-koppelingen</p>
        </div>
        {zichtbareAccounts.length === 0 ? (
          <p className="font-sans text-sm text-gray-400 px-4 py-6 text-center">Geen influencers gevonden.</p>
        ) : (
          zichtbareAccounts.map(a => {
            const status = statusTekst[a.status || 'niet_gekoppeld'];
            return (
              <div key={a.influencer_id} className="flex items-center gap-4 px-4 py-3 border-b border-cream-200 last:border-0">
                <span className="w-9 h-9 rounded-full bg-cream-200 text-goud-600 flex items-center justify-center flex-shrink-0">
                  <Instagram size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm font-medium text-antraciet-800">{a.influencer_naam}</p>
                  <p className="font-sans text-xs text-gray-400 mt-0.5">
                    <span className={status.kleur}>{status.label}</span>
                    {a.ig_gebruikersnaam && ` · @${a.ig_gebruikersnaam}`}
                    {a.laatste_sync && ` · laatst opgehaald ${datum(a.laatste_sync, 'd MMM HH:mm')}`}
                    {` · ${a.aantal_posts} posts`}
                  </p>
                  {a.laatste_fout && (
                    <p className="font-sans text-xs text-red-600 mt-1">{a.laatste_fout}</p>
                  )}
                </div>
                {magBewerken && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {a.status === 'gekoppeld' && (
                      <button
                        onClick={() => sync(a)}
                        disabled={syncBezig === a.influencer_id}
                        className="btn-secundair text-sm px-3 py-1.5 disabled:opacity-50"
                      >
                        {syncBezig === a.influencer_id ? 'Ophalen...' : 'Feed ophalen'}
                      </button>
                    )}
                    <button
                      onClick={() => setKoppelVoor(a)}
                      className="p-2 text-gray-400 hover:text-antraciet-800 hover:bg-cream-200 rounded-editorial transition-colors"
                      title={a.status === 'gekoppeld' ? 'Opnieuw koppelen' : 'Koppelen'}
                    >
                      <Link2 size={15} />
                    </button>
                    {a.account_id && (
                      <button
                        onClick={() => ontkoppel(a)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-editorial transition-colors"
                        title="Koppeling verbreken"
                      >
                        <Unlink size={15} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Feed ── */}
      <div>
        <p className="font-serif text-lg text-antraciet-800 mb-3">Feed</p>
        {laden ? (
          <div className="card flex items-center justify-center py-16 text-gray-300">
            <RefreshCw size={20} className="animate-spin mr-2" />
            <span className="font-sans text-sm">Laden...</span>
          </div>
        ) : feed.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 text-gray-300">
            <Instagram size={40} strokeWidth={1} className="mb-3" />
            <p className="font-serif text-lg">Nog geen posts</p>
            <p className="font-sans text-sm mt-1">Koppel Instagram of voeg een post handmatig toe</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {feed.map(item => (
              <FeedKaart key={item.id} item={item} onVerwijder={verwijderPost} magBewerken={magBewerken} />
            ))}
          </div>
        )}
      </div>

      {koppelVoor && (
        <KoppelModal
          open={Boolean(koppelVoor)}
          account={koppelVoor}
          metaGeconfigureerd={metaGeconfigureerd}
          onSluit={() => setKoppelVoor(null)}
          onGekoppeld={laadData}
        />
      )}

      <HandmatigModal
        open={handmatigOpen}
        onSluit={() => setHandmatigOpen(false)}
        influencerId={actiefId}
        influencers={influencers}
        onOpgeslagen={laadData}
      />
    </div>
  );
}
