import { describe, expect, it } from "vitest";
import { nativeStartPath } from "@/lib/native-entry";

describe("native management entry", () => {
  it("opens the protected administration entry on a phone app", () => {
    expect(nativeStartPath(true)).toBe("/admin");
  });
  it("keeps the existing website home page in browsers", () => {
    expect(nativeStartPath(false)).toBeNull();
  });
});