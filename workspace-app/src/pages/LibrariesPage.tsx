import {
  exportToSvg,
  loadLibraryFromBlob,
  serializeLibraryAsJSON,
} from "@excalidraw/excalidraw";
import { useCallback, useEffect, useRef, useState } from "react";

import { del, get, post, put } from "../api/client";
import { useWorkspace } from "../layout/WorkspaceContext";

interface Item {
  id: string;
  status: string;
  created: number;
  name?: string;
  elements: any[];
}

/** Renders a library item as an inline SVG preview. */
const Preview = ({ item }: { item: Item }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    exportToSvg({
      elements: item.elements as any,
      appState: {
        exportBackground: false,
        viewBackgroundColor: "#ffffff",
      } as any,
      files: null,
      exportPadding: 6,
    })
      .then((svg) => {
        if (!alive || !ref.current) {
          return;
        }
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        ref.current.replaceChildren(svg);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [item]);
  return (
    <div
      ref={ref}
      className="lib-preview"
      aria-label={item.name ?? "Library item"}
    />
  );
};

const Section = ({
  title,
  base,
  readOnly,
  otherBase,
  otherLabel,
}: {
  title: string;
  base: string;
  readOnly?: boolean;
  otherBase?: string;
  otherLabel?: string;
}) => {
  const [items, setItems] = useState<Item[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const file = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setItems((await get(base)).items);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  }, [base]);
  useEffect(() => {
    setItems(null);
    setSelected(new Set());
    void load();
  }, [load]);

  const run = async (fn: () => Promise<any>, ok?: string) => {
    try {
      const r = await fn();
      if (r?.items) {
        setItems(r.items);
      } else {
        await load();
      }
      setMsg(ok ? { ok: true, text: ok } : null);
    } catch (e: any) {
      setMsg({
        ok: false,
        text:
          e.code === "library_full"
            ? "The library is full (1000 items)."
            : e.message,
      });
    }
  };

  const importFile = async (f: File) => {
    try {
      const parsed = await loadLibraryFromBlob(f, "unpublished");
      const payload = (parsed as any[]).map((i) => ({
        id: i.id,
        status: i.status,
        created: i.created,
        name: i.name,
        elements: i.elements,
      }));
      await run(
        () => post(`${base}/import`, { items: payload }),
        `Imported ${payload.length} item(s).`,
      );
    } catch (e: any) {
      setMsg({
        ok: false,
        text: e.message?.includes("Invalid")
          ? "That is not a valid .excalidrawlib file."
          : e.message,
      });
    }
  };

  const exportFile = () => {
    const blob = new Blob([serializeLibraryAsJSON((items ?? []) as any)], {
      type: "application/vnd.excalidrawlib+json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.toLowerCase().replace(/\W+/g, "-")}.excalidrawlib`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const copySelected = () =>
    run(async () => {
      const chosen = (items ?? []).filter((i) => selected.has(i.id));
      await post(`${otherBase}/import`, { items: chosen });
      setSelected(new Set());
      return { items: items ?? [] };
    }, `Copied ${selected.size} item(s) to ${otherLabel}.`);

  return (
    <section className="lib-section">
      <div className="lib-head">
        <h2>{title}</h2>
        <span className="muted small">
          {items
            ? `${items.length} item${items.length === 1 ? "" : "s"}`
            : "Loading…"}
        </span>
        <div className="grow" />
        {!readOnly && (
          <>
            <input
              ref={file}
              type="file"
              accept=".excalidrawlib,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  void importFile(f);
                }
                e.target.value = "";
              }}
            />
            <button className="btn small" onClick={() => file.current?.click()}>
              Import…
            </button>
          </>
        )}
        <button
          className="btn small"
          disabled={!items?.length}
          onClick={exportFile}
        >
          Export
        </button>
        {otherBase && !readOnly && (
          <button
            className="btn small"
            disabled={selected.size === 0}
            onClick={copySelected}
          >
            Copy {selected.size || ""} to {otherLabel}
          </button>
        )}
        {!readOnly && (
          <button
            className="btn small danger"
            disabled={!items?.length}
            onClick={() =>
              window.confirm(`Delete all items in “${title}”?`) &&
              run(async () => {
                await del(base);
                return { items: [] };
              })
            }
          >
            Delete all
          </button>
        )}
      </div>
      {msg && (
        <div className={msg.ok ? "notice" : "form-error"} role="status">
          {msg.text}
        </div>
      )}
      {items && items.length === 0 && (
        <p className="muted">
          {readOnly
            ? "Nothing here yet."
            : "Empty. Import a .excalidrawlib file, or add shapes from the editor's library panel."}
        </p>
      )}
      <div className="lib-grid">
        {items?.map((i) => (
          <div
            key={i.id}
            className={`lib-item ${selected.has(i.id) ? "selected" : ""}`}
          >
            <label className="lib-check">
              <input
                type="checkbox"
                checked={selected.has(i.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) {
                    next.add(i.id);
                  } else {
                    next.delete(i.id);
                  }
                  setSelected(next);
                }}
                aria-label={`Select ${i.name ?? "item"}`}
              />
            </label>
            <Preview item={i} />
            <div className="lib-foot">
              <span className="ellipsis small">
                {i.name ??
                  `${i.elements.length} element${
                    i.elements.length === 1 ? "" : "s"
                  }`}
              </span>
              {!readOnly && (
                <button
                  className="icon-btn"
                  aria-label="Delete item"
                  title="Delete item"
                  onClick={() =>
                    run(() =>
                      put(base, {
                        items: (items ?? []).filter((x) => x.id !== i.id),
                      }),
                    )
                  }
                >
                  🗑
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export const LibrariesPage = () => {
  const { current } = useWorkspace();
  if (!current) {
    return null;
  }
  return (
    <div className="page">
      <header className="page-head">
        <h1>Libraries</h1>
      </header>
      <p className="muted">
        Your personal library is available in every scene. The workspace library
        is shared with all members of “{current.name}”.
      </p>
      <Section
        title="My library"
        base="/libraries/personal"
        otherBase={`/workspaces/${current.id}/library`}
        otherLabel="workspace"
      />
      <Section
        title="Workspace library"
        base={`/workspaces/${current.id}/library`}
        otherBase="/libraries/personal"
        otherLabel="my library"
      />
    </div>
  );
};
