'use client';
import { useEffect, useState } from 'react';
import { grantMetrics, initializeMetrics, METRICS_CHANGED, readMetricsPreference, revokeMetrics, type MetricsPreference } from '@/lib/metrics-client';

export function MetricsPreferences() {
  const [preference, setPreference] = useState<MetricsPreference>({ status: 'off' });
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  useEffect(() => {
    const refresh = () => { try { setPreference(readMetricsPreference(localStorage)); } catch { setPreference({ status: 'unavailable' }); } setReady(true); };
    try { initializeMetrics(localStorage); } catch { /* The disabled state remains usable. */ }
    refresh();
    window.addEventListener(METRICS_CHANGED, refresh);
    return () => { window.removeEventListener(METRICS_CHANGED, refresh); };
  }, []);
  async function change(enable: boolean) {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const ok = await (enable ? grantMetrics(localStorage) : revokeMetrics(localStorage));
      setPreference(readMetricsPreference(localStorage));
      setMessage(ok ? (enable ? 'Mesure activée pour 35 jours.' : 'Mesure désactivée. Données de mesure supprimées.') : enable ? 'Activation non confirmée. La mesure reste désactivée.' : 'Mesure arrêtée sur cet appareil. Suppression serveur à réessayer dès que la connexion revient.');
    } catch { setMessage('Le stockage du navigateur est indisponible.'); }
    finally { setBusy(false); }
  }
  const on = preference.status === 'granted';
  return <section className="metrics-preferences" aria-labelledby="metrics-title">
    <h3 id="metrics-title">Mesure facultative</h3>
    <p>Aider à améliorer BRAIZ en mesurant les parties, les retours et les erreurs. Aucun mot saisi, solution, score, pseudonyme ou lien privé n’est envoyé.</p>
    <label><input type="checkbox" checked={on} disabled={!ready || busy || preference.status === 'unavailable' || preference.status === 'revoking'} onChange={event => void change(event.currentTarget.checked)} /> Autoriser la mesure sur ce navigateur</label>
    <p>Identifiant aléatoire distinct de votre compte. Conservation limitée à 35 jours. Le retrait supprime les données associées. <a href="/confidentialite">Confidentialité</a></p>
    {(preference.status === 'pending' || preference.status === 'revoking') && <button type="button" disabled={busy} onClick={() => void change(false)}>{preference.status === 'pending' ? 'Annuler l’activation' : 'Réessayer la suppression'}</button>}
    {preference.status === 'unavailable' && <p>Préférence illisible. Aucun événement n’est envoyé.</p>}
    <p role="status" aria-live="polite">{busy ? 'En cours…' : message || (preference.status === 'revoking' ? 'Mesure arrêtée. Suppression serveur en attente de connexion.' : '')}</p>
  </section>;
}
