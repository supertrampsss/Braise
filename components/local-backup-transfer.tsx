'use client';

import { useLayoutEffect, useRef, useState, type ChangeEvent } from 'react';
import { Download, Upload } from 'lucide-react';
import { createLocalBackup, importLocalBackup, inspectLocalBackup, LOCAL_BACKUP_MAX_BYTES, type LocalBackupPreview } from '@/lib/local-backup';
import type { ProfileSnapshot } from '@/lib/profile-storage';
import type { DeviceSyncGuard } from './device-sync';

type Preview = Omit<LocalBackupPreview, 'staged'>;
type Candidate = { filename: string; text: string; preview: Preview; boardRevision: string | null };
type Props = { snapshot: ProfileSnapshot; onSnapshot: (snapshot: ProfileSnapshot) => void; disabled?: boolean; mergeGuard?: DeviceSyncGuard };
const statusLabels = { add: 'À ajouter', merge: 'À fusionner', unchanged: 'Déjà présente', conflict: 'Conflit' };
const modeLabels = { daily: 'Mot du jour', archive: 'Archive', free: 'Partie libre', challenge: 'Défi' };
function messageOf(cause: unknown) { return cause instanceof Error ? cause.message : 'Le fichier n’a pas pu être traité.'; }

export function LocalBackupTransfer({ snapshot, onSnapshot, disabled = false, mergeGuard }: Props) {
  const inputRef = useRef<HTMLInputElement>(null), candidateRef = useRef<Candidate | null>(null), selectionRef = useRef(0);
  const latest = useRef({ snapshot, onSnapshot, disabled, mergeGuard });
  useLayoutEffect(() => { latest.current = { snapshot, onSnapshot, disabled, mergeGuard }; });
  const [candidate, setCandidate] = useState<Candidate | null>(null), [message, setMessage] = useState(''), [error, setError] = useState(''), [visibleGames, setVisibleGames] = useState(20);
  function replaceCandidate(value: Candidate | null) { candidateRef.current = value; setCandidate(value); }
  function available() {
    const selected = latest.current, revision = selected.mergeGuard?.revision() ?? null;
    if (selected.disabled || selected.mergeGuard && revision === null) throw new Error('Une partie est en cours d’enregistrement. Réessayez dans un instant.');
    return { ...selected, revision };
  }
  function download() {
    setMessage(''); setError('');
    try {
      const selected = available();
      const result = createLocalBackup(window.localStorage, selected.snapshot, new Date(), selected.mergeGuard?.currentGame?.());
      const url = URL.createObjectURL(new Blob([result.text], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = result.filename; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage('Téléchargement lancé. Ouvrez ce fichier dans le profil de votre autre appareil.');
    } catch (cause) { setError(messageOf(cause)); }
  }
  function inspect(text: string, filename: string) {
    const selected = available();
    const { staged: _staged, ...preview } = inspectLocalBackup(text, window.localStorage, selected.snapshot, new Date(), selected.mergeGuard?.currentGame?.());
    replaceCandidate({ filename, text, preview, boardRevision: selected.revision });
    setVisibleGames(20);
  }
  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selection = ++selectionRef.current, file = event.currentTarget.files?.[0];
    event.currentTarget.value = ''; replaceCandidate(null); setError(''); setMessage('');
    if (!file) return;
    if (file.size > LOCAL_BACKUP_MAX_BYTES) { setError('Le fichier dépasse 8 Mio. Rien n’a été modifié.'); return; }
    try {
      const text = await file.text();
      if (selection !== selectionRef.current) return;
      inspect(text, file.name);
    } catch (cause) { if (selection === selectionRef.current) setError(messageOf(cause)); }
  }
  function confirm() {
    const current = candidateRef.current;
    if (!current || current.preview.conflicts.length || !current.preview.changed) return;
    setError(''); setMessage('');
    try {
      const selected = available();
      if (selected.mergeGuard && current.boardRevision !== selected.revision) throw new Error('La partie a changé. Actualisez l’aperçu avant de confirmer.');
      const imported = importLocalBackup(current.text, current.preview.revision, window.localStorage, selected.snapshot, new Date(), () => !latest.current.disabled && (!latest.current.mergeGuard || latest.current.mergeGuard.admit(current.boardRevision)), selected.mergeGuard?.currentGame?.());
      replaceCandidate(null); selected.onSnapshot(imported);
      setMessage('Sauvegarde importée. Vos parties et votre progression sont disponibles sur cet appareil.');
    } catch (cause) { setError(messageOf(cause)); }
  }
  return <section className="profile-transfer local-backup-transfer" aria-labelledby="local-backup-title">
    <h3 id="local-backup-title">Sauvegarder mes parties</h3>
    <p>Profil et parties en cours ou terminées, sans compte. Téléchargez le fichier ici, puis importez-le sur l’autre appareil.</p>
    <div className="profile-transfer-actions">
      <button type="button" className="secondary-button" disabled={disabled} onClick={download}><Download size={16} aria-hidden="true" />Télécharger ma sauvegarde</button>
      <button type="button" className="secondary-button" disabled={disabled} onClick={() => inputRef.current?.click()}><Upload size={16} aria-hidden="true" />Importer une sauvegarde</button>
      <input ref={inputRef} type="file" className="profile-file-input" accept="application/json,.json" aria-label="Sauvegarde des parties à importer" tabIndex={-1} onChange={chooseFile} />
    </div>
    <details className="backup-scope"><summary>Contenu du fichier</summary><p>Mot du jour, parties libres, archives et défis : essais, classements, indices et historiques complets. Le profil et sa préférence de son sont inclus. Les anciennes épingles restent conservées.</p><p>Les duels et leur accès, les modes d’entraînement, le rappel et la préférence de mesure restent séparés. Aucun transfert automatique. Le fichier contient vos mots et solutions en clair ; gardez-le pour vous.</p></details>
    {candidate && <div className="import-preview" aria-labelledby="backup-preview-title">
      <h4 id="backup-preview-title">Aperçu de la sauvegarde</h4><p className="backup-filename">{candidate.filename}</p>
      <p>{candidate.preview.games.length} partie(s), {candidate.preview.activities} élément(s) de progression à ajouter. Rien n’a encore été modifié.</p>
      {candidate.preview.games.length > 0 && <div className="profile-table-scroll" tabIndex={0} role="region" aria-label="Parties à importer"><table><caption>Vos parties sont conservées lors de la fusion</caption><thead><tr><th scope="col">Partie</th><th scope="col">Essais ici / fichier</th><th scope="col">Action</th></tr></thead><tbody>{candidate.preview.games.slice(0, visibleGames).map(game => <tr key={game.id}><th scope="row">{modeLabels[game.mode]}<small>{game.id.match(/\d{4}-\d{2}-\d{2}$/)?.[0] ?? (game.completed ? 'Terminée' : 'En cours')}</small></th><td>{game.localGuesses} / {game.incomingGuesses}</td><td>{statusLabels[game.status]}{game.reason && <small>{game.reason}</small>}</td></tr>)}</tbody></table></div>}
      {visibleGames < candidate.preview.games.length && <button type="button" className="text-action" onClick={() => setVisibleGames(count => count + 20)}>Voir les suivantes</button>}
      {candidate.preview.conflicts.length > 0 ? <div className="transfer-error" role="alert"><p>Import bloqué. Les données de cet appareil restent intactes.</p><ul>{candidate.preview.conflicts.map((reason, index) => <li key={index}>{reason}</li>)}</ul></div> : !candidate.preview.changed ? <p role="status">Cette sauvegarde est déjà présente.</p> : <p>Les essais compatibles seront réunis. Un conflit bloque tout l’import.</p>}
      <div className="import-confirm">
        {!candidate.preview.conflicts.length && candidate.preview.changed && <button type="button" className="primary-button" disabled={disabled} onClick={confirm}>Confirmer l’import</button>}
        <button type="button" className="text-action" disabled={disabled} onClick={() => { setError(''); try { inspect(candidate.text, candidate.filename); } catch (cause) { setError(messageOf(cause)); } }}>Actualiser l’aperçu</button>
        <button type="button" className="text-action" onClick={() => { selectionRef.current++; replaceCandidate(null); setError(''); }}>Annuler</button>
      </div>
    </div>}
    {message && <p className="transfer-message" role="status">{message}</p>}
    {error && <p className="transfer-error" role="alert">{error}</p>}
  </section>;
}
