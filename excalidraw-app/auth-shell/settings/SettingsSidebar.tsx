interface SettingsSidebarProps {
  currentPage: "billing" | "manage" | "profile";
  onNavigate: (page: "billing" | "manage" | "profile") => void;
}

export function SettingsSidebar({ currentPage, onNavigate }: SettingsSidebarProps) {
  const navItemStyle = (isActive: boolean) => ({
    backgroundColor: isActive ? "#3c3c3c" : "transparent",
    border: "none",
    borderLeft: isActive ? "3px solid #8b5cf6" : "3px solid transparent",
    color: isActive ? "#ffffff" : "#9ca3af",
    cursor: "pointer",
    display: "block",
    fontSize: "0.875rem",
    fontWeight: isActive ? 600 : 400,
    padding: "0.75rem 1rem",
    textAlign: "left" as const,
    transition: "all 0.2s",
    width: "100%",
  });

  const sectionTitleStyle = {
    color: "#6b7280",
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "0.05em",
    marginBottom: "0.5rem",
    marginTop: "1.5rem",
    padding: "0 1rem",
    textTransform: "uppercase" as const,
  };

  return (
    <div
      style={{
        backgroundColor: "#1e1e1e",
        borderRight: "1px solid #3c3c3c",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        minWidth: "240px",
        width: "240px",
      }}
    >
      <div style={{ padding: "1.5rem 1rem" }}>
        <h2
          style={{
            color: "#ffffff",
            fontSize: "1.25rem",
            fontWeight: 700,
            margin: 0,
          }}
        >
          Settings
        </h2>
      </div>

      <nav style={{ flex: 1, overflowY: "auto" }}>
        {/* Subscription Section */}
        <div style={sectionTitleStyle}>Subscription</div>
        <button
          onClick={() => onNavigate("billing")}
          style={navItemStyle(currentPage === "billing")}
          onMouseEnter={(e) => {
            if (currentPage !== "billing") {
              e.currentTarget.style.backgroundColor = "#2c2c2c";
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== "billing") {
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
        >
          Billing
        </button>
        <button
          onClick={() => onNavigate("manage")}
          style={navItemStyle(currentPage === "manage")}
          onMouseEnter={(e) => {
            if (currentPage !== "manage") {
              e.currentTarget.style.backgroundColor = "#2c2c2c";
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== "manage") {
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
        >
          Manage Subscription
        </button>

        {/* User Account Section */}
        <div style={sectionTitleStyle}>User account</div>
        <button
          onClick={() => onNavigate("profile")}
          style={navItemStyle(currentPage === "profile")}
          onMouseEnter={(e) => {
            if (currentPage !== "profile") {
              e.currentTarget.style.backgroundColor = "#2c2c2c";
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== "profile") {
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
        >
          Profile
        </button>
      </nav>
    </div>
  );
}
