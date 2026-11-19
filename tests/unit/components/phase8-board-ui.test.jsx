// @vitest-environment jsdom
import { useEffect } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PING_LIFETIME_MS, SPEECH_BUBBLE_DISPLAY_MS, SPEECH_BUBBLE_FADE_MS } from "../../../src/domain/constants.js";
import { useTargetSelection } from "../../../src/contexts/TargetSelectionContext.js";
import TargetSelectionProvider from "../../../src/contexts/TargetSelectionProvider.jsx";
import BoardDrawingsLayer from "../../../src/components/canvas/BoardDrawingsLayer.jsx";
import BoardLeftToolbar from "../../../src/components/canvas/BoardLeftToolbar.jsx";
import BoardPingsLayer from "../../../src/components/canvas/BoardPingsLayer.jsx";
import BoardTextEditor from "../../../src/components/canvas/BoardTextEditor.jsx";
import { BoardToolsContext } from "../../../src/components/canvas/BoardToolsContext.js";
import { BoardMeasureBadge } from "../../../src/components/canvas/BoardHud.jsx";
import TokenModal from "../../../src/components/canvas/TokenModal.jsx";
import TokenSpeechBubble from "../../../src/components/canvas/TokenSpeechBubble.jsx";
import TokenSprite from "../../../src/components/canvas/TokenSprite.jsx";
import { useAoeDemarcation } from "../../../src/components/canvas/useAoeDemarcation.js";
import { useBoardHotkeys } from "../../../src/components/canvas/useBoardHotkeys.js";
import {
  INITIAL_BOARD_TOOLS_STATE,
  boardToolsReducer,
  useBoardTools
} from "../../../src/components/canvas/useBoardTools.js";
import { useSnowballProjectiles } from "../../../src/components/canvas/useSnowballProjectiles.js";
import { getSpeechSource, useTokenSpeech } from "../../../src/components/canvas/useTokenSpeech.js";

let mockAuthState = { user: { uid: "player1", displayName: "P1" } };
let mockCampaignState = {
  campaignId: "camp1",
  campaign: { id: "camp1", gmId: "gm1", activeSceneId: "sc1" },
  isGM: false,
  isRealGM: false
};
let mockRuntimeConfigState = { clientVersionBlocked: false };
let mockDrawingsFeed = [];
const reconcilePcMock = vi.fn(async () => ({ updatedCount: 0 }));
const reconcileFogMock = vi.fn(async () => ({ movedCount: 0 }));
const deleteDrawingsServiceMock = vi.fn(async ({ drawingIds }) => drawingIds.length);
const moveDrawingsServiceMock = vi.fn(async ({ drawings }) => drawings.length);
const rotateDrawingsServiceMock = vi.fn(async ({ drawings }) => drawings.length);

vi.mock("../../../src/contexts/AuthContext", () => ({
  useAuth: () => mockAuthState
}));
vi.mock("../../../src/contexts/CampaignContext", () => ({
  useCampaign: () => mockCampaignState
}));
vi.mock("../../../src/contexts/RuntimeConfigContext", () => ({
  useOptionalRuntimeConfig: () => mockRuntimeConfigState
}));
vi.mock("../../../src/services/notificationService.js", () => ({
  notifyError: vi.fn()
}));
vi.mock("../../../src/services/tokenService.js", () => ({
  reconcileScenePcProjections: reconcilePcMock,
  reconcileSceneFogPartition: reconcileFogMock
}));
vi.mock("../../../src/services/drawingService.js", () => ({
  addShape: vi.fn(),
  addStroke: vi.fn(),
  addTextItem: vi.fn(),
  clearAllSceneDrawings: vi.fn(),
  deleteDrawings: deleteDrawingsServiceMock,
  moveDrawings: moveDrawingsServiceMock,
  rotateDrawings: rotateDrawingsServiceMock,
  subscribeDrawings: ({ onData }) => {
    onData?.(mockDrawingsFeed);
    return () => {};
  },
  updateTextItem: vi.fn()
}));

