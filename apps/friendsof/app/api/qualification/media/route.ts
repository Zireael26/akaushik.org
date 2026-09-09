export const dynamic = 'force-dynamic';

const TEST_MEDIA_PAYLOAD = new TextEncoder().encode(
  'QUALIFICATION-MEDIA-PAYLOAD-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
);
const TEST_ETAG = '"qual-test-media-v1"';

export async function HEAD(request: Request) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_QUALIFICATION_ENDPOINTS !== 'true') {
    return new Response('Not Found', { status: 404 });
  }

  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch === TEST_ETAG) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: TEST_ETAG,
        'Cache-Control': 'private, no-store, must-revalidate',
      },
    });
  }

  return new Response(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(TEST_MEDIA_PAYLOAD.length),
      ETag: TEST_ETAG,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-store, must-revalidate',
    },
  });
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_QUALIFICATION_ENDPOINTS !== 'true') {
    return new Response('Not Found', { status: 404 });
  }

  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch === TEST_ETAG) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: TEST_ETAG,
        'Cache-Control': 'private, no-store, must-revalidate',
      },
    });
  }

  const rangeHeader = request.headers.get('range');

  // RFC 9110: Unknown unit or multiple ranges (comma-separated) MUST be ignored -> serve full 200
  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    const rawRange = rangeHeader.slice('bytes='.length).trim();

    // Multi-range policy: ignore and serve full 200
    if (rawRange.includes(',')) {
      return new Response(TEST_MEDIA_PAYLOAD, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(TEST_MEDIA_PAYLOAD.length),
          ETag: TEST_ETAG,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, no-store, must-revalidate',
        },
      });
    }

    const parts = rawRange.split('-');
    const startStr = parts[0]?.trim();
    const endStr = parts[1]?.trim();

    let start = 0;
    let end = TEST_MEDIA_PAYLOAD.length - 1;

    // Suffix range (e.g., bytes=-10)
    if (startStr === '' && endStr) {
      const suffixLen = parseInt(endStr, 10);
      if (Number.isNaN(suffixLen) || suffixLen <= 0) {
        // Unsatisfiable range -> 416
        return new Response(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${TEST_MEDIA_PAYLOAD.length}`,
            'Cache-Control': 'private, no-store, must-revalidate',
          },
        });
      }
      start = Math.max(0, TEST_MEDIA_PAYLOAD.length - suffixLen);
      end = TEST_MEDIA_PAYLOAD.length - 1;
    } else if (startStr) {
      start = parseInt(startStr, 10);
      if (endStr) {
        end = parseInt(endStr, 10);
      }
    } else {
      // Malformed range without numbers -> ignore -> 200
      return new Response(TEST_MEDIA_PAYLOAD, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(TEST_MEDIA_PAYLOAD.length),
          ETag: TEST_ETAG,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, no-store, must-revalidate',
        },
      });
    }

    // Check satisfiability
    if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || start > end || start >= TEST_MEDIA_PAYLOAD.length) {
      return new Response(null, {
        status: 416,
        headers: {
          'Content-Range': `bytes */${TEST_MEDIA_PAYLOAD.length}`,
          'Cache-Control': 'private, no-store, must-revalidate',
        },
      });
    }

    // Clamp end
    const clampedEnd = Math.min(end, TEST_MEDIA_PAYLOAD.length - 1);
    const slice = TEST_MEDIA_PAYLOAD.slice(start, clampedEnd + 1);

    return new Response(slice, {
      status: 206,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${start}-${clampedEnd}/${TEST_MEDIA_PAYLOAD.length}`,
        'Content-Length': String(slice.length),
        ETag: TEST_ETAG,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-store, must-revalidate',
      },
    });
  }

  return new Response(TEST_MEDIA_PAYLOAD, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(TEST_MEDIA_PAYLOAD.length),
      ETag: TEST_ETAG,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-store, must-revalidate',
    },
  });
}
