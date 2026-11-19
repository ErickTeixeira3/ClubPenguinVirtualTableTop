import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../../src/domain/errors.js";
import * as firestorePaths from "../../../src/infra/firestorePaths.js";
import * as rtdbPaths from "../../../src/infra/rtdbPaths.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

function walkJsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkJsFiles(full);
    return /\.(jsx?|mjs)$/.test(entry.name) ? [full] : [];
  });
}

describe("firestorePaths", () => {
  it("constrói todos os caminhos v2 da campanha e raiz", () => {
    expect(firestorePaths.platformAdminsCollectionPath()).toBe("platformAdmins");
    expect(firestorePaths.platformAdminDocPath("u1")).toBe("platformAdmins/u1");
    expect(firestorePaths.appConfigCollectionPath()).toBe("appConfig");
    expect(firestorePaths.runtimeConfigDocPath()).toBe("appConfig/runtime");
    expect(firestorePaths.campaignsCollectionPath()).toBe("campaigns");
    expect(firestorePaths.campaignDocPath("c1")).toBe("campaigns/c1");
    expect(firestorePaths.membersCollectionPath("c1")).toBe("campaigns/c1/members");
    expect(firestorePaths.memberDocPath("c1", "u1")).toBe("campaigns/c1/members/u1");
    expect(firestorePaths.invitesCollectionPath("c1")).toBe("campaigns/c1/invites");
    expect(firestorePaths.inviteDocPath("c1", "a@b.com")).toBe("campaigns/c1/invites/a@b.com");
    expect(firestorePaths.charactersCollectionPath("c1")).toBe("campaigns/c1/characters");
    expect(firestorePaths.characterDocPath("c1", "ch1")).toBe("campaigns/c1/characters/ch1");
    expect(firestorePaths.foldersCollectionPath("c1")).toBe("campaigns/c1/folders");
    expect(firestorePaths.folderDocPath("c1", "f1")).toBe("campaigns/c1/folders/f1");
    expect(firestorePaths.notesCollectionPath("c1")).toBe("campaigns/c1/notes");
    expect(firestorePaths.noteDocPath("c1", "n1")).toBe("campaigns/c1/notes/n1");
    expect(firestorePaths.scenesCollectionPath("c1")).toBe("campaigns/c1/scenes");
    expect(firestorePaths.sceneDocPath("c1", "s1")).toBe("campaigns/c1/scenes/s1");
    expect(firestorePaths.compendiumCollectionPath("c1")).toBe("campaigns/c1/compendium");
    expect(firestorePaths.compendiumEntryDocPath("c1", "ce1")).toBe("campaigns/c1/compendium/ce1");
    expect(firestorePaths.messagesCollectionPath("c1")).toBe("campaigns/c1/messages");
    expect(firestorePaths.messageDocPath("c1", "m1")).toBe("campaigns/c1/messages/m1");
    expect(firestorePaths.mediaCollectionPath("c1")).toBe("campaigns/c1/media");
    expect(firestorePaths.mediaDocPath("c1", "med1")).toBe("campaigns/c1/media/med1");
    expect(firestorePaths.stateCollectionPath("c1")).toBe("campaigns/c1/state");
    expect(firestorePaths.turnStateDocPath("c1")).toBe("campaigns/c1/state/turn");
    expect(firestorePaths.chatStateDocPath("c1")).toBe("campaigns/c1/state/chat");
    expect(firestorePaths.pendingCostsCollectionPath("c1")).toBe("campaigns/c1/pendingCosts");
    expect(firestorePaths.pendingCostDocPath("c1", "op1")).toBe("campaigns/c1/pendingCosts/op1");
  });

  it("rejeita segmentos vazios, com barra ou relativos", () => {
    for (const invalid of ["", " ", "c1/x", " c1", ".", "..", null, 123]) {
      expect(() => firestorePaths.campaignDocPath(invalid)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_REFERENCE })
      );
    }
  });
});

