import Duels from "@/components/duels";
import { DuelGuide } from '@/components/site-guide';
import { publicMetadata } from '@/lib/site-seo';
export const metadata = publicMetadata('/duels', 'Duel BRAIZ : défiez un ami sur trois mots secrets', 'Un duel de mots en français : trois manches identiques, 30 essais par manche, sans indice. Invitez un adversaire et jouez à votre rythme pendant 48 heures.');
export default function Page() { return <><Duels /><DuelGuide /></>; }
