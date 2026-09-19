import Link from 'next/link';
import { Header } from '@/components/layout/Header';

export default function NotFound() {
  return (
    <div>
      <Header reader={null} />
      <div className="px-page">
        <div className="px-eyebrow">404</div>
        <h1 className="px-page-title">Nothing here</h1>
        <p className="px-page-lede">
          That page is not part of the course. <Link href="/contents">Back to the contents</Link>.
        </p>
      </div>
    </div>
  );
}
