import Link from 'next/link';
import { RouteField } from '@/components/pixel/RouteField';

export type ReaderHeaderProps = {
  breadcrumbText?: string;
  breadcrumbHref?: string;
  title: string;
  dek?: string;
  provenanceState?: string;
  metaDate?: string;
  workspaceName?: string;
  compact?: boolean;
};

export function ReaderHeader({
  breadcrumbText = '← Workspace Overview',
  breadcrumbHref = '/overview',
  title,
  dek,
  provenanceState = 'Source draft',
  metaDate = 'Active record',
  workspaceName = 'Private Workspace',
  compact = false,
}: ReaderHeaderProps) {
  return (
    <div>
      <div className="px-article-crumb">
        <Link href={breadcrumbHref}>{breadcrumbText}</Link>
      </div>

      <h1 className="px-article-title" id="article-heading" tabIndex={-1}>
        {title}
      </h1>

      {dek && <div className="px-article-dek">{dek}</div>}

      <div className="px-article-byline">
        <span className="is-cobalt">{provenanceState}</span>
        <span>&middot;</span>
        <span>{metaDate}</span>
        <span>&middot;</span>
        <span>{workspaceName}</span>
      </div>

      {!compact && <RouteField isHero />}
    </div>
  );
}
