import { Dialog } from "@excalidraw/excalidraw/components/Dialog";

import React, { useCallback, useEffect, useState } from "react";

import { useAtom } from "../app-jotai";

import { renderTicketMarkdown } from "../data/ticketMarkdown";
import { settingsAtom } from "../data/settingsState";

import "./TicketsDialog.scss";

type TicketCard = {
  column: string;
  filename: string;
  title: string;
  type: string | null;
  risk: string | null;
  owner: string | null;
  opened: string | null;
  number: string | null;
  devId: string | null;
  problems: string[];
};

type BoardColumn = { id: string; label: string; tickets: TicketCard[] };

type Detail = { filename: string; column: string; markdown: string } | null;

/**
 * The tickets board — a **read-only** view over the repository's `tickets/`
 * directory. The files stay the source of truth; this is a lens, so it can
 * never become a second backlog.
 *
 * `tickets/open/feature-0006-uw-ticket-board-in-the-tool.md`.
 */
export const TicketsDialog = ({ onClose }: { onClose: () => void }) => {
  const [settings] = useAtom(settingsAtom);
  const api = settings?.ticketsApi;

  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Detail>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!api) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${api}/api/tickets`);
      if (!response.ok) {
        throw new Error(`GET /api/tickets returned ${response.status}`);
      }
      const board = await response.json();
      setColumns(board.columns ?? []);
      setTotal(board.total ?? 0);
    } catch (caught: any) {
      setError(caught?.message ?? String(caught));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const openTicket = useCallback(
    async (card: TicketCard) => {
      if (!api) {
        return;
      }
      try {
        const response = await fetch(
          `${api}/api/tickets/${card.column}/${card.filename}`,
        );
        if (!response.ok) {
          throw new Error(`GET the ticket returned ${response.status}`);
        }
        setDetail(await response.json());
      } catch (caught: any) {
        setError(caught?.message ?? String(caught));
      }
    },
    [api],
  );

  /**
   * Moving a ticket IS the status change: the server renames the file between
   * column folders, so the folder keeps meaning what it says. A name that breaks
   * the naming contract is refused BY THE SERVER, with its reason shown here
   * rather than swallowed.
   */
  const moveTicket = useCallback(
    async (card: TicketCard, to: string) => {
      if (!api) {
        return;
      }
      setMoving(card.filename);
      setMoveError(null);
      try {
        const response = await fetch(`${api}/api/tickets/move`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            column: card.column,
            filename: card.filename,
            to,
          }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error ?? `move returned ${response.status}`);
        }
        setDetail(null);
        await load();
      } catch (caught: any) {
        setMoveError(caught?.message ?? String(caught));
      } finally {
        setMoving(null);
      }
    },
    [api, load],
  );

  const COLUMN_IDS = ["open", "in-progress", "review", "done"] as const;

  return (
    <Dialog
      title={detail ? detail.filename : "Tickets"}
      size="wide"
      onCloseRequest={detail ? () => setDetail(null) : onClose}
      className="tickets-dialog"
    >
      {!api && (
        <p className="tickets-dialog__hint">
          No tickets board configured. Start the board (
          <code>node server/tickets/index.mjs</code>) and set its URL in
          Settings.
        </p>
      )}

      {api && moveError && !detail && (
        <p className="tickets-dialog__error">{moveError}</p>
      )}

      {api && error && (
        <p className="tickets-dialog__error">
          {error}{" "}
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}

      {api && !error && detail && (
        <div className="tickets-dialog__detail">
          <div className="tickets-dialog__move">
            <span>Move to</span>
            {COLUMN_IDS.filter((id) => id !== detail.column).map((id) => (
              <button
                type="button"
                key={id}
                disabled={moving !== null}
                onClick={() =>
                  void moveTicket(
                    {
                      column: detail.column,
                      filename: detail.filename,
                    } as TicketCard,
                    id,
                  )
                }
              >
                {id}
              </button>
            ))}
            {moving && <span className="tickets-dialog__meta">moving…</span>}
          </div>
          {moveError && <p className="tickets-dialog__error">{moveError}</p>}
          <div
            className="tickets-dialog__markdown"
            // Safe by construction: renderTicketMarkdown ESCAPES the source before
            // it adds any tag of its own, so a ticket file can never inject markup.
            dangerouslySetInnerHTML={{
              __html: renderTicketMarkdown(detail.markdown),
            }}
          />
        </div>
      )}

      {api && !error && !detail && (
        <>
          <p className="tickets-dialog__hint">
            {loading
              ? "Loading…"
              : `${total} ticket${total === 1 ? "" : "s"} — read-only.`}
          </p>
          <div className="tickets-dialog__board">
            {columns.map((column) => (
              <div className="tickets-dialog__column" key={column.id}>
                <h4>
                  {column.label}{" "}
                  <span className="tickets-dialog__count">
                    {column.tickets.length}
                  </span>
                </h4>
                {column.tickets.length === 0 && (
                  <p className="tickets-dialog__empty">—</p>
                )}
                {column.tickets.map((card) => (
                  <button
                    type="button"
                    key={card.filename}
                    className="tickets-dialog__card"
                    onClick={() => void openTicket(card)}
                  >
                    <span className="tickets-dialog__card-title">
                      {card.title}
                    </span>
                    <span className="tickets-dialog__meta">
                      {[
                        card.type,
                        card.risk && `risk: ${card.risk}`,
                        card.owner,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {card.problems.map((problem) => (
                      <span
                        className="tickets-dialog__problem"
                        key={problem}
                        title={problem}
                      >
                        ⚠ {problem}
                      </span>
                    ))}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </Dialog>
  );
};
