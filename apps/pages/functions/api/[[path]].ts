interface Env {
  API: Fetcher;
}
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  // Preserve the browser origin and cookies through a private service binding.
  // The API validates the user's session; this gateway grants no identity.
  const headers = new Headers(request.headers);
  headers.delete("Cf-Access-Jwt-Assertion");
  const response = await env.API.fetch(new Request(request, { headers }));
  const result = new Response(response.body, response);
  result.headers.set("Cache-Control", "no-store");
  result.headers.set("Referrer-Policy", "no-referrer");
  return result;
};
