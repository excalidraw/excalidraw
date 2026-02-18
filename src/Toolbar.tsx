// Only include if you need to adjust panel anchoring or toolbar z-index.
// Example: add style to ensure toolbar is always visible
import React from "react";
import styles from "./Toolbar.module.css";

export const Toolbar: React.FC = ({ children }) => (
  <div className={styles.toolbar} style={{ zIndex: 101 }}>
    {children}
  </div>
);
