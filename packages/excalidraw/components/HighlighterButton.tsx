import clsx from "clsx";

import { KEYS } from "@excalidraw/common";

import { ToolButton } from "./ToolButton";
import { HighlighterIcon } from "./icons";

import "./ToolIcon.scss";

type HighlighterButtonProps = {
    title?: string;
    name?: string;
    checked: boolean;
    onChange?(): void;
    isMobile?: boolean;
};

export const HighlighterButton = (props: HighlighterButtonProps) => {
    return (
        <ToolButton
            className={clsx("Shape", { fillable: false, active: props.checked })}
            type="radio"
            icon={HighlighterIcon}
            name="editor-current-shape"
            checked={props.checked}
            title={`${props.title} — ${KEYS.Y.toLocaleUpperCase()}`}
            keyBindingLabel={!props.isMobile ? KEYS.Y.toLocaleUpperCase() : undefined}
            aria-label={`${props.title} — ${KEYS.Y.toLocaleUpperCase()}`}
            aria-keyshortcuts={KEYS.Y}
            data-testid={`toolbar-highlighter`}
            onChange={() => props.onChange?.()}
        />
    );
};

