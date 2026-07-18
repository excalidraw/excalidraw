import React, { useState, useRef, useEffect, useCallback } from "react";

import { IMAGE_MIME_TYPES, KEYS, MIME_TYPES } from "@excalidraw/common";

import {
  ImageIcon,
  SendIcon,
  CloseIcon,
  playerStopFilledIcon,
} from "../components/icons";
import { generateIdFromFile, getDataURL, resizeImageFile } from "../data/blob";
import { fileOpen } from "../data/filesystem";
import { useI18n } from "../i18n";

import { TTAWarningMessage } from "./TTAWarningMessage";
import "./TTAComposer.scss";

export type TTAComposerImage = {
  hash: string;
  image: string;
};

interface TTAComposerProps {
  onSend: (message: string, images?: string[]) => void;
  onStop?: () => void;
  isSending?: boolean;
  value: string;
  onChange: (value: string) => void;
  images: TTAComposerImage[];
  onImagesChange: (images: TTAComposerImage[]) => void;
  maxImages: number;
  onMaxImages?: (maxImages: number) => React.ReactNode;
  placeholder?: string;
  onPreviewImage?: (url: string) => void;
  disabled?: boolean;
}

const prepareImageAttachment = async (file: File) => {
  const resizedFile = await resizeImageFile(file, {
    outputType: MIME_TYPES.jpg,
    maxWidthOrHeight: 1024,
  });

  return {
    hash: await generateIdFromFile(resizedFile),
    image: await getDataURL(resizedFile),
  };
};

