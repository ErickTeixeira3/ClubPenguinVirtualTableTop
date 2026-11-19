// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../../src/domain/errors.js";
import { createFixedClock } from "../../../src/infra/clock.js";
import {
  assertValidCampaignChannel,
  openCrossWindowTransport
} from "../../../src/infra/crossWindowTransport.js";

const originals = {};

beforeEach(() => {
  originals.BroadcastChannel = window.BroadcastChannel;
  originals.localStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
});

afterEach(() => {
  window.BroadcastChannel = originals.BroadcastChannel;
  if (originals.localStorage) {
    Object.defineProperty(window, "localStorage", originals.localStorage);
  }
});

describe("crossWindowTransport", () => {
  it("rejeita campaignId ausente ou 'default'", () => {
    for (const bad of ["", "  ", "default", "DEFAULT", null, undefined]) {
      expect(() => assertValidCampaignChannel(bad)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_REFERENCE })
      );
    }
  });

  it("usa BroadcastChannel quando disponível e fecha corretamente", () => {
    const channels = [];
    class FakeBroadcastChannel {
      constructor(name) {
        this.name = name;
        this.onmessage = null;
        this.closed = false;
        channels.push(this);
      }
      postMessage(data) {
        for (const ch of channels) {
          if (ch !== this && ch.name === this.name && !ch.closed) {
            ch.onmessage?.({ data });
          }
        }
      }
      close() {
        this.closed = true;
      }
    }
    window.BroadcastChannel = FakeBroadcastChannel;

    const received = [];
    const tx = openCrossWindowTransport("camp_1", () => {});
    const rx = openCrossWindowTransport("camp_1", (pkt) => received.push(pkt));

    expect(tx.kind).toBe("broadcast");
    expect(tx.channelName).toBe("cp_vtt_sync_v1_camp_1");
    tx.post({ type: "PING", value: 42 });
    expect(received).toEqual([{ type: "PING", value: 42 }]);

    rx.close();
    tx.post({ type: "PING", value: 99 });
    expect(received).toHaveLength(1);
    tx.close();
  });

  it("faz fallback para localStorage + evento storage (A13) e reporta erros a onError", () => {
    window.BroadcastChannel = function ThrowingChannel() {
      throw new Error("BroadcastChannel blocked");
    };

    const backing = new Map();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (k) => backing.get(k) ?? null,
        setItem: (k, v) => {
          backing.set(k, v);
          window.dispatchEvent(new StorageEvent("storage", { key: k, newValue: v }));
        },
        removeItem: (k) => backing.delete(k)
      }
    });

    const errors = [];
    const received = [];
    const clock = createFixedClock(1700000000000);
    const transport = openCrossWindowTransport(
      "camp_2",
      (pkt) => received.push(pkt),
      {
        onError: (err, ctx) => errors.push({ err, ctx }),
        clock,
        random: () => 0.25
      }
    );

    expect(errors[0]?.ctx?.action).toBe("openBroadcastChannel");
    expect(transport.kind).toBe("storage");

    transport.post({ type: "TARGETS_UPDATED", payload: ["t1"] });
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      type: "TARGETS_UPDATED",
      payload: ["t1"]
    });
    expect(received[0].nonce).toMatch(/^win_1700000000000_/);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: transport.storageKey,
        newValue: "{json-corrompido"
      })
    );
    expect(errors.some((e) => e.ctx?.action === "parseStoragePacket")).toBe(true);

    transport.close();
    transport.post({ type: "AFTER_CLOSE" });
    expect(received).toHaveLength(1);
  });
});
