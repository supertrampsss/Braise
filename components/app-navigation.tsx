"use client";

import { useRef, useState, type MouseEvent } from 'react';
import { CalendarDays, Flame, Infinity as InfinityIcon, Menu, Swords, UserRound, BookOpen } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

export type AppSurface = 'play' | 'explore' | 'profile';
export type AppDestination = 'daily' | 'free' | 'archives' | 'duel' | 'profile';
export const APP_NAVIGATION = [
  { destination:'daily', href:'/', label:'Mot du jour', detail:'Le même mot pour tous, jusqu’à minuit', Icon:Flame },
  { destination:'free', href:'/?mode=free', label:'Partie libre', detail:'Un mot au hasard, sans limite', Icon:InfinityIcon },
  { destination:'archives', href:'/?surface=archives', label:'Archives', detail:'Rejouer les jours passés', Icon:CalendarDays },
  { destination:'duel', href:'/duels', label:'Duel', detail:'Trois mots contre un ami', Icon:Swords },
  { destination:'profile', href:'/?surface=profile', label:'Profil', detail:'Votre progression et votre sauvegarde', Icon:UserRound },
] as const;

export function navigationBackHref(href:string) {
  return href.startsWith('/') && !href.startsWith('//') && !/[\u0000-\u0020\u007f\\]/.test(href) ? href : '/';
}

export function AppNavigation({active='play',modeName,backHref='/',onNavigate,onHelp}: {
  active?:AppSurface|AppDestination; modeName?:string; backHref?:string;
  onNavigate?:(destination:Exclude<AppDestination,'duel'>|'play')=>void;
  onHelp?:(returnFocus:HTMLButtonElement|null)=>void;
}) {
  const trigger=useRef<HTMLButtonElement>(null), navigationChosen=useRef(false);
  const [open,setOpen]=useState(false);
  function choose(destination:AppDestination|'play',event:MouseEvent<HTMLAnchorElement>) {
    if(destination!=='duel' && onNavigate && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.button===0) {
      event.preventDefault(); navigationChosen.current=open; setOpen(false); onNavigate(destination);
    }
  }
  return <header className="braiz-navigation">
    <a href={modeName ? navigationBackHref(backHref) : '/'} className="braiz-navigation-brand" aria-label="BRAIZ, accueil" onClick={event=>choose('play',event)}>BRAIZ<span aria-hidden="true">.</span></a>
    {modeName && <span className="braiz-mode-name">{modeName}</span>}
    <div className="braiz-navigation-menu"><DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild><button ref={trigger} className="braiz-menu-trigger" aria-label="Ouvrir le menu"><Menu size={20} aria-hidden="true"/></button></DropdownMenuTrigger>
      <DropdownMenuContent className="braiz-primary-menu" align="end" sideOffset={8} onCloseAutoFocus={event=>{
        if(navigationChosen.current) { event.preventDefault(); navigationChosen.current=false; }
      }}>
        <nav aria-label="Navigation principale"><DropdownMenuGroup>
          {APP_NAVIGATION.map(({destination,href,label,detail,Icon})=><DropdownMenuItem key={destination} asChild><a href={href} aria-current={active===destination?'page':undefined} onClick={event=>choose(destination,event)}><Icon className="menu-icon" size={20} aria-hidden="true"/><span className="menu-text" data-detail={detail}>{label}</span></a></DropdownMenuItem>)}
        </DropdownMenuGroup></nav>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Native navigation also serves the standalone Worker modes. */}
        <DropdownMenuSeparator/>{onHelp ? <DropdownMenuItem className="menu-rules" onSelect={()=>{navigationChosen.current=true;setOpen(false);onHelp(trigger.current);}}><BookOpen className="menu-icon" size={18} aria-hidden="true"/>Règles</DropdownMenuItem> : <DropdownMenuItem asChild className="menu-rules"><a href="/?regles=1"><BookOpen className="menu-icon" size={18} aria-hidden="true"/>Règles</a></DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu></div>
  </header>;
}
