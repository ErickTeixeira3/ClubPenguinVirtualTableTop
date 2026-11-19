// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firestoreSpies = vi.hoisted(() => ({
  doc: vi.fn((_db, p) => ({ path: p, withConverter: () => ({ path: p }) })),
  onSnapshot: vi.fn(() => () => {})
}));

vi.mock("firebase/firestore", () => firestoreSpies);
vi.mock("../../../src/infra/firebase.js", () => ({ db: {} }));
vi.mock("../../../src/contexts/AuthContext.jsx", () => ({
  useAuth: () => ({ user: { uid: "u1", emailVerified: true } })
}));

const RuntimeConfigProvider = (
  await import("../../../src/contexts/RuntimeConfigProvider.jsx")
).default;
const { useRuntimeConfig } = await import(
  "../../../src/contexts/RuntimeConfigContext.js"
);
const DebouncedField = (await import("../../../src/components/ui/DebouncedField.jsx"))
  .default;
const runtimeConfigService = await import(
  "../../../src/services/runtimeConfigService.js"
);

function ReloadHarness({ onReload }) {
  const { updateRequired, requestReload } = useRuntimeConfig();
  return (
    <div>
      <span data-testid="update-flag">{String(updateRequired)}</span>
      <button
        type="button"
        onClick={() =>
          requestReload({
            confirmDiscard: async () => false,
            reload: onReload
          })
        }
      >
        Recarregar Negando
      </button>
      <button
        type="button"
        onClick={() =>
          requestReload({
            confirmDiscard: async () => true,
            reload: onReload
          })
        }
      >
        Recarregar Confirmando
      </button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  runtimeConfigService.setClientVersionBlocked(false);
});

afterEach(cleanup);

describe("DebouncedField + RuntimeConfigProvider (proteção de recarga)", () => {
  it("detecta alteração pendente em DebouncedField e bloqueia/libera recarga conforme confirmação", async () => {
    let snapCb;
    firestoreSpies.onSnapshot.mockImplementation((_ref, onNext) => {
      snapCb = onNext;
      return vi.fn();
    });

    const onReload = vi.fn();
    render(
      <RuntimeConfigProvider>
        <DebouncedField value="10" delay={5000} onCommit={vi.fn()} />
        <ReloadHarness onReload={onReload} />
      </RuntimeConfigProvider>
    );

    await act(async () => {
      snapCb({
        exists: () => true,
        data: () => ({ id: "runtime", minClientVersion: "2.1.0", schemaVersion: 2 })
      });
    });

    expect(screen.getByTestId("update-flag").textContent).toBe("true");
    expect(runtimeConfigService.isClientVersionBlocked()).toBe(true);

    const input = screen.getByDisplayValue("10");
    expect(runtimeConfigService.hasUnsavedChanges()).toBe(false);
    fireEvent.change(input, { target: { value: "15" } });
    expect(runtimeConfigService.hasUnsavedChanges()).toBe(true);

    fireEvent.click(screen.getByText("Recarregar Negando"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onReload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Recarregar Confirmando"));
    await waitFor(() => {
      expect(onReload).toHaveBeenCalledTimes(1);
    });
  });
});
