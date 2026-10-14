"use client";

import { useRef, useState, type MouseEvent } from 'react';
import { Menu } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

export type AppSurface = 'play' | 'explore' | 'profile';
export const APP_NAVIGATION = [
  { surface:'play', href:'/', label:'Jouer' },
  { surface:'explore', href:'/?surface=explore', label:'Parties' },
  { surface:'profile', href:'/?surface=profile', label:'Profil' },
] as const;

export function navigationBackHref(href:string) {
  return href.startsWith('/') && !href.startsWith('//') && !/[\u0000-\u0020\u007f\\]/.test(href) ? href : '/';
}

export function AppNavigation({active='play',modeName,backHref='/',onNavigate,onHelp}: {
  active?:AppSurface; modeName?:string; backHref?:string;
  onNavigate?:(surface:AppSurface)=>void;
  onHelp?:(returnFocus:HTMLButtonElement|null)=>void;
}) {
  const trigger=useRef<HTMLButtonElement>(null), navigationChosen=useRef(false);
  const [open,setOpen]=useState(false);
  function choose(surface:AppSurface,event:MouseEvent<HTMLAnchorElement>) {
    if(onNavigate && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.button===0) {
      event.preventDefault(); navigationChosen.current=true; setOpen(false); onNavigate(surface);
    }
  }
  return <header className="braiz-navigation">
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Native navigation remains available in the controlled embed. */}
    <a href="/" className="braiz-navigation-brand" aria-label="BRAIZ, accueil" onClick={event=>choose('play',event)}>BRAIZ<span aria-hidden="true">.</span></a>
    {modeName && <span className="braiz-mode-name">{modeName}</span>}
    <div className="braiz-navigation-menu"><DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild><button ref={trigger} className="braiz-menu-trigger" aria-label="Ouvrir le menu">Menu<Menu size={20} aria-hidden="true"/></button></DropdownMenuTrigger>
      <DropdownMenuContent className="braiz-primary-menu" align="end" sideOffset={8} onCloseAutoFocus={event=>{
        if(navigationChosen.current) { event.preventDefault(); navigationChosen.current=false; }
      }}>
        <nav aria-label="Navigation principale"><DropdownMenuGroup>
          {APP_NAVIGATION.map(item=><DropdownMenuItem key={item.surface} asChild><a href={item.surface==='play' && modeName ? navigationBackHref(backHref) : item.href} aria-current={active===item.surface?'page':undefined} onClick={event=>choose(item.surface,event)}>{item.label}</a></DropdownMenuItem>)}
        </DropdownMenuGroup></nav>
        {onHelp && <><DropdownMenuSeparator/><DropdownMenuItem onSelect={()=>{navigationChosen.current=true;setOpen(false);onHelp(trigger.current);}}>Règles</DropdownMenuItem></>}
      </DropdownMenuContent>
    </DropdownMenu></div>
  </header>;
}