const TTAComposer: React.FC<TTAComposerProps> = ({
  onSend,
  onStop,
  isSending = false,
  value: inputValue,
  onChange,
  images: selectedImages,
  onImagesChange,
  maxImages: MAX_IMAGES,
  onMaxImages,
  placeholder,
  onPreviewImage,
  disabled = false,
}) => {
  const { t } = useI18n();
  const [maxImagesWarning, setMaxImagesWarning] =
    useState<React.ReactNode>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // `appendImageFiles` reads the image list across `await`s, where the
  // `images` prop may be a render behind — the ref always holds the latest.
  const selectedImagesRef = useRef<readonly TTAComposerImage[]>([]);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  const updateImages = useCallback(
    (next: TTAComposerImage[]) => {
      selectedImagesRef.current = next;
      onImagesChange(next);
    },
    [onImagesChange],
  );

  const resetValue = useCallback(() => {
    onChange("");
    updateImages([]);
    setMaxImagesWarning(null);
  }, [onChange, updateImages]);

  const showMaxImagesWarning = useCallback(() => {
    setMaxImagesWarning(
      onMaxImages
        ? onMaxImages(MAX_IMAGES)
        : MAX_IMAGES === 1
        ? t("ai.input.maxImages_one")
        : t("ai.input.maxImages", { maxImages: MAX_IMAGES }),
    );
  }, [MAX_IMAGES, onMaxImages, t]);

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    const maxHeight = 240;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    handleInput();
  }, [handleInput, inputValue]);

  const appendImageFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) {
        return;
      }

      const currentImages = selectedImagesRef.current;
      const remainingSlots = MAX_IMAGES - currentImages.length;

      if (remainingSlots <= 0) {
        showMaxImagesWarning();
        return;
      }

      const currentImageHashes = new Set(
        currentImages.map((image) => image.hash),
      );
      const candidateHashes = new Set<string>();
      const imagesToAdd: TTAComposerImage[] = [];
      let hasUniqueOverflow = false;

      for (const file of files) {
        try {
          const { hash, image } = await prepareImageAttachment(file);

          if (currentImageHashes.has(hash) || candidateHashes.has(hash)) {
            continue;
          }

          if (imagesToAdd.length >= remainingSlots) {
            hasUniqueOverflow = true;
            break;
          }

          candidateHashes.add(hash);
          imagesToAdd.push({ hash, image });
        } catch (error) {
          console.error("Failed to process image:", error);
        }
      }

      if (!imagesToAdd.length) {
        if (hasUniqueOverflow) {
          showMaxImagesWarning();
        }
        return;
      }

      updateImages([...currentImages, ...imagesToAdd]);

      if (hasUniqueOverflow) {
        showMaxImagesWarning();
      } else {
        setMaxImagesWarning(null);
      }
    },
    [MAX_IMAGES, showMaxImagesWarning, updateImages],
  );

  const handleSend = useCallback(() => {
    if (disabled) {
      return;
    }

    const trimmed = inputValue.trim();
    if (!trimmed && !selectedImages.length) {
      return;
    }

    onSend(
      trimmed,
      selectedImages.length
        ? selectedImages.map((image) => image.image)
        : undefined,
    );
    resetValue();

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }, 0);
    }
  }, [disabled, inputValue, selectedImages, onSend, resetValue]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === KEYS.ENTER &&
      !event.shiftKey &&
      // don't submit on IME composition confirm
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleWheelCapture = (event: React.WheelEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
  };

  const handleOpenImagePicker = async () => {
    if (disabled) {
      return;
    }

    if (selectedImagesRef.current.length >= MAX_IMAGES) {
      showMaxImagesWarning();
      return;
    }

    try {
      const files = await fileOpen({
        description: "Image",
        extensions: Object.keys(
          IMAGE_MIME_TYPES,
        ) as (keyof typeof IMAGE_MIME_TYPES)[],
        multiple: true,
      });
      await appendImageFiles(files);
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Failed to select image:", error);
      }
    }
  };

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (disabled) {
        return;
      }

      const items = event.clipboardData?.items;
      if (!items || items.length === 0) {
        return;
      }

      const imageFiles = Array.from(items)
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));

      if (!imageFiles.length) {
        return;
      }

      event.preventDefault();
      await appendImageFiles(imageFiles);
    },
    [appendImageFiles, disabled],
  );

  const hasContent = inputValue.trim().length > 0 || selectedImages.length > 0;
  const canSend = hasContent && !isSending && !disabled;

  return (
    <div className="tta-composer">
      {maxImagesWarning && (
        <TTAWarningMessage>{maxImagesWarning}</TTAWarningMessage>
      )}
      {selectedImages.length > 0 && (
        <div className="tta-composer__preview">
          {selectedImages.map((selectedImage, index) => (
            <div
              key={`${selectedImage.hash}-${index}`}
              className="tta-composer__preview-image-container"
              role={onPreviewImage ? "button" : undefined}
              tabIndex={onPreviewImage ? 0 : undefined}
              aria-label={
                onPreviewImage ? t("ai.chat.enlargedPreview") : undefined
              }
              onClick={() => onPreviewImage?.(selectedImage.image)}
              onKeyDown={(event) => {
                if (
                  onPreviewImage &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();
                  onPreviewImage(selectedImage.image);
                }
              }}
            >
              <img
                src={selectedImage.image}
                alt={t("ai.chat.attachedImage")}
                className="tta-composer__preview-image"
              />
              <button
                className="tta-composer__preview-close"
                onClick={(event) => {
                  event.stopPropagation();
                  updateImages(
                    selectedImages.filter(
                      (_, imageIndex) => imageIndex !== index,
                    ),
                  );
                  setMaxImagesWarning(null);
                }}
                onKeyDown={(event) => {
                  event.stopPropagation();
                }}
                aria-label={t("buttons.remove")}
              >
                {CloseIcon}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="tta-composer__container">
        <div className="tta-composer__textarea-wrapper">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onWheelCapture={handleWheelCapture}
            placeholder={placeholder || t("ai.input.placeholder")}
            rows={1}
            className="tta-composer__textarea"
            style={{ minHeight: "24px" }}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="tta-composer__toolbar">
        <div className="tta-composer__toolbar-section">
          <button
            type="button"
            className="tta-composer__icon-button tta-composer__icon-button--image"
            aria-label={t("ai.input.add")}
            onClick={handleOpenImagePicker}
            disabled={disabled}
          >
            <span className="tta-composer__image-icon">{ImageIcon}</span>
          </button>
        </div>

        <div className="tta-composer__toolbar-section">
          {isSending && onStop ? (
            <button
              type="button"
              onClick={onStop}
              className="tta-composer__stop-btn"
              aria-label={t("ai.input.stop")}
            >
              <span className="tta-composer__stop-icon">
                {playerStopFilledIcon}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className={`tta-composer__send-btn${
                canSend ? " tta-composer__send-btn--active" : ""
              }`}
              aria-label={t("ai.input.send")}
            >
              <span
                className={`tta-composer__send-icon${
                  hasContent ? " tta-composer__send-icon--active" : ""
                }`}
              >
                {SendIcon}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TTAComposer;
