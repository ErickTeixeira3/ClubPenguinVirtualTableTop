// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CPButton from "../../../src/components/ui/CPButton.jsx";
import ConfirmDeleteModal from "../../../src/components/ui/ConfirmDeleteModal.jsx";
import ConfirmDialog from "../../../src/components/ui/ConfirmDialog.jsx";
import Toast from "../../../src/components/ui/Toast.jsx";
import WindowModal from "../../../src/components/ui/WindowModal.jsx";
import { createFixedClock } from "../../../src/infra/clock.js";
import {
  clearNotifications,
  createNotificationStore,
  notifyError,
  notifySuccess
} from "../../../src/services/notificationService.js";

beforeEach(() => {
  clearNotifications();
});

afterEach(() => {
  clearNotifications();
  cleanup();
});

describe("notificationService + useNotifications + Toast", () => {
  it("gerencia notificações de erro/sucesso e expiração por timer no store", () => {
    vi.useFakeTimers();
    try {
      const clock = createFixedClock(5000);
      const store = createNotificationStore({ clock, random: () => 0.5 });
      const seen = [];
      const unsub = store.subscribe((list) => seen.push(list.length));

      const errId = store.notifyError(new Error("Falha ao salvar ficha"), {
        code: "PERMISSION_DENIED",
        durationMs: 2000
      });
      expect(store.getAll()).toHaveLength(1);
      expect(store.getAll()[0]).toMatchObject({
        id: errId,
        type: "error",
        message: "Falha ao salvar ficha",
        code: "PERMISSION_DENIED"
      });

      vi.advanceTimersByTime(2000);
      expect(store.getAll()).toHaveLength(0);
      expect(seen).toEqual([1, 0]);
      unsub();
    } finally {
      vi.useRealTimers();
    }
  });

  it("Toast assina useNotifications, renderiza alertas e fecha pelo botão", () => {
    render(<Toast />);
    expect(screen.queryByRole("alert")).toBeNull();

    act(() => {
      notifyError("Permissão negada.", { durationMs: 0 });
      notifySuccess("Ficha salva!", { durationMs: 0 });
    });

    expect(screen.getByRole("alert").textContent).toContain("Permissão negada.");
    expect(screen.getByRole("status").textContent).toContain("Ficha salva!");

    const closeButtons = screen.getAllByRole("button", { name: "Fechar" });
    fireEvent.click(closeButtons[0]);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Ficha salva!");
  });
});

describe("ConfirmDialog + ConfirmDeleteModal", () => {
  it("ConfirmDialog executa fluxo padrão de confirmar e cancelar", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Excluir ficha"
        question="Deseja mover esta ficha para fora do jogo?"
        confirmLabel="Excluir"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("ConfirmDeleteModal preserva HTML estático idêntico ao padrão original da Fase 4", () => {
    const props = {
      title: "Excluir pasta",
      question: "O que fazer com os itens dentro desta pasta?",
      moveLabel: "Mover itens para a pasta pai",
      deleteLabel: "Excluir pasta e itens",
      cancelLabel: "Cancelar",
      onMove: () => {},
      onDelete: () => {},
      onCancel: () => {},
      zIndex: 2500,
      maxWidth: "360px",
      overlayBackground: "rgba(0,0,0,0.6)",
      panelShadow: "0 4px 12px rgba(0,0,0,0.4)"
    };

    const actionStyle = { padding: "6px 12px", fontSize: "12px", width: "100%" };
    const cancelStyle = { padding: "5px 12px", fontSize: "12px", width: "100%" };
    const legacyHtml = renderToStaticMarkup(
      <WindowModal
        variant="light"
        onClose={props.onCancel}
        zIndex={props.zIndex}
        maxWidth={props.maxWidth}
        overlayStyle={{ background: props.overlayBackground }}
        panelStyle={{ boxShadow: props.panelShadow }}
      >
        <div style={{ fontSize: "15px", fontWeight: 800, color: "#003264" }}>{props.title}</div>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>{props.question}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <CPButton variant="gold" style={actionStyle} onClick={props.onMove}>
            {props.moveLabel}
          </CPButton>
          <CPButton variant="orange" style={actionStyle} onClick={props.onDelete}>
            {props.deleteLabel}
          </CPButton>
          <CPButton style={cancelStyle} onClick={props.onCancel}>
            {props.cancelLabel}
          </CPButton>
        </div>
      </WindowModal>
    );

    const currentHtml = renderToStaticMarkup(<ConfirmDeleteModal {...props} />);
    expect(currentHtml).toBe(legacyHtml);
  });
});