describe("rtdbPaths", () => {
  it("constrói todos os caminhos do RTDB v2 e nós especiais", () => {
    expect(rtdbPaths.RTDB_LAYOUT).toBe("split");
    expect(rtdbPaths.IS_SPLIT_RTDB_LAYOUT).toBe(true);
    expect(rtdbPaths.platformAdminsRtdbRootPath()).toBe("platformAdmins");
    expect(rtdbPaths.platformAdminRtdbPath("u1")).toBe("platformAdmins/u1");
    expect(rtdbPaths.campaignRtdbRootPath("c1")).toBe("vtt_realtime/c1");
    expect(rtdbPaths.metaRootPath("c1")).toBe("vtt_realtime/c1/meta");
    expect(rtdbPaths.gmMetaPath("c1")).toBe("vtt_realtime/c1/meta/gmId");
    expect(rtdbPaths.pendingGmMetaPath("c1")).toBe("vtt_realtime/c1/meta/pendingGm");
    expect(rtdbPaths.membersMetaRootPath("c1")).toBe("vtt_realtime/c1/meta/members");
    expect(rtdbPaths.memberMetaPath("c1", "u1")).toBe("vtt_realtime/c1/meta/members/u1");
    expect(rtdbPaths.invitesMetaRootPath("c1")).toBe("vtt_realtime/c1/meta/invites");
    expect(rtdbPaths.inviteMetaPath("c1", "a@b,com")).toBe("vtt_realtime/c1/meta/invites/a@b,com");
    expect(rtdbPaths.presenceRootPath("c1")).toBe("vtt_realtime/c1/presence");
    expect(rtdbPaths.userPresencePath("c1", "u1")).toBe("vtt_realtime/c1/presence/u1");
    expect(rtdbPaths.connectionPresencePath("c1", "u1", "conn1")).toBe(
      "vtt_realtime/c1/presence/u1/conn1"
    );
    expect(rtdbPaths.sceneTokensPath("c1", "s1")).toBe("vtt_realtime/c1/tokens/s1");
    expect(rtdbPaths.tokenPath("c1", "s1", "t1")).toBe("vtt_realtime/c1/tokens/s1/t1");
    expect(rtdbPaths.sceneHiddenTokensPath("c1", "s1")).toBe("vtt_realtime/c1/hiddenTokens/s1");
    expect(rtdbPaths.hiddenTokenPath("c1", "s1", "t1")).toBe("vtt_realtime/c1/hiddenTokens/s1/t1");
    expect(rtdbPaths.sceneTokenSecretsPath("c1", "s1")).toBe("vtt_realtime/c1/tokenSecrets/s1");
    expect(rtdbPaths.tokenSecretPath("c1", "s1", "t1")).toBe("vtt_realtime/c1/tokenSecrets/s1/t1");
    expect(rtdbPaths.sceneFogPath("c1", "s1")).toBe("vtt_realtime/c1/fog/s1");
    expect(rtdbPaths.sceneFogEnabledPath("c1", "s1")).toBe("vtt_realtime/c1/fog/s1/enabled");
    expect(rtdbPaths.sceneFogAreasPath("c1", "s1")).toBe("vtt_realtime/c1/fog/s1/areas");
    expect(rtdbPaths.fogAreaPath("c1", "s1", "a1")).toBe("vtt_realtime/c1/fog/s1/areas/a1");
    expect(rtdbPaths.drawingsPath("c1", "s1")).toBe("vtt_realtime/c1/drawings/s1");
    expect(rtdbPaths.drawingItemPath("c1", "s1", "d1")).toBe("vtt_realtime/c1/drawings/s1/d1");
    expect(rtdbPaths.legacyDrawingsPath("c1", "s1")).toBe("vtt_realtime/c1/fog/s1/drawings");
    expect(rtdbPaths.pingsPath("c1", "s1")).toBe("vtt_realtime/c1/pings/s1");
    expect(rtdbPaths.pingItemPath("c1", "s1", "p1")).toBe("vtt_realtime/c1/pings/s1/p1");
    expect(rtdbPaths.legacyPingsPath("c1", "s1")).toBe("vtt_realtime/c1/fog/s1/pings");
    expect(rtdbPaths.rtdbConnectedInfoPath()).toBe(".info/connected");
    expect(rtdbPaths.rtdbServerTimeOffsetPath()).toBe(".info/serverTimeOffset");
  });

  it("rejeita caracteres inválidos no RTDB e aceita vírgula em emailKey", () => {
    for (const invalid of ["", "c1/x", "a.b", "a#b", "a$b", "a[b", "a]b", null]) {
      expect(() => rtdbPaths.tokenPath("c1", "s1", invalid)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_REFERENCE })
      );
    }
    expect(rtdbPaths.inviteMetaPath("c1", "user@example,com")).toBe(
      "vtt_realtime/c1/meta/invites/user@example,com"
    );
  });

  it("não há mais literais vtt_realtime/ em código executável fora de src/infra/rtdbPaths.js", () => {
    const srcFiles = walkJsFiles(path.join(repoRoot, "src"));
    const rtdbPathsFile = path.join(repoRoot, "src", "infra", "rtdbPaths.js");
    const offenders = [];

    for (const file of srcFiles) {
      if (file === rtdbPathsFile) continue;
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
        if (trimmed.includes("vtt_realtime/")) {
          offenders.push(`${path.relative(repoRoot, file)}:${idx + 1}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
