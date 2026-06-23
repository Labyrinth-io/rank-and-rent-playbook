export default async (req, context) => {
  if (req.method !== "POST") {
    return Response.json(
      { error: "Method not allowed. Use POST." },
      { status: 405 }
    );
  }

  let payload;

  try {
    payload = await req.json();
  } catch (error) {
    return Response.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const domains = payload?.domains;

  if (!Array.isArray(domains) || domains.length === 0) {
    return Response.json(
      { error: "Request body must include a non-empty domains array." },
      { status: 400 }
    );
  }

  const cleanDomains = [...new Set(
    domains
      .filter((domain) => typeof domain === "string")
      .map((domain) => domain.trim().toLowerCase())
      .filter((domain) => domain.endsWith(".com.au"))
  )].slice(0, 500);

  if (cleanDomains.length === 0) {
    return Response.json(
      { error: "No valid .com.au domains were supplied." },
      { status: 400 }
    );
  }

  const apiKey = Netlify.env.get("GODADDY_API_KEY");
  const apiSecret = Netlify.env.get("GODADDY_API_SECRET");

  if (!apiKey || !apiSecret) {
    return Response.json(
      { error: "Missing GODADDY_API_KEY or GODADDY_API_SECRET environment variables." },
      { status: 500 }
    );
  }

  const baseUrl =
    Netlify.env.get("GODADDY_API_BASE_URL") || "https://api.ote-godaddy.com";

  try {
    const url = `${baseUrl}/v1/domains/available?checkType=FAST`;

    const godaddyResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `sso-key ${apiKey}:${apiSecret}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(cleanDomains)
    });

    const data = await godaddyResponse.json().catch(() => null);

    if (!godaddyResponse.ok && godaddyResponse.status !== 203) {
      return Response.json(
        {
          error: "GoDaddy availability request failed.",
          status: godaddyResponse.status,
          details: data
        },
        { status: godaddyResponse.status }
      );
    }

    const rawResults = Array.isArray(data?.domains)
      ? data.domains
      : Array.isArray(data)
        ? data
        : [];

    const results = rawResults.map((item) => ({
      domain: item.domain,
      available: Boolean(item.available)
    }));

    return Response.json({ results });
  } catch (error) {
    return Response.json(
      {
        error: "Unexpected server error while checking domains.",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
};

export const config = {
  path: "/api/check-domains"
};
