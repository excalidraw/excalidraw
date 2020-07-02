import "./Avatar.scss";

import React from "react";

type AvatarProps = {
  children: string;
  className?: string;
  onClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  color: string;
};

export const Avatar = ({
  children,
  className,
  color,
  onClick,
}: AvatarProps) => (
  <div
    className={`Avatar ${className}`}
    style={{ background: color }}
    onClick={onClick}
  >
    {children}
  </div>
);
