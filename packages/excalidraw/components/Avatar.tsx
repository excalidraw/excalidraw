import "./Avatar.scss";

import React, { useState } from "react";
import { getNameInitial } from "../clients";

type AvatarProps = {
  onClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  color: string;
  name: string;
  src?: string;
};

export const Avatar = ({ color, onClick, name, src }: AvatarProps) => {
  const shortName = getNameInitial(name);
  const [error, setError] = useState(false);
  const loadImg = !error && src;
  const style = loadImg ? undefined : { background: color };
  return (
    <div className="Avatar" style={style} onClick={onClick}>
      {loadImg ? (
        <img
          className="Avatar-img"
          src={src}
          alt={shortName}
          referrerPolicy="no-referrer"
          onError={() => setError(true)}
        />
      ) : (
        shortName
      )}
    </div>
  );
};
