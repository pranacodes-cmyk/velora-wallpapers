import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const mocks = vi.hoisted(() => ({ log: vi.fn(), activate: vi.fn(), invoke: vi.fn() }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" } }));
vi.mock("@capgo/capacitor-facebook-analytics", () => ({ FacebookAnalytics: {
  logEvent: mocks.log, initAppEvents: mocks.activate, enableAdvertiserTracking: vi.fn(),
} }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
import { initMetaEvents, logMetaEvent } from "../src/services/meta-events";
import { trackMetaCapi } from "../src/services/meta-capi";

async function endpoint(file: string, body: unknown, authenticated = true) {
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const fetch = vi.fn();
  const code = readFileSync(file, "utf8").replace(/import \{ corsHeaders \}[^;]+;/, "const corsHeaders = {};");
  runInNewContext(ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }), {
    Deno: { env: { get: (name: string) => name === "REVENUECAT_WEBHOOK_SECRET" ? "synthetic-test-only" : undefined }, serve: (fn: typeof handler) => { handler = fn; } },
    Request, Response, fetch, console,
  });
  if (!handler) throw new Error("Handler not registered");
  const response = await handler(new Request("https://example.test", {
    method: "POST", headers: authenticated ? { authorization: "Bearer synthetic-test-only" } : {}, body: JSON.stringify(body),
  }));
  return { response, fetch };
}

describe("single subscription conversion sender", () => {
  beforeEach(() => vi.clearAllMocks());
  for (const name of ["Purchase", "fb_mobile_purchase", "Subscribe", "StartTrial"]) {
    it(`blocks ${name} in both actual client dispatchers`, async () => {
      await logMetaEvent(name);
      await trackMetaCapi(name);
      expect(mocks.log).not.toHaveBeenCalled();
      expect(mocks.invoke).not.toHaveBeenCalled();
    });
    it(`blocks old-client ${name} at the server without contacting Meta`, async () => {
      const { response, fetch } = await endpoint("supabase/functions/meta-capi/index.ts", { event_name: name });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ skipped: "revenuecat-native-meta-owns-conversions" });
      expect(fetch).not.toHaveBeenCalled();
    });
  }
  it("keeps native activation and onboarding event dispatch using installed plugin API", async () => {
    await initMetaEvents();
    await logMetaEvent("fb_mobile_complete_registration", { fb_registration_method: "onboarding" });
    expect(mocks.activate).toHaveBeenCalledTimes(1);
    expect(mocks.log).toHaveBeenCalledWith({ event: "fb_mobile_complete_registration", params: { fb_registration_method: "onboarding" } });
  });
  for (const type of ["INITIAL_PURCHASE", "RENEWAL", "TEST", "REFUND"]) {
    it(`acknowledges legacy webhook ${type} without sending a second conversion`, async () => {
      const { response, fetch } = await endpoint("supabase/functions/revenuecat-webhook/index.ts", { event: { type } });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ skipped: "revenuecat-native-meta-owns-conversions" });
      expect(fetch).not.toHaveBeenCalled();
    });
  }
  it("keeps the retired webhook authenticated", async () => {
    const { response, fetch } = await endpoint("supabase/functions/revenuecat-webhook/index.ts", {}, false);
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
});