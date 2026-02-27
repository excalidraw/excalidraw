import { useEffect, useRef, useState } from "react";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { pencilIcon, checkIcon } from "@excalidraw/excalidraw/components/icons";

import "./RoomNameDisplay.scss";
import { updateRoomMetadata } from "../data/roomMetadata";

type RoomNameDisplayProps = {
  roomId: string | null;
  roomName: string;
  onRoomNameChange?: (newName: string) => void;
};

export const RoomNameDisplay = ({
  roomId,
  roomName,
  onRoomNameChange,
}: RoomNameDisplayProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(roomName);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(roomName);
  }, [roomName]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const trimmedValue = editValue.trim();
    
    if (!trimmedValue || trimmedValue === roomName) {
      setIsEditing(false);
      setEditValue(roomName);
      return;
    }

    if (!roomId) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    
    try {
      const success = await updateRoomMetadata(roomId, {
        displayName: trimmedValue,
      });
      
      if (success) {
        onRoomNameChange?.(trimmedValue);
      } else {
        setEditValue(roomName);
      }
    } catch (error) {
      console.error("Failed to update room name:", error);
      setEditValue(roomName);
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(roomName);
      setIsEditing(false);
    }
  };

  if (!roomId) {
    return null;
  }

  return (
    <div className="room-name-display">
      {isEditing ? (
        <div className="room-name-edit">
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            disabled={isSaving}
            maxLength={100}
            className="room-name-input"
          />
          {isSaving && <span className="room-name-saving">Saving...</span>}
        </div>
      ) : (
        <div className="room-name-view">
          <span className="room-name-text" title={roomName}>
            {roomName}
          </span>
          <button
            className="room-name-edit-button"
            onClick={() => setIsEditing(true)}
            title="Edit room name"
            aria-label="Edit room name"
          >
            {pencilIcon}
          </button>
        </div>
      )}
    </div>
  );
};
