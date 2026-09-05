import { useState } from "react";

import DownloadMenu from "@/components/DownloadMenu";
import clipboardIcon from "@/assets/icons/clipboard.svg";
import pencilIcon from "@/assets/icons/pencil.svg";
import type { Message } from "@/types";

interface AIResponseBoxProps {
  message: Message;
  onEdit?: (id: string, content: string) => void;
}

export function AIResponseBox({ message, onEdit }: AIResponseBoxProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const editing = draft !== null;

  const copy = async () => {
    await navigator.clipboard?.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const image = message.images?.[0];

  const save = (href: string, filename: string) => {
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    link.click();
  };

  const download = (format: string) => {
    if (format === "excalidraw") {
      if (!message.scene) {
        return;
      }

      const url = URL.createObjectURL(
        new Blob([JSON.stringify(message.scene, null, 2)], {
          type: "application/json",
        }),
      );
      save(url, "diagram.excalidraw");
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      return;
    }

    if (image) {
      save(image.url, `diagram.${format}`);
    }
  };

  const saveEdit = () => {
    if (draft !== null) {
      onEdit?.(message.id, draft);
    }
    setDraft(null);
  };

  return (
    <article className="message message--ai">
      {editing ? (
        <div className="message__edit">
          <textarea
            className="message__edit-input"
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="message__edit-actions">
            <button type="button" onClick={saveEdit}>
              Save
            </button>
            <button type="button" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="message__text">
          {message.content}
          {message.pending && <span className="message__caret" />}
        </div>
      )}

      {message.images?.map((image) => (
        <img
          key={image.url}
          className="message__image"
          src={image.url}
          alt={image.alt ?? ""}
        />
      ))}

      {!message.pending && !editing && (
        <div className="message__actions">
          <button
            className="message__action"
            type="button"
            onClick={copy}
            aria-label="Copy response"
            title="Copy"
          >
            <img src={clipboardIcon} alt="" width={26} height={26} />
          </button>
          <button
            className="message__action"
            type="button"
            onClick={() => setDraft(message.content)}
            aria-label="Edit response"
            title="Edit"
          >
            <img src={pencilIcon} alt="" width={26} height={26} />
          </button>
          <DownloadMenu
            options={[
              { id: "png", label: "Download as png", disabled: !image },
              { id: "svg", label: "Download as svg", disabled: !image },
              { id: "excalidraw", label: "Download as .exc", disabled: !message.scene },
            ]}
            onSelect={download}
          />
          {copied && <span className="message__copied">Copied</span>}
        </div>
      )}
    </article>
  );
}

export default AIResponseBox;
