import {
  DuplicateIcon,
  PlusIcon,
  TrashIcon,
  pencilIcon,
  searchIcon,
} from "@excalidraw/excalidraw/components/icons";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useHandleAppTheme } from "../useHandleAppTheme";

import { notesApi } from "./notesApi";

import "./NotesGallery.scss";

import type { NoteSummary } from "./notesApi";

const UNTITLED = "Sem título";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export const NotesGallery = ({
  onOpenNote,
}: {
  onOpenNote: (noteId: string) => void;
}) => {
  const { editorTheme } = useHandleAppTheme();
  const [notes, setNotes] = useState<NoteSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const refresh = useCallback(
    () =>
      notesApi
        .list()
        .then((notes) => {
          setNotes(notes);
          setError(null);
        })
        .catch((error) => setError(error.message)),
    [],
  );

  useEffect(() => {
    document.title = "Minhas notas — Excalidraw Notes";
    refresh();
  }, [refresh]);

  const run = (action: () => Promise<unknown>) =>
    action()
      .then(refresh)
      .catch((error) => setError(error.message));

  const createNote = () =>
    notesApi
      .create()
      .then((note) => onOpenNote(note.id))
      .catch((error) => setError(error.message));

  const renameNote = (note: NoteSummary) => {
    const title = window.prompt("Nome da nota", note.title);
    if (title !== null && title !== note.title) {
      run(() => notesApi.update(note.id, { title }));
    }
  };

  const deleteNote = (note: NoteSummary) => {
    if (window.confirm(`Excluir "${note.title || UNTITLED}"?`)) {
      run(() => notesApi.remove(note.id));
    }
  };

  const visibleNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (notes ?? []).filter((note) =>
      (note.title || UNTITLED).toLowerCase().includes(normalizedQuery),
    );
  }, [notes, query]);

  return (
    <div
      className={clsx("notes-gallery", {
        "notes-gallery--dark": editorTheme === "dark",
      })}
    >
      <header className="notes-gallery__header">
        <h1>Minhas notas</h1>
        <label className="notes-gallery__search">
          {searchIcon}
          <input
            type="search"
            placeholder="Buscar notas"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="notes-gallery__create"
          onClick={createNote}
        >
          {PlusIcon}
          Nova nota
        </button>
      </header>

      {error && <p className="notes-gallery__error">{error}</p>}

      {notes && !notes.length && (
        <div className="notes-gallery__empty">
          <p>Nenhuma nota ainda.</p>
          <button
            type="button"
            className="notes-gallery__create"
            onClick={createNote}
          >
            {PlusIcon}
            Criar a primeira nota
          </button>
        </div>
      )}

      {notes && !!notes.length && !visibleNotes.length && (
        <p className="notes-gallery__empty">
          Nenhuma nota encontrada para "{query}".
        </p>
      )}

      <ul className="notes-gallery__grid">
        {visibleNotes.map((note) => (
          <li key={note.id} className="notes-gallery__card">
            <button
              type="button"
              className="notes-gallery__thumbnail"
              onClick={() => onOpenNote(note.id)}
              aria-label={`Abrir ${note.title || UNTITLED}`}
            >
              {note.hasThumbnail ? (
                <img src={notesApi.thumbnailURL(note)} alt="" loading="lazy" />
              ) : (
                <span>Nota vazia</span>
              )}
            </button>
            <div className="notes-gallery__info">
              <div className="notes-gallery__meta">
                <span
                  className={clsx("notes-gallery__title", {
                    "notes-gallery__title--untitled": !note.title,
                  })}
                  title={note.title || UNTITLED}
                >
                  {note.title || UNTITLED}
                </span>
                <span className="notes-gallery__date">
                  {dateFormatter.format(note.updatedAt)}
                </span>
              </div>
              <div className="notes-gallery__actions">
                <button
                  type="button"
                  title="Renomear"
                  onClick={() => renameNote(note)}
                >
                  {pencilIcon}
                </button>
                <button
                  type="button"
                  title="Duplicar"
                  onClick={() => run(() => notesApi.duplicate(note.id))}
                >
                  {DuplicateIcon}
                </button>
                <button
                  type="button"
                  title="Excluir"
                  className="notes-gallery__delete"
                  onClick={() => deleteNote(note)}
                >
                  {TrashIcon}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
