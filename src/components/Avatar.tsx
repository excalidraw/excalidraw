import "./Avatar.scss";

import React from "react";

type AvatarProps = {
  children: string;
  onClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  color: string;
  border: string;
};

export const Avatar = ({ children, color, border, onClick }: AvatarProps) => (
  <div
    className="Avatar"
    style={{ background: color, border: `1px solid ${border}` }}
    onClick={onClick}
  >
    {children}
  </div>
);
