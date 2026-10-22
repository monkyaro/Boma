import { describe, expect, it } from "vitest";
import { nextGeographyCode } from "./geography";

describe("nextGeographyCode", () => {
  it("numbers regions from 01", () => {
    expect(nextGeographyCode([])).toBe("01");
    expect(nextGeographyCode(["01", "04", "02"])).toBe("05");
  });

  it("prefixes children with the parent code and ignores other codes", () => {
    expect(nextGeographyCode([], "03")).toBe("0301");
    expect(nextGeographyCode(["0301", "0309", "LEGACY"], "03")).toBe("0310");
  });
});
