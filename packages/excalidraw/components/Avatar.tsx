import clsx from "clsx";
import React, { useState } from "react";

import { getNameInitial } from "../clients";

import "./Avatar.scss";

type AvatarProps = {
  onClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  color: string;
  name: string;
  src?: string;
  className?: string;
};

export const Avatar = ({
  color,
  onClick,
  name,
  src,
  className,
}: AvatarProps) => {
  const shortName = getNameInitial(name);
  const [error, setError] = useState(false);
  const loadImg = !error && src;
  const style = loadImg ? undefined : { background: color };
  return (
    <div
      className={clsx("Avatar", className)}
      style={style}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e as any);
        }
      }}
    >
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
