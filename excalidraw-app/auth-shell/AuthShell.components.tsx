import type { CSSProperties, ReactNode } from "react";

/**
 * Shared UI components for AuthShell
 * Extracted to reduce duplication across AuthGate.tsx
 */

// ============================================================================
// Layout Components
// ============================================================================

interface CenteredContainerProps {
  children: ReactNode;
  backgroundColor?: string;
}

export function CenteredContainer({
  children,
  backgroundColor = "#f9fafb",
}: CenteredContainerProps) {
  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor,
        display: "flex",
        fontFamily: "Inter, system-ui, sans-serif",
        height: "100vh",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      {children}
    </div>
  );
}

interface CardProps {
  children: ReactNode;
  maxWidth?: string;
  padding?: string;
  textAlign?: CSSProperties["textAlign"];
}

export function Card({
  children,
  maxWidth = "28rem",
  padding = "2.5rem",
  textAlign = "center",
}: CardProps) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "1rem",
        boxShadow: "0 1.5rem 4rem rgba(15, 23, 42, 0.15)",
        maxWidth,
        padding,
        textAlign,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Status Icons
// ============================================================================

interface StatusIconProps {
  type: "success" | "warning" | "loading";
}

export function StatusIcon({ type }: StatusIconProps) {
  if (type === "success") {
    return (
      <div
        style={{
          backgroundColor: "#10b981",
          borderRadius: "50%",
          color: "#ffffff",
          fontSize: "2.5rem",
          height: "4rem",
          lineHeight: "4rem",
          margin: "0 auto 1.5rem",
          width: "4rem",
        }}
      >
        ✓
      </div>
    );
  }

  if (type === "warning") {
    return (
      <div
        style={{
          backgroundColor: "#f59e0b",
          borderRadius: "50%",
          color: "#ffffff",
          fontSize: "2rem",
          height: "4rem",
          lineHeight: "4rem",
          margin: "0 auto 1.5rem",
          width: "4rem",
        }}
      >
        ⏱
      </div>
    );
  }

  // Loading spinner
  return (
    <>
      <div
        style={{
          animation: "spin 1s linear infinite",
          border: "4px solid #e5e7eb",
          borderRadius: "50%",
          borderTopColor: "#3b82f6",
          height: "4rem",
          margin: "0 auto 1.5rem",
          width: "4rem",
        }}
      />
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </>
  );
}

// ============================================================================
// Buttons
// ============================================================================

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  type?: "button" | "submit";
  fullWidth?: boolean;
}

export function Button({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  type = "button",
  fullWidth = false,
}: ButtonProps) {
  const isPrimary = variant === "primary";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        backgroundColor: isPrimary ? "#111827" : "#ffffff",
        border: isPrimary ? "none" : "1px solid #d0d5dd",
        borderRadius: "0.75rem",
        color: isPrimary ? "#ffffff" : "#111827",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "1rem",
        fontWeight: 600,
        opacity: disabled ? 0.7 : 1,
        padding: "0.875rem 1.5rem",
        width: fullWidth ? "100%" : "auto",
      }}
    >
      {children}
    </button>
  );
}

interface ActionButtonProps {
  children: ReactNode;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  backgroundColor?: string;
  hoverBackgroundColor?: string;
}

export function ActionButton({
  children,
  onClick,
  disabled = false,
  backgroundColor = "#6366f1",
  hoverBackgroundColor = "#4f46e5",
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        backgroundColor,
        border: "none",
        borderRadius: "0.5rem",
        color: "#ffffff",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "1rem",
        fontWeight: 600,
        padding: "0.85rem 1.75rem",
        width: "100%",
        opacity: disabled ? 0.7 : 1,
        transition: "background-color 0.2s",
      }}
      onMouseEnter={(event) => {
        if (!disabled) {
          event.currentTarget.style.backgroundColor = hoverBackgroundColor;
        }
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.backgroundColor = backgroundColor;
      }}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Text Components
// ============================================================================

interface HeadingProps {
  children: ReactNode;
  level?: 1 | 2;
  marginBottom?: string;
}

export function Heading({
  children,
  level = 1,
  marginBottom = "1rem",
}: HeadingProps) {
  const style = {
    color: "#111827",
    fontSize: level === 1 ? "1.75rem" : "1.5rem",
    fontWeight: 700,
    marginBottom,
  };

  if (level === 2) {
    return <h2 style={style}>{children}</h2>;
  }

  return <h1 style={style}>{children}</h1>;
}

interface TextProps {
  children: ReactNode;
  color?: string;
  fontSize?: string;
  marginBottom?: string;
  lineHeight?: string;
}

export function Text({
  children,
  color = "#6b7280",
  fontSize = "1rem",
  marginBottom = "0",
  lineHeight = "1.6",
}: TextProps) {
  return (
    <p style={{ color, fontSize, lineHeight, marginBottom }}>{children}</p>
  );
}

// ============================================================================
// Badge Component
// ============================================================================

interface BadgeProps {
  children: ReactNode;
  variant?: "success" | "warning" | "info";
}

export function Badge({ children, variant = "success" }: BadgeProps) {
  const getColors = () => {
    switch (variant) {
      case "success":
        return { bg: "#22c55e", text: "#052e16" };
      case "warning":
        return { bg: "#f59e0b", text: "#78350f" };
      case "info":
        return { bg: "#3b82f6", text: "#1e3a8a" };
      default:
        return { bg: "#22c55e", text: "#052e16" };
    }
  };

  const colors = getColors();

  return (
    <span
      style={{
        backgroundColor: colors.bg,
        borderRadius: "9999px",
        color: colors.text,
        fontSize: "0.75rem",
        fontWeight: 700,
        padding: "0.25rem 0.75rem",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {children}
    </span>
  );
}

// ============================================================================
// Alert Component
// ============================================================================

interface AlertProps {
  children: ReactNode;
  variant?: "error" | "warning";
  marginBottom?: string;
}

export function Alert({
  children,
  variant = "error",
  marginBottom = "1.5rem",
}: AlertProps) {
  const isError = variant === "error";

  return (
    <div
      style={{
        backgroundColor: isError ? "#fef2f2" : "#fef3c7",
        border: `1px solid ${isError ? "#fecaca" : "#fbbf24"}`,
        borderRadius: "0.75rem",
        color: isError ? "#991b1b" : "#92400e",
        marginBottom,
        padding: "1rem",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Button Group
// ============================================================================

interface ButtonGroupProps {
  children: ReactNode;
  gap?: string;
  direction?: "row" | "column";
}

export function ButtonGroup({
  children,
  gap = "0.75rem",
  direction = "column",
}: ButtonGroupProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: direction,
        gap,
      }}
    >
      {children}
    </div>
  );
}
