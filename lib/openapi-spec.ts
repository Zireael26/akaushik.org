// OpenAPI 3.1 specification for the portfolio's public API surface.
//
// Single source of truth shared by /api/openapi.json (machine-readable JSON
// response) and /api/docs (human-readable HTML page). Keep the spec literal
// hand-written — the surface is small and intentional; generating from
// route scans would add complexity without buying type safety.

import {
  MCP_FALLBACK_PROTOCOL_VERSION,
  MCP_PROTOCOL_VERSION,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
} from './mcp';

const SITE = 'https://akaushik.org';

export const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'akaushik.org portfolio API',
    summary: 'Read-only access to portfolio content through Markdown, JSON, and MCP.',
    description:
      'The portfolio exposes its content for agent consumption via five surfaces: (1) the full-corpus Markdown at /llms-full.txt, (2) per-page Markdown alternates at /work/<slug>.md and /writing/<slug>.md, (3) JSON listings at /api/writing and /api/case-studies, (4) HTTP content negotiation on /work/<slug> and /writing/<slug> via `Accept: text/markdown`, and (5) a stateless read-only MCP endpoint at /api/mcp.',
    version: '1.0.0',
    contact: {
      name: 'Abhishek Kaushik',
      email: 'hello@akaushik.org',
      url: SITE,
    },
    license: { name: 'All rights reserved' },
  },
  servers: [{ url: SITE }],
  paths: {
    '/llms.txt': {
      get: {
        summary: 'Short-form site digest (llmstxt.org format)',
        responses: {
          '200': {
            description: 'Markdown digest',
            content: { 'text/markdown': { schema: { type: 'string' } } },
          },
        },
      },
    },
    '/llms-full.txt': {
      get: {
        summary: 'Full portfolio corpus, concatenated',
        responses: {
          '200': {
            description: 'Markdown corpus',
            content: { 'text/markdown': { schema: { type: 'string' } } },
          },
        },
      },
    },
    '/api/writing': {
      get: {
        summary: 'List writing posts',
        responses: {
          '200': {
            description: 'Newest-first list of writing posts',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WritingList' },
              },
            },
          },
        },
      },
    },
    '/api/case-studies': {
      get: {
        summary: 'List case studies',
        responses: {
          '200': {
            description: 'Curated order list of case studies',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CaseStudyList' },
              },
            },
          },
        },
      },
    },
    '/api/mcp': {
      post: {
        summary: 'Call the stateless MCP server over Streamable HTTP',
        description: `Accepts one JSON-RPC 2.0 request or notification for ${MCP_PROTOCOL_VERSION} and 2025-06-18. The ${MCP_FALLBACK_PROTOCOL_VERSION} compatibility path also accepts non-empty JSON-RPC batches. Initialize echoes a supported requested revision and otherwise negotiates ${MCP_PROTOCOL_VERSION}. Later requests without MCP-Protocol-Version are handled as ${MCP_FALLBACK_PROTOCOL_VERSION}. The server is stateless and never issues MCP-Session-Id.`,
        parameters: [
          {
            name: 'Accept',
            in: 'header',
            required: true,
            description:
              'Must list both application/json and text/event-stream, even though this server answers POST requests with application/json.',
            schema: { type: 'string' },
            example: 'application/json, text/event-stream',
          },
          {
            name: 'MCP-Protocol-Version',
            in: 'header',
            required: false,
            description: `Required by clients after initialization. Explicit values must be supported; when omitted, this stateless server applies the ${MCP_FALLBACK_PROTOCOL_VERSION} compatibility fallback.`,
            schema: { type: 'string', enum: MCP_SUPPORTED_PROTOCOL_VERSIONS },
          },
          {
            name: 'Origin',
            in: 'header',
            required: false,
            description:
              'May be omitted by server clients. When present, it must be the canonical origin.',
            schema: { type: 'string', const: SITE },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  { $ref: '#/components/schemas/McpJsonRpcRequest' },
                  {
                    type: 'array',
                    minItems: 1,
                    description: `Accepted only for ${MCP_FALLBACK_PROTOCOL_VERSION}.`,
                    items: { $ref: '#/components/schemas/McpJsonRpcRequest' },
                  },
                ],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'JSON-RPC response for initialize, ping, tools/list, or tools/call',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/McpJsonRpcResponse' },
                    {
                      type: 'array',
                      minItems: 1,
                      items: { $ref: '#/components/schemas/McpJsonRpcResponse' },
                    },
                  ],
                },
              },
            },
          },
          '202': { description: 'Initialized notification accepted; no response body' },
          '400': {
            description:
              'Malformed JSON (-32700), invalid JSON-RPC envelope (-32600), or unsupported explicit protocol version (-32602)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/McpJsonRpcResponse' },
              },
            },
          },
          '403': {
            description: 'Origin is present and does not match the canonical origin',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/McpJsonRpcResponse' },
              },
            },
          },
          '406': {
            description:
              'Accept does not list both application/json and text/event-stream (-32600)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/McpJsonRpcResponse' },
              },
            },
          },
          '415': {
            description: 'Content-Type is not application/json',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/McpJsonRpcResponse' },
              },
            },
          },
        },
      },
      get: {
        summary: 'Streaming GET is not supported',
        description:
          'This stateless server does not expose a server-initiated SSE stream, so GET always returns HTTP 405.',
        responses: {
          '405': {
            description: 'Method not allowed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/McpJsonRpcResponse' },
              },
            },
          },
        },
      },
      delete: {
        summary: 'Session deletion is not supported',
        description: 'The MCP server is stateless and never issues session identifiers.',
        responses: {
          '405': {
            description: 'Method not allowed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/McpJsonRpcResponse' },
              },
            },
          },
        },
      },
      options: {
        summary: 'Describe same-origin HTTP capabilities',
        responses: {
          '204': { description: 'Capability response with no body' },
          '403': {
            description: 'Origin is present and does not match the canonical origin',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/McpJsonRpcResponse' },
              },
            },
          },
        },
      },
    },
    '/writing/{slug}.md': {
      get: {
        summary: 'Writing post as Markdown',
        description:
          'Pattern B (suffix). Equivalent to GET /writing/{slug} with Accept: text/markdown (Pattern A, RFC 7231 content negotiation).',
        parameters: [
          {
            name: 'slug',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Post Markdown',
            content: { 'text/markdown': { schema: { type: 'string' } } },
          },
          '404': { description: 'Slug not found' },
        },
      },
    },
    '/work/{slug}.md': {
      get: {
        summary: 'Case study as Markdown',
        description:
          'Pattern B (suffix). Equivalent to GET /work/{slug} with Accept: text/markdown (Pattern A, RFC 7231 content negotiation).',
        parameters: [
          {
            name: 'slug',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Case study Markdown',
            content: { 'text/markdown': { schema: { type: 'string' } } },
          },
          '404': { description: 'Slug not found' },
        },
      },
    },
    '/': {
      get: {
        summary: 'Home page',
        description:
          'HTML by default. With Accept: text/markdown the server rewrites to /llms.txt (short-form digest).',
        responses: {
          '200': {
            description: 'HTML home page or Markdown digest (content-negotiated)',
            content: {
              'text/html': { schema: { type: 'string' } },
              'text/markdown': { schema: { type: 'string' } },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      WritingPost: {
        type: 'object',
        required: ['slug', 'title', 'dek', 'date', 'url', 'markdown'],
        properties: {
          slug: { type: 'string' },
          title: { type: 'string' },
          dek: { type: 'string' },
          date: { type: 'string', format: 'date' },
          readingTime: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          markdown: { type: 'string', format: 'uri' },
        },
      },
      WritingList: {
        type: 'object',
        required: ['count', 'posts'],
        properties: {
          count: { type: 'integer' },
          posts: {
            type: 'array',
            items: { $ref: '#/components/schemas/WritingPost' },
          },
        },
      },
      CaseStudy: {
        type: 'object',
        required: ['slug', 'title', 'dek', 'role', 'year', 'stack', 'url', 'markdown'],
        properties: {
          slug: { type: 'string' },
          title: { type: 'string' },
          dek: { type: 'string' },
          index: { type: 'string' },
          tag: { type: 'string' },
          year: { type: 'string' },
          role: { type: 'string' },
          stack: { type: 'array', items: { type: 'string' } },
          evidenceOf: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          markdown: { type: 'string', format: 'uri' },
        },
      },
      CaseStudyList: {
        type: 'object',
        required: ['count', 'caseStudies'],
        properties: {
          count: { type: 'integer' },
          caseStudies: {
            type: 'array',
            items: { $ref: '#/components/schemas/CaseStudy' },
          },
        },
      },
      McpJsonRpcRequest: {
        type: 'object',
        required: ['jsonrpc', 'method'],
        properties: {
          jsonrpc: { type: 'string', const: '2.0' },
          id: {
            description:
              'Required for requests and omitted for notifications. Numeric IDs must be integers.',
            oneOf: [{ type: 'string' }, { type: 'integer' }],
          },
          method: {
            type: 'string',
            enum: ['initialize', 'ping', 'notifications/initialized', 'tools/list', 'tools/call'],
          },
          params: { type: 'object' },
        },
        additionalProperties: true,
      },
      McpJsonRpcResponse: {
        description: 'A JSON-RPC 2.0 success or error response.',
        oneOf: [
          { $ref: '#/components/schemas/McpJsonRpcSuccessResponse' },
          { $ref: '#/components/schemas/McpJsonRpcErrorResponse' },
        ],
      },
      McpJsonRpcSuccessResponse: {
        type: 'object',
        required: ['jsonrpc', 'id', 'result'],
        properties: {
          jsonrpc: { type: 'string', const: '2.0' },
          id: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
          result: { type: 'object' },
        },
        additionalProperties: false,
      },
      McpJsonRpcErrorResponse: {
        type: 'object',
        required: ['jsonrpc', 'id', 'error'],
        properties: {
          jsonrpc: { type: 'string', const: '2.0' },
          id: {
            oneOf: [{ type: 'string' }, { type: 'integer' }, { type: 'null' }],
          },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'integer',
                description:
                  '-32700 parse error; -32600 invalid request; -32601 method not found; -32602 invalid params; -32603 internal error.',
                enum: [-32700, -32600, -32601, -32602, -32603],
              },
              message: { type: 'string' },
              data: {},
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      McpToolResult: {
        type: 'object',
        required: ['content', 'isError'],
        properties: {
          content: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type', 'text'],
              properties: {
                type: { type: 'string', const: 'text' },
                text: { type: 'string' },
              },
              additionalProperties: false,
            },
          },
          structuredContent: { type: 'object' },
          isError: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  },
} as const;
