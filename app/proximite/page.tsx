import { SiteGuide } from '@/components/site-guide';
import { GUIDES } from '@/lib/site-content';
import { guideMetadata } from '@/lib/site-seo';

const guide = GUIDES.find(item => item.path === '/proximite')!;
export const metadata = guideMetadata(guide);
export default function Page() { return <SiteGuide guide={guide} />; }
