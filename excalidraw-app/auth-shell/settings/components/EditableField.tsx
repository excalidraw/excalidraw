import { useState } from "react";

interface EditableFieldProps {
  label: string;
  value: string | undefined;
  placeholder?: string;
  subtitle?: string;
  onSave: (value: string) => Promise<void>;
  multiline?: boolean;
}

export function EditableField({
  label,
  value,
  placeholder = "Not set",
  subtitle,
  onSave,
  multiline = false,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = () => {
    setEditValue(value || "");
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setEditValue(value || "");
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (err: any) {
      console.error("Failed to save:", err);
      setError(err.message || "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const displayValue = value || placeholder;
  const isPlaceholder = !value;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "0.5rem",
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 600,
              marginBottom: "0.25rem",
            }}
          >
            {label}
          </div>

          {subtitle && (
            <div
              style={{
                color: "#9ca3af",
                fontSize: "0.8125rem",
                marginBottom: "0.5rem",
              }}
            >
              {subtitle}
            </div>
          )}

          {!isEditing ? (
            <div
              style={{
                color: isPlaceholder ? "#6b7280" : "#d1d5db",
                fontSize: "0.875rem",
                fontStyle: isPlaceholder ? "italic" : "normal",
                wordBreak: "break-word",
              }}
            >
              {displayValue}
            </div>
          ) : (
            <div>
              {multiline ? (
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: "#1e1e1e",
                    border: "1px solid #3c3c3c",
                    borderRadius: "0.375rem",
                    color: "#ffffff",
                    padding: "0.5rem",
                    fontSize: "0.875rem",
                    fontFamily: "inherit",
                    resize: "vertical",
                    minHeight: "80px",
                  }}
                  placeholder={placeholder}
                  autoFocus
                />
              ) : (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: "#1e1e1e",
                    border: "1px solid #3c3c3c",
                    borderRadius: "0.375rem",
                    color: "#ffffff",
                    padding: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                  placeholder={placeholder}
                  autoFocus
                />
              )}

              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginTop: "0.5rem",
                }}
              >
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  style={{
                    backgroundColor: "#8b5cf6",
                    color: "#ffffff",
                    border: "none",
                    padding: "0.375rem 0.75rem",
                    borderRadius: "0.375rem",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    cursor: isSaving ? "not-allowed" : "pointer",
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  style={{
                    backgroundColor: "transparent",
                    color: "#9ca3af",
                    border: "1px solid #3c3c3c",
                    padding: "0.375rem 0.75rem",
                    borderRadius: "0.375rem",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    cursor: isSaving ? "not-allowed" : "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>

              {error && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    color: "#ef4444",
                    fontSize: "0.8125rem",
                  }}
                >
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {!isEditing && (
          <button
            onClick={handleEdit}
            style={{
              backgroundColor: "transparent",
              border: "none",
              color: "#8b5cf6",
              cursor: "pointer",
              padding: "0.25rem",
              marginLeft: "1rem",
            }}
            title="Edit"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
