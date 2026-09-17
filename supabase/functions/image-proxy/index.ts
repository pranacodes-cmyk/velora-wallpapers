import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const R2_BASE = Deno.env.get("R2_PUBLIC_URL") || "https://pub-18077520a8e74aa2b98a5f6cbdcff2de.r2.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const externalUrl = url.searchParams.get("url");
    const path = url.pathname.replace(/^\/image-proxy\//, "").replace(/^\//, "");

    let targetUrl: string;
    if (externalUrl) {
      targetUrl = externalUrl;
    } else if (path) {
      targetUrl = `${R2_BASE}/${path}`;
    } else {
      return new Response("Missing path or url param", { status: 400, headers: corsHeaders });
    }

    console.log(`Proxying: ${targetUrl}`);

    const forwardHeaders = new Headers();
    const range = req.headers.get("range");
    if (range) {
      forwardHeaders.set("range", range);
    }

    const resp = await fetch(targetUrl, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers: forwardHeaders,
    });

    if (!resp.ok && resp.status !== 206) {
      console.error(`Upstream returned ${resp.status} for ${targetUrl}`);
      return new Response(`Not found: ${targetUrl}`, {
        status: resp.status,
        headers: {
          ...corsHeaders,
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    const ext = "." + targetUrl.split("?")[0].split(".").pop()?.toLowerCase();
    const contentType = CONTENT_TYPES[ext] || resp.headers.get("content-type") || "application/octet-stream";

    const responseHeaders = new Headers({
      ...corsHeaders,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
    });

    for (const header of ["content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
      const value = resp.headers.get(header);
      if (value) responseHeaders.set(header, value);
    }

    return new Response(req.method === "HEAD" ? null : resp.body, {
      status: resp.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
