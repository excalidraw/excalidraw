import "./Avatar.scss";

import React from "react";
import { getClientInitials } from "../clients";

type AvatarProps = {
  onClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  color: string;
  border: string;
  name: string;
  src?: string;
};

export const Avatar = ({ color, border, onClick, name, src }: AvatarProps) => {
  const shortName = getClientInitials(name);
  const style = src
    ? undefined
    : { background: color, border: `1px solid ${border}` };
  return (
    <div className="Avatar" style={style} onClick={onClick}>
      {src ? (
        <img className="Avatar-img" src={src} alt={shortName} />
      ) : (
        shortName
      )}
    </div>
  );
};
