import { test, expect } from "@playwright/test";
import { errorDetail } from "../src/lib/error-detail";

test("error screen names the failure: client message, or server digest only", () => {
  expect(errorDetail(new TypeError("x is undefined"))).toBe("TypeError: x is undefined");
  const server = Object.assign(new Error("redacted"), { digest: "123abc" });
  expect(errorDetail(server)).toBe("Código do servidor: 123abc");
  expect(errorDetail(new Error("a".repeat(500))).length).toBeLessThan(260);
});
