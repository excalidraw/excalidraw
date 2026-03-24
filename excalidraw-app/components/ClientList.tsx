import React, { useState, useCallback } from "react";
import { useAtom } from "../app-jotai";

import {
  getClients,
  createClient,
  deleteClient,
  updateClient,
} from "../data/firebase";
import {
  clientsAtom,
  currentClientIdAtom,
  drawingsAtom,
} from "../store/drawingState";
import { getDrawings } from "../data/firebase";

export const ClientList: React.FC = () => {
  const [clients, setClients] = useAtom(clientsAtom);
  const [, setCurrentClientId] = useAtom(currentClientIdAtom);
  const [, setDrawings] = useAtom(drawingsAtom);
  const [newClientName, setNewClientName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  const loadClients = useCallback(async () => {
    try {
      const loaded = await getClients();
      setClients(loaded);
      setIsLoaded(true);
    } catch (error) {
      console.error("Error loading clients:", error);
    }
  }, [setClients]);

  // Load clients on first render
  React.useEffect(() => {
    if (!isLoaded) {
      loadClients();
    }
  }, [isLoaded, loadClients]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      return;
    }
    setIsCreating(true);
    try {
      await createClient(newClientName.trim());
      setNewClientName("");
      await loadClients();
    } catch (error) {
      console.error("Error creating client:", error);
    }
    setIsCreating(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete client "${name}" and all their drawings?`)) {
      return;
    }
    try {
      await deleteClient(id);
      await loadClients();
    } catch (error) {
      console.error("Error deleting client:", error);
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await updateClient(id, editName.trim());
      setEditingId(null);
      await loadClients();
    } catch (error) {
      console.error("Error renaming client:", error);
    }
  };

  const handleSelectClient = async (clientId: string) => {
    setCurrentClientId(clientId);
    try {
      const drawings = await getDrawings(clientId);
      setDrawings(drawings);
    } catch (error) {
      console.error("Error loading drawings:", error);
    }
  };

  return (
    <div style={{ padding: "0.5rem" }}>
      <div
        style={{
          fontWeight: 600,
          fontSize: "0.9rem",
          marginBottom: "0.75rem",
          color: "var(--color-on-surface, #333)",
        }}
      >
        Clients
      </div>

      <form
        onSubmit={handleCreate}
        style={{ display: "flex", gap: "0.25rem", marginBottom: "0.75rem" }}
      >
        <input
          type="text"
          value={newClientName}
          onChange={(e) => setNewClientName(e.target.value)}
          placeholder="New client name..."
          disabled={isCreating}
          style={{
            flex: 1,
            padding: "0.4rem 0.5rem",
            fontSize: "0.8rem",
            border: "1px solid var(--color-border-outline, #ddd)",
            borderRadius: "4px",
            background: "var(--color-surface-high, #fff)",
            color: "var(--color-on-surface, #333)",
          }}
        />
        <button
          type="submit"
          disabled={isCreating || !newClientName.trim()}
          style={{
            padding: "0.4rem 0.6rem",
            fontSize: "0.8rem",
            background: "#6965db",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            opacity: isCreating || !newClientName.trim() ? 0.5 : 1,
          }}
        >
          +
        </button>
      </form>

      {clients.length === 0 && isLoaded && (
        <div
          style={{
            textAlign: "center",
            color: "var(--color-on-surface, #999)",
            fontSize: "0.8rem",
            padding: "1rem 0",
          }}
        >
          No clients yet. Create one above.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {clients.map((client) => (
          <div
            key={client.id}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0.5rem",
              borderRadius: "6px",
              cursor: "pointer",
              background: "var(--color-surface-high, transparent)",
              fontSize: "0.85rem",
            }}
            onClick={() => handleSelectClient(client.id)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "var(--color-surface-lowest, #f0f0f0)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                "var(--color-surface-high, transparent)";
            }}
          >
            {editingId === client.id ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleRename(client.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRename(client.id);
                  }
                  if (e.key === "Escape") {
                    setEditingId(null);
                  }
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1,
                  padding: "0.2rem 0.4rem",
                  fontSize: "0.85rem",
                  border: "1px solid #6965db",
                  borderRadius: "4px",
                }}
              />
            ) : (
              <>
                <span style={{ flex: 1 }}>
                  {client.name}
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      fontSize: "0.7rem",
                      color: "var(--color-on-surface, #999)",
                    }}
                  >
                    ({client.drawingCount})
                  </span>
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(client.id);
                    setEditName(client.name);
                  }}
                  title="Rename"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0.15rem 0.3rem",
                    fontSize: "0.75rem",
                    opacity: 0.5,
                    color: "var(--color-on-surface, #333)",
                  }}
                >
                  ✎
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(client.id, client.name);
                  }}
                  title="Delete"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0.15rem 0.3rem",
                    fontSize: "0.75rem",
                    opacity: 0.5,
                    color: "#e53e3e",
                  }}
                >
                  ✕
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
