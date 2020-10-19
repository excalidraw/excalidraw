import "./Avatar.scss";

import React from "react";

type AvatarProps = {
  children: string;
  onClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  color: string;
};

export const Avatar = ({ children, color, onClick }: AvatarProps) => (
  <div className="Avatar" style={{ background: color }} onClick={onClick}>
    {children}
  </div>
);
