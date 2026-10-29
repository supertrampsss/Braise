"use client";

import { useEffect, useState } from "react";
import { CALENDAR_REMINDER_KEY, calendarReminderFile, createCalendarReminder, dateInReminderZone, readCalendarReminder, writeCalendarReminder, type CalendarReminder } from "@/lib/calendar-reminder";
import { formatDateFr } from "@/lib/format-fr";

export function CalendarReminderControl() {
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [receipt, setReceipt] = useState<CalendarReminder | null>(null);
  const [timeZone, setTimeZone] = useState("Europe/Paris");
  const [time, setTime] = useState("19:00");
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState(30);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => {
      try {
        const state = readCalendarReminder(window.localStorage);
        setUnavailable(state.status === "unavailable");
        if (state.status === "ready") setReceipt(state.reminder);
      } catch { setUnavailable(true); }
      finally { setLoaded(true); }
    };
    // Read after mount, never request a permission, download or focus during restoration.
    const timer = window.setTimeout(() => { refresh(); setStartDate(dateInReminderZone(new Date(), "Europe/Paris")); }, 0);
    const storageChanged = (event: StorageEvent) => { if (event.key === null || event.key === CALENDAR_REMINDER_KEY) refresh(); };
    window.addEventListener("storage", storageChanged);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", storageChanged); };
  }, []);

  function downloadFile(reminder: CalendarReminder, cancelled: boolean) {
    if (!cancelled) {
      const state = readCalendarReminder(window.localStorage);
      if (state.status === "unavailable" || state.reminder?.uid !== reminder.uid || state.reminder.cancelled) throw new Error("Ce rappel a changé dans un autre onglet. Actualisez le profil avant de télécharger.");
    }
    const url = URL.createObjectURL(new Blob([calendarReminderFile(reminder, cancelled)], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = cancelled ? "braiz-rappel-arret.ics" : "braiz-rappel.ics"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function prepare() {
    setMessage(""); setError("");
    try {
      const current = readCalendarReminder(window.localStorage);
      if (current.status === "unavailable") { setUnavailable(true); throw new Error("Les données de rappel sont illisibles ou d’une version plus récente. Elles sont conservées."); }
      if (current.reminder && !current.reminder.cancelled) { setReceipt(current.reminder); throw new Error("Un rappel a déjà été préparé dans un autre onglet. Arrêtez-le avant d’en créer un autre."); }
      const instant = new Date();
      if (startDate < dateInReminderZone(instant, timeZone)) throw new Error("Choisissez une date de début aujourd’hui ou à venir dans ce fuseau.");
      const reminder = createCalendarReminder({ timeZone, time, startDate, days }, crypto.randomUUID(), instant);
      // Reject today's elapsed occurrence rather than silently shifting the requested horizon.
      const first = reminder.instants[0];
      const firstInstant = Date.parse(`${first.slice(0, 4)}-${first.slice(4, 6)}-${first.slice(6, 8)}T${first.slice(9, 11)}:${first.slice(11, 13)}:${first.slice(13, 15)}Z`);
      if (firstInstant <= instant.getTime()) throw new Error("L’heure de début est déjà passée. Choisissez demain ou une heure à venir.");
      if (!writeCalendarReminder(window.localStorage, reminder)) throw new Error("La sauvegarde du rappel est indisponible ou a changé. Aucun fichier n’a été créé.");
      setReceipt(reminder); downloadFile(reminder, false);
      setMessage("Fichier téléchargé. Ouvrez-le dans votre calendrier pour choisir de l’ajouter. BRAIZ ne peut pas vérifier cet ajout.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Le fichier n’a pas pu être préparé."); }
  }
  function stop() {
    setError(""); setMessage("");
    if (!receipt) return;
    // Local stop is immediate. It does not claim control over any calendar application.
    const cancelled = { ...receipt, cancelled: true };
    setReceipt(cancelled);
    try {
      const persisted = writeCalendarReminder(window.localStorage, cancelled);
      if (!persisted) setError("L’arrêt est appliqué ici pour cette session ; le stockage a changé ou est indisponible. Les données enregistrées sont conservées.");
    } catch { setError("L’arrêt est appliqué ici pour cette session ; le stockage est indisponible."); }
    setMessage("Rappel arrêté dans BRAIZ. Supprimez la série « Votre mot du jour — BRAIZ » dans votre calendrier pour arrêter ses alertes.");
  }

  return <details className="calendar-reminder">
    <summary>Rappel quotidien</summary>
    <p>Choisissez l’heure et ajoutez le fichier à votre calendrier. Aucun rappel n’est activé automatiquement.</p>
    <p className="calendar-removal-note">Pour arrêter les alertes, supprimez la série dans votre calendrier. Un arrêt dans BRAIZ ou un fichier d’arrêt ne supprime pas automatiquement un événement externe.</p>
    {!loaded ? <p role="status">Chargement…</p> : unavailable ? <p role="status">Les données de rappel sont illisibles ou d’une version plus récente. Elles sont conservées ; la création est indisponible.</p> : <>
      {receipt && <p>Dernier fichier : {receipt.time} · {receipt.timeZone}, du {formatDateFr(receipt.startDate)} au {formatDateFr(receipt.endDate)} ({receipt.days} jours). {receipt.cancelled ? "Arrêté dans BRAIZ." : "Préparé ; ajout au calendrier non vérifié."}</p>}
      {(!receipt || receipt.cancelled) && <div className="calendar-form">
        <label>Heure locale<input type="time" value={time} onChange={event => setTime(event.target.value)} /></label>
        <label>Fuseau IANA<input type="text" list="reminder-zones" value={timeZone} onChange={event => setTimeZone(event.target.value)} maxLength={80} placeholder="Europe/Paris" /><datalist id="reminder-zones">{["Europe/Paris", "Europe/London", "America/Montreal", "America/New_York", "Asia/Tokyo", "UTC"].map(zone => <option key={zone} value={zone} />)}</datalist></label>
        <label>Date de début<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
        <label>Durée (1 à 90 jours)<input type="number" min={1} max={90} step={1} value={days} onChange={event => setDays(Number(event.target.value))} /></label>
        <p>Un rappel chaque jour, uniquement pendant la durée choisie. L’heure suit le fuseau ; une heure doublée utilise sa première occurrence, une heure inexistante est refusée.</p>
        <button className="secondary-button" type="button" onClick={prepare}>Télécharger le rappel (.ics)</button>
      </div>}
      {receipt && <div className="profile-transfer-actions">
        {!receipt.cancelled && <button className="secondary-button" type="button" onClick={stop}>Arrêter dans BRAIZ</button>}
        {receipt.cancelled ? <button className="secondary-button" type="button" onClick={() => { try { downloadFile(receipt, true); setMessage("Fichier d’arrêt téléchargé avec la même identité. Votre calendrier peut ignorer l’annulation ; supprimez la série manuellement."); } catch { setError("Le fichier d’arrêt n’a pas pu être téléchargé. Supprimez la série dans votre calendrier."); } }}>Télécharger le fichier d’arrêt</button> : <button className="secondary-button" type="button" onClick={() => { try { downloadFile(receipt, false); setMessage("Le même fichier a été téléchargé. Évitez un second ajout si votre calendrier duplique les imports."); } catch { setError("Le fichier n’a pas pu être téléchargé."); } }}>Retélécharger le même rappel</button>}
      </div>}
    </>}
    {message && <p role="status">{message}</p>}{error && <p className="transfer-error" role="alert">{error}</p>}
  </details>;
}
