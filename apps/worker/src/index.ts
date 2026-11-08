export interface Env {
  ORIGIN_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin =
      env.ORIGIN_URL || "https://towards-judge-asks-katrina.trycloudflare.com";
    const url = new URL(request.url);
    const targetUrl = new URL(url.pathname + url.search, origin);

    // Build forwarded headers
    const newHeaders = new Headers(request.headers);
    newHeaders.set("X-Forwarded-Host", url.host);
    newHeaders.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
    newHeaders.set("Host", targetUrl.host);

    const init: RequestInit = {
      method: request.method,
      headers: newHeaders,
      redirect: "follow",
    };

    if (request.body && !["GET", "HEAD"].includes(request.method)) {
      init.body = request.body;
      // @ts-expect-error duplex required for streaming in Workers
      init.duplex = "half";
    }

    try {
      const response = await fetch(targetUrl.toString(), init);
      const resHeaders = new Headers(response.headers);
      resHeaders.set("X-Proxied-By", "CadenceLab-Cloudflare-Worker");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: resHeaders,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Origin connection error";
      return new Response(
        JSON.stringify({
          error: "Origin Gateway Error",
          message,
          origin,
          hint: "Ensure the local CadenceLab server and tunnel are active.",
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};
