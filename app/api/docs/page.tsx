import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'API docs',
  description:
    'Human-readable reference for the akaushik.org portfolio API — Markdown, JSON, content negotiation, and the read-only MCP server.',
  alternates: { canonical: canonical('/api/docs') },
  robots: { index: true, follow: true },
};

// Server-rendered OpenAPI viewer. Deliberately not Redoc / Swagger UI —
// those are ~150 KiB+ JS bundles and the bundle budget is already tight.
// This page is JSX-only; no client JS leaves the server.

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

function PathBlock({
  path,
  methods,
}: {
  path: string;
  methods: Record<string, Record<string, unknown>>;
}) {
  return (
    <section className="api-docs-path" id={`path-${path.replace(/[^a-z0-9]+/gi, '-')}`}>
      <h3>
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
        return (
          <article key={method} className="api-docs-op">
            <p className="api-docs-op-summary">
              <strong>{method.toUpperCase()}</strong> · {summary}
            </p>
            {description ? <p className="api-docs-op-description">{description}</p> : null}
            {parameters.length > 0 ? (
              <div className="api-docs-params">
                <p className="api-docs-section-label">Parameters</p>
                <ul>
                  {parameters.map((p, i) => (
                    <li key={i}>
                      <code>{p['name'] as string}</code> · {p['in'] as string} ·{' '}
                      {renderType(p['schema'] as Schema)}
                      {p['required'] ? (
                        <span className="api-docs-required"> (required)</span>
                      ) : null}
                      {p['description'] ? <span> · {p['description'] as string}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {requestContentTypes.length > 0 ? (
              <div className="api-docs-params">
                <p className="api-docs-section-label">Request body</p>
                <p>
                  {requestBody['required'] ? 'Required' : 'Optional'} ·{' '}
                  <code>{requestContentTypes.join(', ')}</code>
                </p>
              </div>
            ) : null}
            <div className="api-docs-responses">
              <p className="api-docs-section-label">Responses</p>
              <ul>
                {Object.entries(responses).map(([code, body]) => {
                  const desc = (body['description'] as string) ?? '';
                  const content = (body['content'] as Record<string, Schema>) ?? {};
                  const contentTypes = Object.keys(content);
                  return (
                    <li key={code}>
                      <code>{code}</code> · {desc}
                      {contentTypes.length ? (
                        <span className="api-docs-content-types"> ({contentTypes.join(', ')})</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function McpToolsBlock() {
  return (
    <section className="api-docs-paths" id="mcp-tools">
      <h2>MCP tools</h2>
      <p className="api-docs-description">
        <code>{MCP_ENDPOINT}</code> is a stateless Streamable HTTP endpoint whose current revision
        is <code>{MCP_PROTOCOL_VERSION}</code>. It also supports{' '}
        <code>{MCP_SUPPORTED_PROTOCOL_VERSIONS.join(', ')}</code> for this bounded tool subset;
        initialize echoes a supported requested revision and otherwise negotiates the current one. A
        later request without <code>MCP-Protocol-Version</code> is handled as{' '}
        <code>{MCP_FALLBACK_PROTOCOL_VERSION}</code>, whose batches are capped at{' '}
        <code>{MCP_MAX_BATCH_SIZE}</code> calls.
      </p>
      <p className="api-docs-description">
        Every POST must use <code>Content-Type: application/json</code> and an <code>Accept</code>{' '}
        header listing both <code>application/json</code> and <code>text/event-stream</code>; request
        bodies are capped at 1 MiB before parsing.
        Responses with bodies use JSON. Every no-id call is dispatched as a notification without a
        response: a single notification or all-notification batch receives 202.
        This server issues no <code>MCP-Session-Id</code>; GET, HEAD, PUT, PATCH, DELETE, and other
        unsupported methods return 405, and OPTIONS returns 204.
      </p>
      <p className="api-docs-description">
        JSON-RPC errors are <code>-32700</code> parse error, <code>-32600</code> invalid request,{' '}
        <code>-32601</code> method not found, <code>-32602</code> invalid params, and{' '}
        <code>-32603</code> internal error. Numeric request IDs must be integers. The{' '}
        <code>/.well-known/mcp.json</code> document is site/scanner-specific discovery metadata, not
        an MCP protocol-standard server card.
      </p>
      {MCP_TOOLS.map((tool) => {
        const inputSchema = tool.inputSchema as unknown as Schema;
        const outputSchema = tool.outputSchema as unknown as Schema;
        const inputProperties = (inputSchema['properties'] as Record<string, Schema>) ?? {};
        const outputProperties = (outputSchema['properties'] as Record<string, Schema>) ?? {};
        const requiredInput = (inputSchema['required'] as string[]) ?? [];

        return (
          <article className="api-docs-op" key={tool.name}>
            <h3>
              <code>{tool.name}</code>
            </h3>
            <p className="api-docs-op-description">{tool.description}</p>
            <div className="api-docs-params">
              <p className="api-docs-section-label">Input</p>
              {Object.keys(inputProperties).length > 0 ? (
                <ul>
                  {Object.entries(inputProperties).map(([name, schema]) => (
                    <li key={name}>
                      <code>{name}</code>
                      {requiredInput.includes(name) ? (
                        <span className="api-docs-required"> (required)</span>
                      ) : null}{' '}
                      · <code>{renderType(schema)}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No arguments.</p>
              )}
            </div>
            <div className="api-docs-responses">
              <p className="api-docs-section-label">Structured output</p>
              <ul>
                {Object.entries(outputProperties).map(([name, schema]) => (
                  <li key={name}>
                    <code>{name}</code> · <code>{renderType(schema)}</code>
                  </li>
                ))}
              </ul>
            </div>
            <p className="api-docs-op-description">
              Annotations: read-only, idempotent, non-destructive, closed-world.
            </p>
          </article>
        );
      })}
    </section>
  );
}

function SchemaBlock({ name, schema }: { name: string; schema: Schema }) {
  const props = (schema['properties'] as Record<string, Schema>) ?? {};
  const required = (schema['required'] as string[]) ?? [];
  return (
    <section className="api-docs-schema" id={`schema-${name}`}>
      <h3>
        <code>{name}</code>
      </h3>
      <p className="api-docs-section-label">Properties</p>
      <ul>
        {Object.entries(props).map(([key, value]) => {
          const isRequired = required.includes(key);
          return (
            <li key={key}>
              <code>{key}</code>
              {isRequired ? <span className="api-docs-required"> (required)</span> : null} ·{' '}
              <code>{renderType(value)}</code>
              {value['format'] ? <span> · format: {value['format'] as string}</span> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function ApiDocsPage() {
  const { info, servers, paths, components } = OPENAPI_SPEC;
  const schemas = (components.schemas as unknown as Record<string, Schema>) ?? {};
  const pathEntries = Object.entries(paths) as Array<
    [string, Record<string, Record<string, unknown>>]
  >;
  return (
    <main id="top" className="api-docs">
      <div className="api-docs-inner">
        <header className="api-docs-header">
          <p className="api-docs-eyebrow">OpenAPI 3.1</p>
          <h1>{info.title}</h1>
          <p className="api-docs-summary">{info.summary}</p>
          <p className="api-docs-description">{info.description}</p>
          <ul className="api-docs-meta">
            <li>
              <strong>Version</strong> · <code>{info.version}</code>
            </li>
            <li>
              <strong>Server</strong> · <code>{servers[0]?.url ?? '—'}</code>
            </li>
            <li>
              <strong>Contact</strong> ·{' '}
              <a href={`mailto:${info.contact.email}`}>{info.contact.email}</a>
            </li>
            <li>
              <strong>Machine-readable</strong> ·{' '}
              <a href="/api/openapi.json">
                <code>/api/openapi.json</code>
              </a>
            </li>
          </ul>
        </header>

        <nav className="api-docs-toc" aria-label="Table of contents">
          <p className="api-docs-section-label">Paths</p>
          <ul>
            {pathEntries.map(([path]) => (
              <li key={path}>
                <a href={`#path-${path.replace(/[^a-z0-9]+/gi, '-')}`}>
                  <code>{path}</code>
                </a>
              </li>
            ))}
          </ul>
          <p className="api-docs-section-label">Schemas</p>
          <ul>
            {Object.keys(schemas).map((name) => (
              <li key={name}>
                <a href={`#schema-${name}`}>
                  <code>{name}</code>
                </a>
              </li>
            ))}
          </ul>
          <p className="api-docs-section-label">MCP</p>
          <ul>
            <li>
              <a href="#mcp-tools">Tool contracts</a>
            </li>
          </ul>
        </nav>

        <McpToolsBlock />

        <section className="api-docs-paths">
          <h2>Paths</h2>
          {pathEntries.map(([path, methods]) => (
            <PathBlock key={path} path={path} methods={methods} />
          ))}
        </section>

        <section className="api-docs-schemas">
          <h2>Schemas</h2>
          {Object.entries(schemas).map(([name, schema]) => (
            <SchemaBlock key={name} name={name} schema={schema} />
          ))}
        </section>
      </div>
    </main>
  );
}
