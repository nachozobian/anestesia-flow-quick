import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const ALLOWED_ORIGINS = ["*"];

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, x-client-info, apikey",
    "Vary": "Origin",
  };
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 405, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  try {
    const apiKey = Deno.env.get("AWS_CHAT_API_KEY");
    if (!apiKey) {
      console.error("AWS_CHAT_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing AWS_CHAT_API_KEY" }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => null);
    const sessionId = body?.sessionId;
    const message = body?.message;

    if ((sessionId === undefined || sessionId === null) || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid payload. Expect { sessionId, message }" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    const payload = { sessionId, message };
    const upstreamUrl = "https://qudiff7j24.execute-api.eu-west-1.amazonaws.com/api-dev/chat";

    // Retry utility with exponential backoff
    const maxAttempts = 3;
    const baseDelayMs = 600;
    let lastErr: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);

        console.log(`Attempt ${attempt}: Calling AWS agent`, { sessionId, messageLength: message.length });

        const res = await fetch(upstreamUrl, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        const text = await res.text();
        const contentType = res.headers.get("content-type") ?? "application/json";

        console.log(`AWS response status: ${res.status}`);

        // Retry on 5xx errors
        if (!res.ok && res.status >= 500) {
          throw new Error(`Upstream ${res.status}: ${text}`);
        }

        // Pass through the response
        return new Response(text, {
          status: res.status,
          headers: {
            ...headers,
            "Content-Type": contentType,
            "x-upstream-status": String(res.status),
          },
        });
      } catch (err) {
        lastErr = err;
        console.error(`Attempt ${attempt} failed:`, err);
        
        // Retry only on network errors or 5xx
        if (attempt < maxAttempts) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }
    }

    console.error("All retry attempts failed:", lastErr);
    return new Response(
      JSON.stringify({ 
        error: "Bad gateway to AWS agent",
        details: lastErr instanceof Error ? lastErr.message : "Unknown error"
      }),
      {
        status: 502,
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "x-error-source": "aws-upstream",
        },
      },
    );
  } catch (e) {
    console.error("Unexpected error in relay-aws-agent:", e);
    return new Response(
      JSON.stringify({ 
        error: "Unexpected server error",
        details: e instanceof Error ? e.message : "Unknown error"
      }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }
});
