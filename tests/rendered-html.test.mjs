import assert from "node:assert/strict";
import test from "node:test";

const stalePreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the TALQS research app shell", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /TALQS/);
  assert.match(html, /Consumer disputes, traced to source\./);
  assert.match(html, /Educational demo only\./);
  assert.match(html, /Document library/);
  assert.match(html, /Grounded Q&amp;A|Grounded Q&A/);
  assert.match(html, /Engineering/);
  assert.match(html, /Index a session document/);
  assert.match(html, /My documents/);
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.doesNotMatch(html, stalePreviewMeta);
  assert.doesNotMatch(html, /react-loading-skeleton|Your site is taking shape/);
});

test("server-renders the engineering console disclosure", async () => {
  const response = await render("/console");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Engineering console/);
  assert.match(html, /Inspect every grounding decision\./);
  assert.match(html, /Default execution: no external inference\./);
  assert.match(html, /Retriever comparison/);
  assert.match(html, /talqs-grounded-v0\.8/);
  assert.match(html, /Run with a provider credential/);
  assert.match(html, /Google Gemini/);
  assert.match(html, /Anthropic Claude/);
  assert.match(html, /Saved keys are encrypted with AES-GCM/);
  assert.doesNotMatch(html, stalePreviewMeta);
});

test("model proxy rejects unsupported providers without echoing credentials", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-model`);
  const { default: worker } = await import(workerUrl.href);
  const secret = "test-provider-key-that-must-not-be-returned";
  const response = await worker.fetch(
    new Request("http://localhost/api/model", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "arbitrary-provider",
        model: "example-model",
        apiKey: secret,
        prompt: "Grounded prompt ".repeat(10),
      }),
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 400);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.doesNotMatch(await response.text(), new RegExp(secret));
});

test("credential metadata endpoint requires authentication", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-credentials`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/credentials"),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 401);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});
