// akaushik.dev (and www) → akaushik.org, 308, path and query preserved.
// Mirrors the Vercel domain redirect it replaces. The target host is fixed, so
// the incoming Host never influences where the redirect points.
const TARGET = "https://akaushik.org";

export function redirectLocation(requestUrl) {
  const url = new URL(requestUrl);
  return TARGET + url.pathname + url.search;
}

export default {
  fetch(request) {
    return new Response(null, {
      status: 308,
      headers: {
        location: redirectLocation(request.url),
        "cache-control": "public, max-age=0, must-revalidate",
      },
    });
  },
};
