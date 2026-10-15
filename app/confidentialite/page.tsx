import { SiteGuide } from '@/components/site-guide';
import { GUIDES } from '@/lib/site-content';
import { publicMetadata } from '@/lib/site-seo';

const guide = GUIDES.find(item => item.path === '/confidentialite')!;
export const metadata = publicMetadata(guide.path, `${guide.title} · BRAIZ`, guide.description);
export default function Page() { return <SiteGuide guide={guide} />; }
