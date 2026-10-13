"use client";
import { useState, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { LEGACY_ARCHIVE_START_DATE, shiftCalendarDate, isCalendarDate } from '@/lib/calendar';
import { formatDateFr } from '@/lib/format-fr';
import type { LocalPlay } from '@/lib/play-hub';
/** Filtered dates are a named list, never compacted underneath weekday columns. */
export function ArchiveDateLayout({filtered,children}:{filtered:boolean;children:ReactNode}) {
  return <>{filtered ? <p>Liste des archives correspondant au filtre</p> : <div className="calendar-weekdays" aria-hidden="true">{['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(day=><span key={day}>{day}</span>)}</div>}<div className={filtered ? "calendar-filtered-list" : "calendar-days"} role="group" aria-label={filtered ? "Liste des dates filtrées" : "Dates du mois"}>{children}</div></>;
}
export function ArchiveCalendar({max,selected,plays,disabled,onOpen}:{max:string;selected:string;plays:LocalPlay[];disabled:boolean;onOpen:(date:string)=>void}) {
  const safeSelection=isCalendarDate(selected) && selected >= LEGACY_ARCHIVE_START_DATE && selected <= max ? selected : max;
  const [month,setMonth] = useState(safeSelection.slice(0,7)), [filter,setFilter] = useState('all'), [focus,setFocus] = useState(safeSelection);
  const [previousSelection,setPreviousSelection] = useState(safeSelection);
  if (safeSelection !== previousSelection) {
    setPreviousSelection(safeSelection);setMonth(safeSelection.slice(0,7));setFocus(safeSelection);
  }
  const root = useRef<HTMLDivElement>(null);
  const first = `${month}-01`, date = new Date(`${first}T12:00:00Z`), count = new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  const state = (day:string) => { const play = plays.find(p => p.id === `daily-${day}`); return play?.game.guesses.some(g=>g.found) ? 'Terminé' : play ? 'Commencé' : 'Non joué'; };
  const days = Array.from({length:count},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`).filter(day => day >= LEGACY_ARCHIVE_START_DATE && day <= max && (filter === 'all' || state(day) === (filter === 'resume' ? 'Commencé' : filter)));
  function moveMonth(delta:number) { const value=new Date(`${first}T12:00:00Z`);value.setUTCMonth(value.getUTCMonth()+delta);setMonth(value.toISOString().slice(0,7)); }
  function keyboard(event:KeyboardEvent<HTMLButtonElement>,day:string) {
    const offset:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}; let next:string|null=null;
    if(event.key in offset) next=shiftCalendarDate(day,offset[event.key]);
    if(event.key==='Home') next=days[0]; if(event.key==='End') next=days.at(-1) ?? null;
    if(!next || next < LEGACY_ARCHIVE_START_DATE || next > max) return; event.preventDefault(); if(filter !== 'all' && !days.includes(next)) { const index=days.indexOf(day); next=days[Math.max(0,Math.min(days.length-1,index+(offset[event.key]>0?1:-1)))]; }
    setFocus(next);setMonth(next.slice(0,7));requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus());
  }
  return <div className="archive-calendar" ref={root}><div className="calendar-toolbar"><button type="button" aria-label="Mois précédent" disabled={disabled || month <= LEGACY_ARCHIVE_START_DATE.slice(0,7)} onClick={()=>moveMonth(-1)}>←</button><strong>{new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'}).format(date)}</strong><button type="button" aria-label="Mois suivant" disabled={disabled || month >= max.slice(0,7)} onClick={()=>moveMonth(1)}>→</button></div><label>Afficher <select value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">Toutes les archives</option><option value="resume">À reprendre</option><option value="Terminé">Terminées</option><option value="Non joué">Non jouées</option></select></label><p>États sur cet appareil. Flèches : un jour / une semaine ; Début et Fin : premières et dernières dates visibles.</p><ArchiveDateLayout filtered={filter!=="all"}>{filter==='all' && days.length>0 && Array.from({length:(new Date(`${days[0]}T12:00:00Z`).getUTCDay()+6)%7},(_,i)=><span key={`offset-${i}`} aria-hidden="true"/>)}{days.map(day=><button key={day} type="button" data-date={day} tabIndex={day === (days.includes(focus)?focus:days[0]) ? 0 : -1} disabled={disabled} aria-label={`${formatDateFr(day)}, ${state(day)}`} aria-pressed={day===selected} onFocus={()=>setFocus(day)} onKeyDown={event=>keyboard(event,day)} onClick={()=>onOpen(day)}><b>{filter === "all" ? Number(day.slice(-2)) : formatDateFr(day)}</b><small>{state(day) === "Commencé" ? "En cours" : state(day) === "Terminé" ? "Trouvé" : "À faire"}</small></button>)}</ArchiveDateLayout>{!days.length && <p>Aucune archive pour ce filtre ce mois-ci.</p>}</div>;
}
