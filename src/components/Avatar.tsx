import "./Avatar.scss";

import React from "react";

type AvatarProps = {
  children: React.ReactNode;
  className?: string;
  name: string;
  color: string;
};

export const Avatar = ({ children, className, color }: AvatarProps) => (
  <div className={`Avatar ${className}`} style={{ background: color }}>
    {children}
  </div>
);
