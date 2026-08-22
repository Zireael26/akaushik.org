import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/canonical';
import {
  MCP_ENDPOINT,
  MCP_FALLBACK_PROTOCOL_VERSION,
  MCP_MAX_BATCH_SIZE,
  MCP_PROTOCOL_VERSION,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
  MCP_TOOLS,
} from '@/lib/mcp';
import { OPENAPI_SPEC } from '@/lib/openapi-spec';
import { SectionHead } from '@/components/pixel/SectionHead';
import { RuledRow, MatterRow } from '@/components/pixel/RuledRow';
import { ApiDocsField } from './ApiDocsField';

export const metadata: Metadata = {
  title: 'API docs',
  description:
    'Human-readable reference for the akaushik.org portfolio API — Markdown, JSON, content negotiation, and the read-only MCP server.',
  alternates: { canonical: canonical('/api/docs') },
  robots: { index: true, follow: true },
};

// Server-rendered OpenAPI viewer. Deliberately not Redoc / Swagger UI —
// those are ~150 KiB+ JS bundles and the bundle budget is already tight.

type Schema = Record<string, unknown>;

function renderType(s: Schema): string {
  if (typeof s !== 'object' || s === null) return 'unknown';
  if (typeof s['$ref'] === 'string') {
    const ref = s['$ref'] as string;
    return ref.replace('#/components/schemas/', '');
  }
  if (typeof s['type'] === 'string') return s['type'] as string;
  return 'object';
}

const METHOD_TONE: Record<string, 'cobalt' | 'amber' | 'red' | 'ink'> = {
  get: 'cobalt',
  post: 'amber',
  delete: 'red',
  options: 'ink',
  put: 'red',
  patch: 'amber',
};

