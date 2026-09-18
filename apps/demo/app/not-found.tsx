import Link from 'next/link';
import { Header } from '@/components/layout/Header';

export default function NotFound() {
  return (
    <div>
      <Header account={null} />
      <div className="px-page">
        <div className="px-eyebrow">404</div>
        <h1 className="px-page-title">Nothing here</h1>
        <p className="px-page-lede">
          That page is not part of this demo. <Link href="/">Back to the entrance</Link>.
        </p>
      </div>
    </div>
  );
}
