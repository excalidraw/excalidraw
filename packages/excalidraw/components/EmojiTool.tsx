import { Popover } from "radix-ui";
import React, { useState } from "react";

import { t } from "../i18n";

import { useExcalidrawContainer } from "./App";
import { IconButton } from "./IconButton";
import { EmojiIcon } from "./icons";
import { isToolButtonDisabled } from "./Tools";
import { PropertiesPopover } from "./PropertiesPopover";

import type { AppClassProperties, UIAppState } from "../types";

import "./EmojiTool.scss";

const COMMON_EMOJIS = [
  "😀",
  "😂",
  "😍",
  "🥳",
  "😎",
  "🤔",
  "😭",
  "👍",
  "👎",
  "👏",
  "🙏",
  "🔥",
  "✨",
  "🎉",
  "❤️",
  "💯",
  "✅",
  "❌",
  "⭐",
  "🚀",
  "💡",
  "📌",
  "🎨",
  "🌈",
  "🐶",
  "🐱",
  "🌍",
  "☀️",
  "🌙",
  "🍕",
  "☕",
  "🎵",
] as const;

export const EmojiTool = ({
  app,
  activeTool,
}: {
  app: AppClassProperties;
  activeTool: UIAppState["activeTool"];
}) => {
  const { container } = useExcalidrawContainer();
  const [open, setOpen] = useState(false);
  const [customEmoji, setCustomEmoji] = useState("");
  const label = t("toolBar.emoji");

  const selectEmoji = (emoji: string) => {
    if (!emoji.trim()) {
      return;
    }
    app.setEmoji(emoji);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <IconButton
          type="toggle"
          icon={EmojiIcon}
          checked={activeTool.type === "emoji"}
          disabled={isToolButtonDisabled(app, "emoji")}
          title={label}
          aria-label={label}
          data-testid="toolbar-emoji"
          onSelect={() => setOpen((isOpen) => !isOpen)}
        />
      </Popover.Trigger>
      {open && (
        <PropertiesPopover
          className="EmojiTool-picker"
          container={container}
          onClose={() => setOpen(false)}
        >
          <div
            className="EmojiTool-picker__content"
            role="dialog"
            aria-label={label}
          >
            <div className="EmojiTool-picker__grid" aria-label="Emoji choices">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  className="EmojiTool-picker__emoji"
                  aria-label={emoji}
                  onClick={() => selectEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <label className="EmojiTool-picker__custom">
              <span>Type or paste any emoji</span>
              <div>
                <input
                  value={customEmoji}
                  onChange={(event) => setCustomEmoji(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      selectEmoji(customEmoji);
                    }
                  }}
                  aria-label="Type or paste any emoji"
                  placeholder="??"
                />
                <button
                  type="button"
                  disabled={!customEmoji.trim()}
                  onClick={() => selectEmoji(customEmoji)}
                >
                  Use
                </button>
              </div>
            </label>
          </div>
        </PropertiesPopover>
      )}
    </Popover.Root>
  );
};
