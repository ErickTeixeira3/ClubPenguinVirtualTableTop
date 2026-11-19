import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../../../src/domain/errors.js";
import {
  EMPTY_IMAGE_REF,
  fromDoc,
  fromImageRefDoc,
  normalizeImageRef,
  toDoc,
  toImageRefDoc,
  validateImageRef
} from "../../../../src/domain/models/imageRef.js";

describe("domain/models/imageRef", () => {
  it("exposes frozen EMPTY_IMAGE_REF and normalizes non-objects/nulls", () => {
    expect(Object.isFrozen(EMPTY_IMAGE_REF)).toBe(true);
    expect(EMPTY_IMAGE_REF).toEqual({ mediaId: null, url: null });
    expect(normalizeImageRef(null)).toEqual({ mediaId: null, url: null });
    expect(normalizeImageRef(undefined)).toEqual({ mediaId: null, url: null });
    expect(normalizeImageRef([])).toEqual({ mediaId: null, url: null });
    expect(normalizeImageRef("https://example.com/a.png")).toEqual({
      mediaId: null,
      url: null
    });
  });

  it("trims valid strings, clears whitespace-only strings, and preserves non-string invalid values", () => {
    expect(normalizeImageRef({ mediaId: "  med_1  ", url: "   " })).toEqual({
      mediaId: "med_1",
      url: null
    });
    expect(normalizeImageRef({ mediaId: 123, url: 456 })).toEqual({
      mediaId: 123,
      url: 456
    });
    expect(
      normalizeImageRef({
        mediaId: "med_1",
        url: "https://example.com/a.png"
      })
    ).toEqual({
      mediaId: "med_1",
      url: "https://example.com/a.png"
    });
  });

  it("validates §6.3.5 max-one non-null, mediaId format, and http(s) url format", () => {
    expect(validateImageRef({ mediaId: null, url: null })).toEqual({
      ok: true,
      errors: []
    });
    expect(validateImageRef({ mediaId: "med_1", url: null }).ok).toBe(true);
    expect(
      validateImageRef({ mediaId: null, url: "https://cdn.site/img.webp" }).ok
    ).toBe(true);
    expect(
      validateImageRef({ mediaId: null, url: "http://cdn.site/img.png" }).ok
    ).toBe(true);

    expect(validateImageRef(null).errors[0].code).toBe(
      ERROR_CODES.INVALID_IMAGE_REF
    );
    expect(validateImageRef([]).ok).toBe(false);

    const both = validateImageRef(
      { mediaId: "med_1", url: "https://cdn.site/a.png" },
      { fieldName: "avatar" }
    );
    expect(both.ok).toBe(false);
    expect(both.errors[0].code).toBe(ERROR_CODES.INVALID_IMAGE_REF);
    expect(both.errors[0].details.field).toBe("avatar");

    expect(validateImageRef({ mediaId: "bad/id", url: null }).ok).toBe(false);
    expect(validateImageRef({ mediaId: "bad id", url: null }).ok).toBe(false);
    expect(validateImageRef({ mediaId: "bad\nid", url: null }).ok).toBe(false);
    expect(validateImageRef({ mediaId: 42, url: null }).ok).toBe(false);

    expect(
      validateImageRef({ mediaId: null, url: "data:image/png;base64,AAA" }).ok
    ).toBe(false);
    expect(
      validateImageRef({ mediaId: null, url: "javascript:alert(1)" }).ok
    ).toBe(false);
    expect(
      validateImageRef({ mediaId: null, url: "https://ex ample.com/a.png" }).ok
    ).toBe(false);
    expect(
      validateImageRef({ mediaId: null, url: "https://ex\u0007.com/a.png" }).ok
    ).toBe(false);
    expect(
      validateImageRef({ mediaId: null, url: "https://[" }).ok
    ).toBe(false);
    expect(validateImageRef({ mediaId: null, url: 99 }).ok).toBe(false);
  });

  it("converts v1 legacy fields via fromDoc with mediaId priority and avatarRemoved support", () => {
    expect(fromDoc(null)).toEqual({ mediaId: null, url: null });
    expect(
      fromDoc({
        avatarRemoved: true,
        photoURL: "https://example.com/old.png"
      })
    ).toEqual({ mediaId: null, url: null });

    expect(
      fromDoc({
        avatarMediaId: "med_99",
        photoURL: "https://example.com/old.png"
      })
    ).toEqual({ mediaId: "med_99", url: null });

    expect(fromDoc({ imageMediaId: "  med_7  " })).toEqual({
      mediaId: "med_7",
      url: null
    });

    expect(
      fromDoc({ externalUrl: "https://example.com/map.webp" })
    ).toEqual({ mediaId: null, url: "https://example.com/map.webp" });

    expect(
      fromDoc({ avatarExternalUrl: "https://example.com/char.png" })
    ).toEqual({ mediaId: null, url: "https://example.com/char.png" });

    expect(fromDoc({ tokenImage: "https://example.com/tok.png" })).toEqual({
      mediaId: null,
      url: "https://example.com/tok.png"
    });

    expect(fromDoc({ avatarImage: "https://example.com/av.png" })).toEqual({
      mediaId: null,
      url: "https://example.com/av.png"
    });

    expect(toDoc({ mediaId: 123, url: " https://a.com/b.png " })).toEqual({
      mediaId: null,
      url: "https://a.com/b.png"
    });
    expect(toImageRefDoc).toBe(toDoc);
    expect(fromImageRefDoc).toBe(fromDoc);
  });
});
