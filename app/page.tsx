import Game from "@/components/game";
import { HomeGuide, JsonLd } from '@/components/site-guide';
import { gameSchema, HOME_DESCRIPTION, HOME_TITLE, publicMetadata } from '@/lib/site-seo';
export const metadata = publicMetadata('/', HOME_TITLE, HOME_DESCRIPTION);
export default function Home() { return <><Game /><HomeGuide /><JsonLd value={gameSchema()} /></>; }