const { useBoardReconciliation } = await import("../../../src/hooks/useBoardReconciliation.js");
const { useDrawings } = await import("../../../src/hooks/useDrawings.js");

vi.mock("../../../src/hooks/useMediaUrl", () => ({
  useMediaUrl: () => ({ url: null, loading: false })
}));
vi.mock("../../../src/hooks/useTokenImageCompression.js", () => ({
  useTokenImageCompression: () => ({
    compressing: false,
    compressFile: vi.fn(async () => null)
  })
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  mockAuthState = { user: { uid: "player1", displayName: "P1" } };
  mockCampaignState = {
    campaignId: "camp1",
    campaign: { id: "camp1", gmId: "gm1", activeSceneId: "sc1" },
    isGM: false,
    isRealGM: false
  };
  mockRuntimeConfigState = { clientVersionBlocked: false };
  mockDrawingsFeed = [];
  reconcilePcMock.mockReset().mockResolvedValue({ updatedCount: 0 });
  reconcileFogMock.mockReset().mockResolvedValue({ movedCount: 0 });
  deleteDrawingsServiceMock.mockClear();
  moveDrawingsServiceMock.mockClear();
  rotateDrawingsServiceMock.mockClear();
});

describe("Fase 8 UI — Bugs do Tabuleiro (FUN-01, FUN-02, FUN-03, FUN-04, FUN-14, FUN-15, FUN-22, FUN-23)", () => {
  it("FUN-01: BoardTextEditor preserva e edita fontSize e color do próprio texto", () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    const editor = {
      x: 100,
      y: 200,
      text: "Olá",
      fontSize: 32,
      color: "#ff2a55",
      editingId: "txt_1"
    };
    render(
      <BoardTextEditor
        editor={editor}
        onChange={onChange}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    const textarea = screen.getByDisplayValue("Olá");
    expect(textarea.style.fontSize).toBe("32px");
    expect(screen.getByText("32px")).toBeTruthy();

    fireEvent.click(screen.getByText("+"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 36, color: "#ff2a55" }));
  });

  it("FUN-02: desenhos de outra camada não capturam cliques nem ficam interativos", () => {
    const onSelectDrawing = vi.fn();
    const { container } = render(
      <BoardDrawingsLayer
        layerKey="map"
        effectiveLayer="tokens"
        zIndex={3}
        widthPx={500}
        heightPx={500}
        drawings={[
          { id: "shp_map", type: "rect", layer: "map", x: 10, y: 10, w: 50, h: 50, strokeColor: "#ffcc00", strokeWidth: 4, hasFill: false }
        ]}
        toolMode="move"
        canEditDrawing={() => true}
        onSelectDrawing={onSelectDrawing}
      />
    );

    const group = container.querySelector('[data-drawing-id="shp_map"]');
    const rect = group.querySelector("rect");
    expect(rect.style.pointerEvents).toBe("none");
    fireEvent.mouseDown(group, { button: 0 });
    expect(onSelectDrawing).not.toHaveBeenCalled();
  });

  it("FUN-03: SELECT_OR_CYCLE_CONE alterna cone e ângulo 45°/60° no reducer sem updater impuro", () => {
    const s1 = boardToolsReducer(INITIAL_BOARD_TOOLS_STATE, { type: "SELECT_OR_CYCLE_CONE" });
    expect(s1.measureShape).toBe("cone");
    expect(s1.coneAngle).toBe(45);

    const s2 = boardToolsReducer(s1, { type: "SELECT_OR_CYCLE_CONE" });
    expect(s2.measureShape).toBe("cone");
    expect(s2.coneAngle).toBe(60);

    const s3 = boardToolsReducer(s2, { type: "SELECT_OR_CYCLE_CONE" });
    expect(s3.coneAngle).toBe(45);
  });

  it("FUN-04: AoE, bola de neve e balões não fazem fallback por nome nem primeiro token", () => {
    const tokens = [
      { id: "tok_other", kind: "npc", characterId: "npc_1", label: "Pinguim", x: 0, y: 0, sizeInCells: 1 }
    ];
    const { result: aoeRes } = renderHook(() =>
      useAoeDemarcation({
        aoeDemarcateConfig: { aoeType: "circle", sourceCharacterId: "pc_missing" },
        renderedTokens: tokens,
        selectedTokenIds: [],
        activeCharacter: { id: "pc_missing", name: "Pinguim" },
        cellSizePx: 64
      })
    );
    expect(aoeRes.current.aoeCasterToken).toBeNull();

    const sendPing = vi.fn();
    const { result: snowRes } = renderHook(() =>
      useSnowballProjectiles({
        tokens,
        selectedTokenIds: [],
        activeCharacter: { id: "pc_missing", name: "Pinguim" },
        sendPing
      })
    );
    expect(snowRes.current.getOriginCenter()).toBeNull();

    const msgByNameOnly = {
      id: "m1",
      type: "text",
      content: "Oi!",
      senderName: "Pinguim",
      timestampMs: Date.now()
    };
    expect(getSpeechSource(msgByNameOnly)).toMatchObject({ tokenId: null, characterId: null });

    const { result: speechRes } = renderHook(() => useTokenSpeech([msgByNameOnly]));
    expect(speechRes.current.getTokenSpeech(tokens[0])).toBeNull();
  });

  it("FUN-14: régua fixada exibe botão 'Capturar N Alvos' clicável e captura alvos", () => {
    const onCapture = vi.fn();
    const onDismiss = vi.fn();
    render(
      <BoardMeasureBadge
        measureLine={{ startX: 0, startY: 0, endX: 128, endY: 0, locked: true }}
        measureStats={{ midX: 64, midY: 0, label: "⭕ Raio: 3,0 m" }}
        tokensInsideMeasure={[{ id: "t1" }, { id: "t2" }]}
        onCaptureTargets={onCapture}
        onDismissMeasure={onDismiss}
      />
    );

    const btn = screen.getByText(/Capturar 2 Alvos/);
    fireEvent.click(btn);
    expect(onCapture).toHaveBeenCalledWith([{ id: "t1" }, { id: "t2" }]);

    fireEvent.click(screen.getByTitle("Fechar régua"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("FUN-15: TokenSprite em modo mira (AoE/Bola de Neve) deixa clique propagar sobre token inimigo", () => {
    const boardMouseDown = vi.fn();
    const onSelect = vi.fn();
    const { container } = render(
      <div onMouseDown={boardMouseDown}>
        <TokenSprite
          token={{
            id: "enemy_1",
            kind: "npc",
            label: "Inimigo",
            x: 0,
            y: 0,
            sizeInCells: 1,
            hidden: false,
            ringColor: "#e53935",
            showName: true
          }}
          cellSizePx={64}
          campaignId="camp1"
          isGM={false}
          canControl={false}
          isInteractive={true}
          isSelected={false}
          isAimingMode={true}
          onSelect={onSelect}
        />
      </div>
    );

    const tokenEl = container.querySelector('[data-token-id="enemy_1"]');
    fireEvent.mouseDown(tokenEl, { button: 0 });
    expect(boardMouseDown).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("FUN-22: TokenSpeechBubble não renderiza mensagem histórica expirada nem por 1 frame", () => {
    const expiredTs = Date.now() - SPEECH_BUBBLE_DISPLAY_MS - SPEECH_BUBBLE_FADE_MS - 500;
    const { container } = render(
      <TokenSpeechBubble
        speechBubble={{ id: "old_msg", text: "Fala velha", timestampMs: expiredTs }}
      />
    );
    expect(container.innerHTML).toBe("");

    const { getByText } = render(
      <TokenSpeechBubble
        speechBubble={{ id: "new_msg", text: "Fala nova!", timestampMs: Date.now() }}
      />
    );
    expect(getByText("Fala nova!")).toBeTruthy();
  });

  it("FUN-23: useBoardHotkeys bloqueia atalhos com foco em INPUT/TEXTAREA/SELECT/contentEditable", () => {
    const onDeleteSelected = vi.fn();
    const onToggleTarget = vi.fn();
    renderHook(() =>
      useBoardHotkeys({
        toolMode: "move",
        hasSelection: true,
        onDeleteSelected,
        onToggleTargetByHotkey: onToggleTarget
      })
    );

    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "Delete" });
    fireEvent.keyDown(input, { key: "t" });
    expect(onDeleteSelected).not.toHaveBeenCalled();
    expect(onToggleTarget).not.toHaveBeenCalled();
    document.body.removeChild(input);

    fireEvent.keyDown(window, { key: "Delete" });
    fireEvent.keyDown(window, { key: "t" });
    expect(onDeleteSelected).toHaveBeenCalledTimes(1);
    expect(onToggleTarget).toHaveBeenCalledTimes(1);
  });
});

describe("Fase 8 UI — TargetSelectionContext (INT-17), PERF-06, Toolbar & U6/U6a", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("INT-17: TargetSelectionProvider remove automaticamente IDs de tokens excluídos", () => {
    const onState = vi.fn();
    function Probe({ onCapture }) {
      const api = useTargetSelection();
      useEffect(() => {
        onCapture(api);
      }, [api, onCapture]);
      return <div data-testid="count">{api.targetedTokenIds.length}</div>;
    }

    const { rerender } = render(
      <TargetSelectionProvider
        sceneId="sc1"
        tokensLoaded={true}
        sceneTokens={[
          { id: "t1", label: "Goblin 1" },
          { id: "t2", label: "Goblin 2" }
        ]}
      >
        <Probe onCapture={onState} />
      </TargetSelectionProvider>
    );

    const getLatestApi = () => onState.mock.calls.at(-1)[0];

    act(() => {
      getLatestApi().setTargetIds(["t1", "t2"]);
    });
    expect(getLatestApi().targetedTokenIds).toEqual(["t1", "t2"]);

    // Token t1 foi deletado do RTDB
    rerender(
      <TargetSelectionProvider
        sceneId="sc1"
        tokensLoaded={true}
        sceneTokens={[{ id: "t2", label: "Goblin 2" }]}
      >
        <Probe onCapture={onState} />
      </TargetSelectionProvider>
    );
    expect(getLatestApi().targetedTokenIds).toEqual(["t2"]);
    expect(getLatestApi().targetedTokens.map((t) => t.id)).toEqual(["t2"]);
  });

  it("PERF-06: tick de 250ms de BoardPingsLayer não re-renderiza componente pai e limpa expirados", () => {
    const onParentRender = vi.fn();
    const onCleanupExpired = vi.fn();
    const now = Date.now();
    const pings = [{ id: "p1", kind: "ping", x: 10, y: 20, color: "#00f0ff", createdAt: now }];

    function ParentShell({ onRender }) {
      useEffect(() => {
        onRender();
      });
      return (
        <BoardPingsLayer
          pings={pings}
          serverTimeOffsetMs={0}
          onCleanupExpired={onCleanupExpired}
        />
      );
    }

    render(<ParentShell onRender={onParentRender} />);
    expect(onParentRender).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(PING_LIFETIME_MS + 500);
    });

    expect(onParentRender).toHaveBeenCalledTimes(1);
    expect(onCleanupExpired).toHaveBeenCalled();
  });

  it("U6/U6a e BoardLeftToolbar: 'Apagar Todos os Desenhos' e 'Cobrir Tudo' acionam callbacks de confirmação; excluir token no TokenModal não pede confirmação", async () => {
    const onRequestClearAll = vi.fn();
    const onRequestResetFog = vi.fn();

    function ToolbarHarness() {
      const tools = useBoardTools({ isGM: true });
      return (
        <BoardToolsContext.Provider value={tools}>
          <BoardLeftToolbar
            isGM={true}
            fogEnabled={true}
            toggleFogEnabled={vi.fn()}
            onRequestResetFogCoverAll={onRequestResetFog}
            onRequestClearAllDrawings={onRequestClearAll}
            grid={{ enabled: true, snapToGrid: true }}
            cellSizePx={64}
            handleToggleGrid={vi.fn()}
            handleToggleSnap={vi.fn()}
            handleChangeCellSize={vi.fn()}
            onOpenScenesManager={vi.fn()}
            onOpenNewTokenModal={vi.fn()}
            zoom={0.75}
            onZoomIn={vi.fn()}
            onZoomOut={vi.fn()}
            onResetCamera={vi.fn()}
          />
        </BoardToolsContext.Provider>
      );
    }

    render(<ToolbarHarness />);
    fireEvent.click(screen.getByText("Desenhar"));
    fireEvent.click(screen.getByText("Apagar Todos os Desenhos"));
    expect(onRequestClearAll).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Névoa"));
    fireEvent.click(screen.getByText("Cobrir Tudo"));
    expect(onRequestResetFog).toHaveBeenCalledTimes(1);

    cleanup();
    const onDelete = vi.fn(async () => {});
    const onClose = vi.fn();
    render(
      <TokenModal
        initialToken={{
          id: "tok1",
          kind: "free",
          label: "Caixa",
          layer: "tokens",
          hidden: false,
          sizeInCells: 1,
          ringColor: "#3090f0",
          showName: true,
          controlledBy: {}
        }}
        isGM={true}
        canDelete={true}
        onSave={vi.fn()}
        onDelete={onDelete}
        onClose={onClose}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByText("Remover"));
    });
    // U6: exclusão de token único não pede confirmação
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("useBoardReconciliation respeita clientVersionBlocked e reexecuta pendente após finally", async () => {
    mockRuntimeConfigState = { clientVersionBlocked: true };
    const baseProps = {
      sceneId: "sc1",
      characters: [{ id: "pc1", type: "pc", rev: 2 }],
      publicTokens: [{ id: "t1", kind: "pc", characterId: "pc1", rev: 1 }],
      hiddenTokens: [],
      tokensLoaded: true
    };

    const { rerender } = renderHook((props) => useBoardReconciliation(props), {
      initialProps: baseProps
    });
    expect(reconcilePcMock).not.toHaveBeenCalled();

    let releaseFirstRun;
    reconcilePcMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirstRun = () => resolve({ updatedCount: 1 });
        })
    );
    mockRuntimeConfigState = { clientVersionBlocked: false };

    rerender({ ...baseProps, publicTokens: [{ id: "t1", kind: "pc", characterId: "pc1", rev: 1 }] });
    expect(reconcilePcMock).toHaveBeenCalledTimes(1);

    // Nova mudança enquanto a primeira reconciliação está em voo enfileira reexecução pendente
    rerender({
      ...baseProps,
      characters: [{ id: "pc1", type: "pc", rev: 3 }]
    });
    expect(reconcilePcMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseFirstRun();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(reconcilePcMock).toHaveBeenCalledTimes(2);
    expect(reconcilePcMock.mock.calls[1][0].characters[0].rev).toBe(3);
  });

  it("useDrawings filtra desenhos não autorizados em deleteDrawings, moveDrawings e rotateDrawings", async () => {
    const ownDrawing = { id: "d_own", authorId: "player1", type: "rect" };
    const foreignDrawing = { id: "d_other", authorId: "player2", type: "rect" };
    mockDrawingsFeed = [ownDrawing, foreignDrawing];

    const { result } = renderHook(() => useDrawings("sc1"));

    await act(async () => {
      const deletedCount = await result.current.deleteDrawings(["d_own", "d_other", "d_missing"]);
      expect(deletedCount).toBe(1);
    });
    expect(deleteDrawingsServiceMock).toHaveBeenCalledTimes(1);
    expect(deleteDrawingsServiceMock.mock.calls[0][0].drawingIds).toEqual(["d_own"]);

    await act(async () => {
      const blockedDel = await result.current.deleteDrawings(["d_other"]);
      expect(blockedDel).toBe(0);
    });
    expect(deleteDrawingsServiceMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.moveDrawings([ownDrawing, foreignDrawing], 10, 20);
      await result.current.rotateDrawings([ownDrawing, foreignDrawing], 45, { x: 0, y: 0 });
    });
    expect(moveDrawingsServiceMock).toHaveBeenCalledTimes(1);
    expect(moveDrawingsServiceMock.mock.calls[0][0].drawings).toEqual([ownDrawing]);
    expect(rotateDrawingsServiceMock).toHaveBeenCalledTimes(1);
    expect(rotateDrawingsServiceMock.mock.calls[0][0].drawings).toEqual([ownDrawing]);
  });

  it("TokenModal exibe 'Remover Imagem', despacha CLEAR_IMAGE e envia imageCleared: true", async () => {
    const onSave = vi.fn(async () => {});
    const onClose = vi.fn();
    render(
      <TokenModal
        initialToken={{
          id: "tok_img",
          kind: "free",
          label: "Com URL",
          layer: "tokens",
          hidden: false,
          sizeInCells: 1,
          ringColor: "#3090f0",
          showName: true,
          image: { mediaId: null, url: "https://example.com/tok.png" },
          controlledBy: {}
        }}
        isGM={true}
        canDelete={true}
        onSave={onSave}
        onDelete={null}
        onClose={onClose}
      />
    );

    const urlInput = screen.getByPlaceholderText("Ou URL direta da imagem (opcional)");
    expect(urlInput.value).toBe("https://example.com/tok.png");

    fireEvent.click(screen.getByText("Remover Imagem"));
    expect(urlInput.value).toBe("");
    expect(screen.queryByText("Remover Imagem")).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByText("Salvar Token"));
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        externalUrl: null,
        imageCleared: true
      }),
      null
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("BoardPingsLayer usa snapshotReceivedAtMs imediatamente e TokenSpeechBubble fecha quando elapsed >= TOTAL_BUBBLE_MS", () => {
    vi.useFakeTimers();
    const t0 = 1_000_000;
    vi.setSystemTime(t0);

    const { container, rerender } = render(
      <BoardPingsLayer pings={[]} snapshotReceivedAtMs={0} serverTimeOffsetMs={0} />
    );
    expect(container.querySelectorAll(".cp-ping-container")).toHaveLength(0);

    const expiredTs = t0;
    const snapTime = t0 + PING_LIFETIME_MS + 500;
    vi.setSystemTime(snapTime);

    // Sem esperar o tick de 250ms, snapshotReceivedAtMs descarta o ping velho e renderiza o novo imediatamente
    rerender(
      <BoardPingsLayer
        pings={[
          { id: "p_old", kind: "ping", x: 10, y: 10, color: "#ff0000", createdAt: expiredTs },
          { id: "p_new", kind: "ping", x: 120, y: 140, color: "#00f0ff", createdAt: snapTime }
        ]}
        snapshotReceivedAtMs={snapTime}
        serverTimeOffsetMs={0}
      />
    );
    const renderedPings = container.querySelectorAll(".cp-ping-container");
    expect(renderedPings).toHaveLength(1);
    expect(renderedPings[0].style.left).toBe("120px");

    cleanup();
    const mountAt = 2_000_000;
    vi.setSystemTime(mountAt);
    const { rerender: rerenderBubble } = render(
      <TokenSpeechBubble
        speechBubble={{ id: "msg_live", text: "Inicial", timestampMs: mountAt }}
      />
    );
    expect(screen.getByText("Inicial")).toBeTruthy();

    // Avança o relógio além da vida útil total e troca para mensagem cuja timestamp era válida em mountNow
    vi.setSystemTime(mountAt + SPEECH_BUBBLE_DISPLAY_MS + SPEECH_BUBBLE_FADE_MS + 100);
    rerenderBubble(
      <TokenSpeechBubble
        speechBubble={{ id: "msg_stale_after_mount", text: "Expirado Depois", timestampMs: mountAt + 50 }}
      />
    );
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.queryByText("Expirado Depois")).toBeNull();
  });
});
