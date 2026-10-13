import { describe, expect, it } from "vitest";
import { validateLogoUrl } from "./document-branding.js";

describe("document branding URL validation", () => {
  it("accepts public HTTPS logo URLs", () => {
    expect(validateLogoUrl("https://cdn.example.com/brand/logo.png")).toBe("https://cdn.example.com/brand/logo.png");
  });

  it.each([
    "http://cdn.example.com/logo.png",
    "https://user:pass@cdn.example.com/logo.png",
    "https://localhost/logo.png",
    "https://127.0.0.1/logo.png",
    "https://[::1]/logo.png",
    "https://cdn.example.com:8443/logo.png"
  ])("rejects unsafe or unsupported URLs: %s", (url) => {
    expect(() => validateLogoUrl(url)).toThrow();
  });
});