function PathBlock({
  path,
  methods,
}: {
  path: string;
  methods: Record<string, Record<string, unknown>>;
}) {
  return (
    <section className="px-docs-path" id={`path-${path.replace(/[^a-z0-9]+/gi, '-')}`}>
      <h3 className="px-docs-path-head">
        <code>{path}</code>
      </h3>
      {Object.entries(methods).map(([method, op]) => {
        const summary = (op['summary'] as string) ?? '';
        const description = (op['description'] as string) ?? '';
        const responses = (op['responses'] as Record<string, Schema>) ?? {};
        const parameters = (op['parameters'] as Array<Record<string, unknown>>) ?? [];
        const requestBody = (op['requestBody'] as Schema | undefined) ?? {};
        const requestContent = (requestBody['content'] as Record<string, Schema>) ?? {};
        const requestContentTypes = Object.keys(requestContent);
        const responseEntries = Object.entries(responses);
        const hasParams = parameters.length > 0;
        const hasBody = requestContentTypes.length > 0;
        return (
          <article key={method} className="px-docs-op">
            <div className="px-docs-op-head">
              <span className={`px-docs-method is-${METHOD_TONE[method.toLowerCase() as keyof typeof METHOD_TONE] ?? 'ink'}`}>{method.toUpperCase()}</span>
              <span className="px-docs-op-summary">{summary}</span>
            </div>
            {description ? <p className="px-docs-op-desc">{description}</p> : null}
            {hasParams ? (
              <div className="px-docs-block">
                <div className="px-docs-kicker">Parameters</div>
                {parameters.map((p, i) => (
                  <RuledRow key={i} tag={p['in'] as string} last={i === parameters.length - 1 && !hasBody && responseEntries.length === 0}>
                    <code>{p['name'] as string}</code> · {renderType(p['schema'] as Schema)}
                    {p['required'] ? <span className="px-docs-required"> · required</span> : null}
                    {p['description'] ? <span> · {p['description'] as string}</span> : null}
                  </RuledRow>
                ))}
              </div>
            ) : null}
            {hasBody ? (
              <div className="px-docs-block">
                <div className="px-docs-kicker">Request body</div>
                <RuledRow tag="Body" last={responseEntries.length === 0}>
                  {requestBody['required'] ? 'Required' : 'Optional'} · <code>{requestContentTypes.join(', ')}</code>
                </RuledRow>
              </div>
            ) : null}
            <div className="px-docs-block">
              <div className="px-docs-kicker">Responses</div>
              {responseEntries.map(([code, body], idx) => {
                const desc = (body['description'] as string) ?? '';
                const content = (body['content'] as Record<string, Schema>) ?? {};
                const contentTypes = Object.keys(content);
                return (
                  <RuledRow key={code} tag={code} last={idx === responseEntries.length - 1}>
                    {desc}
                    {contentTypes.length ? <span className="px-docs-content-types"> · {contentTypes.join(', ')}</span> : null}
                  </RuledRow>
                );
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function McpToolsBlock() {
  return (
    <section className="px-docs-mcp" id="mcp-tools" aria-labelledby="mcp-heading">
      <SectionHead id="mcp-heading" heading="MCP tools." label="Stateless — Streamable HTTP" />
      <p className="px-docs-mcp-copy">
        <code>{MCP_ENDPOINT}</code> is a stateless Streamable HTTP endpoint whose current revision is <code>{MCP_PROTOCOL_VERSION}</code>. It also supports{' '}
        <code>{MCP_SUPPORTED_PROTOCOL_VERSIONS.join(', ')}</code> for this bounded tool subset; initialize echoes a supported requested revision and otherwise negotiates the current one. A later request without{' '}
        <code>MCP-Protocol-Version</code> is handled as <code>{MCP_FALLBACK_PROTOCOL_VERSION}</code>, whose batches are capped at <code>{MCP_MAX_BATCH_SIZE}</code> calls.
      </p>
      <p className="px-docs-mcp-copy">
        Every POST must use <code>Content-Type: application/json</code> and an <code>Accept</code> header listing both <code>application/json</code> and <code>text/event-stream</code>; request bodies are capped at 1 MiB before parsing. Responses with bodies use JSON. Every no-id call is dispatched as a notification without a response: a single notification or all-notification batch receives 202. This server issues no{' '}
        <code>MCP-Session-Id</code>; GET, HEAD, PUT, PATCH, DELETE, and other unsupported methods return 405, and OPTIONS returns 204.
      </p>
      <p className="px-docs-mcp-copy">
        JSON-RPC errors are <code>-32700</code> parse error, <code>-32600</code> invalid request, <code>-32601</code> method not found, <code>-32602</code> invalid params, and <code>-32603</code> internal error. Numeric request IDs must be integers. The <code>/.well-known/mcp.json</code> document is site/scanner-specific discovery metadata, not an MCP protocol-standard server card.
      </p>
      {MCP_TOOLS.map((tool) => {
        const inputSchema = tool.inputSchema as unknown as Schema;
        const outputSchema = tool.outputSchema as unknown as Schema;
        const inputProperties = (inputSchema['properties'] as Record<string, Schema>) ?? {};
        const outputProperties = (outputSchema['properties'] as Record<string, Schema>) ?? {};
        const requiredInput = (inputSchema['required'] as string[]) ?? [];
        const inputEntries = Object.entries(inputProperties);
        const outputEntries = Object.entries(outputProperties);

        return (
          <article className="px-docs-tool" key={tool.name}>
            <h3 className="px-docs-tool-head">
              <code>{tool.name}</code>
            </h3>
            <p className="px-docs-tool-desc">{tool.description}</p>
            <div className="px-docs-block">
              <div className="px-docs-kicker">Input</div>
              {inputEntries.length > 0 ? (
                inputEntries.map(([name, schema], i) => (
                  <RuledRow key={name} tag={name} last={i === inputEntries.length - 1}>
                    {requiredInput.includes(name) ? <span className="px-docs-required">required · </span> : null}
                    <code>{renderType(schema)}</code>
                  </RuledRow>
                ))
              ) : (
                <p className="px-docs-tool-desc">No arguments.</p>
              )}
            </div>
            <div className="px-docs-block">
              <div className="px-docs-kicker">Structured output</div>
              {outputEntries.map(([name, schema], i) => (
                <RuledRow key={name} tag={name} last={i === outputEntries.length - 1}>
                  <code>{renderType(schema)}</code>
                </RuledRow>
              ))}
            </div>
            <p className="px-docs-annotations">Annotations: read-only, idempotent, non-destructive, closed-world.</p>
          </article>
        );
      })}
    </section>
  );
}

function SchemaBlock({ name, schema }: { name: string; schema: Schema }) {
  const props = (schema['properties'] as Record<string, Schema>) ?? {};
  const required = (schema['required'] as string[]) ?? [];
  const entries = Object.entries(props);
  return (
    <section className="px-docs-schema" id={`schema-${name}`}>
      <h3 className="px-docs-schema-head">
        <code>{name}</code>
      </h3>
      <div className="px-docs-kicker">Properties</div>
      {entries.map(([key, value], idx) => {
        const isRequired = required.includes(key);
        return (
          <RuledRow key={key} tag={key} last={idx === entries.length - 1}>
            {isRequired ? <span className="px-docs-required">required · </span> : null}
            <code>{renderType(value)}</code>
            {value['format'] ? <span> · {value['format'] as string}</span> : null}
          </RuledRow>
        );
      })}
    </section>
  );
}

export default function ApiDocsPage() {
  const { info, servers, paths, components } = OPENAPI_SPEC;
  const schemas = (components.schemas as unknown as Record<string, Schema>) ?? {};
  const pathEntries = Object.entries(paths) as Array<[string, Record<string, Record<string, unknown>>]>;
  const schemaEntries = Object.entries(schemas);

  return (
    <main id="top" className="px-docs">
      <div className="px-docs-inner">
        <ApiDocsField />
        <header className="px-docs-head">
          <Link href="/" className="px-docs-back">
            ← Back to home
          </Link>
          <SectionHead heading={info.title} label={`OpenAPI ${OPENAPI_SPEC.openapi}`} as="h1" />
          <p className="px-docs-summary">{info.summary}</p>
          <p className="px-docs-description">{info.description}</p>
          <div className="px-docs-meta">
            <RuledRow tag="Version">
              <code>{info.version}</code>
            </RuledRow>
            <RuledRow tag="Server">
              <code>{servers[0]?.url ?? '—'}</code>
            </RuledRow>
            <RuledRow tag="Contact">
              <a href={`mailto:${info.contact.email}`}>{info.contact.email}</a>
            </RuledRow>
            <RuledRow tag="Spec" last>
              <a href="/api/openapi.json">
                <code>/api/openapi.json</code>
              </a>
            </RuledRow>
          </div>
        </header>

        <nav className="px-docs-toc" aria-label="Table of contents">
          <div className="px-docs-kicker">On this page</div>
          <div className="px-docs-toc-groups">
            <div className="px-docs-toc-group">
              <div className="px-docs-toc-label">MCP</div>
              <ul className="px-docs-toc-list">
                <li>
                  <a href="#mcp-tools">Tool contracts</a>
                </li>
              </ul>
            </div>
            <div className="px-docs-toc-group">
              <div className="px-docs-toc-label">Paths</div>
              <ul className="px-docs-toc-list">
                {pathEntries.map(([path]) => (
                  <li key={path}>
                    <a href={`#path-${path.replace(/[^a-z0-9]+/gi, '-')}`}>
                      <code>{path}</code>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-docs-toc-group">
              <div className="px-docs-toc-label">Schemas</div>
              <ul className="px-docs-toc-list">
                {schemaEntries.map(([name]) => (
                  <li key={name}>
                    <a href={`#schema-${name}`}>
                      <code>{name}</code>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="px-docs-toc-group" style={{ marginTop: 18 }}>
            <MatterRow title="/api/openapi.json" tag="Machine-readable" tagTone="cobalt" href="/api/openapi.json" />
          </div>
        </nav>

        <McpToolsBlock />

        <section className="px-docs-section" aria-labelledby="paths-heading">
          <SectionHead id="paths-heading" heading="Paths." label={`${pathEntries.length} endpoints`} />
          {pathEntries.map(([path, methods]) => (
            <PathBlock key={path} path={path} methods={methods} />
          ))}
        </section>

        <section className="px-docs-section" aria-labelledby="schemas-heading">
          <SectionHead id="schemas-heading" heading="Schemas." label={`${schemaEntries.length} definitions`} />
          {schemaEntries.map(([name, schema]) => (
            <SchemaBlock key={name} name={name} schema={schema as Schema} />
          ))}
        </section>

        <footer className="px-docs-footer">
          <p>
            Machine-readable spec at <a href="/api/openapi.json"><code>/api/openapi.json</code></a>. Advertised via{' '}
            <code>Link: rel=&quot;service-desc&quot;</code> and <code>Link: rel=&quot;service-doc&quot;</code> from every HTML response. Well-known discovery at{' '}
            <a href="/.well-known/mcp.json"><code>/.well-known/mcp.json</code></a>.
          </p>
        </footer>
      </div>
    </main>
  );
}
