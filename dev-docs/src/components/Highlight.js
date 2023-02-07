import React from "react";
export default function Highlight({ children }) {
  return (
    <span
      style={{
        backgroundColor: "#7874e8",
        borderRadius: "2px",
        color: "#fff",
        padding: "0.2rem",
      }}
    >
      {children}
    </span>
  );
}
