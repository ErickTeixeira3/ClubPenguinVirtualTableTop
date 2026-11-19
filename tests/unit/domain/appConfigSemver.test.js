import { describe, expect, it } from "vitest";
import { CLIENT_VERSION } from "../../../src/domain/constants.js";
import {
  compareSemver,
  isClientVersionOutdated,
  parseSemver
} from "../../../src/domain/models/appConfig.js";

describe("appConfig semver helpers", () => {
  it("expõe CLIENT_VERSION semver válido", () => {
    expect(parseSemver(CLIENT_VERSION)).not.toBeNull();
  });

  it("faz parse e comparação semver incluindo prerelease e patches", () => {
    expect(parseSemver("2.0.0")).toEqual({ major: 2, minor: 0, patch: 0, prerelease: [] });
    expect(parseSemver("2.1.3-beta.1")).toEqual({
      major: 2,
      minor: 1,
      patch: 3,
      prerelease: ["beta", "1"]
    });
    expect(parseSemver("v2.0.0")).toBeNull();
    expect(parseSemver(null)).toBeNull();

    expect(compareSemver("2.0.0", "2.0.0")).toBe(0);
    expect(compareSemver("2.0.1", "2.0.0")).toBe(1);
    expect(compareSemver("2.0.0", "2.1.0")).toBe(-1);
    expect(compareSemver("2.0.0-alpha.1", "2.0.0-alpha.2")).toBe(-1);
    expect(compareSemver("2.0.0-alpha.1", "2.0.0")).toBe(-1);
    expect(compareSemver("2.0.0-1", "2.0.0-alpha")).toBe(-1);
    expect(() => compareSemver("bad", "2.0.0")).toThrow(/valid semver/);
  });

  it("detecta versão desatualizada sem falsos positivos em entradas inválidas", () => {
    expect(isClientVersionOutdated("1.9.9", "2.0.0")).toBe(true);
    expect(isClientVersionOutdated("2.0.0", "2.0.0")).toBe(false);
    expect(isClientVersionOutdated("2.1.0", "2.0.0")).toBe(false);
    expect(isClientVersionOutdated("2.0.0-rc.1", "2.0.0")).toBe(true);
    expect(isClientVersionOutdated("2.0.0", "not-semver")).toBe(false);
    expect(isClientVersionOutdated(null, "2.0.0")).toBe(false);
  });
});
