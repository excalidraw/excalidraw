import "./Avatar.scss";

import React, { useState } from "react";
import { getNameInitial } from "../clients";
import clsx from "clsx";

type AvatarProps = {
  onClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  color: string;
  name: string;
  src?: string;
  isBeingFollowed?: boolean;
  isCurrentUser: boolean;
};

export const Avatar = ({
  color,
  onClick,
  name,
  src,
  isBeingFollowed,
  isCurrentUser,
}: AvatarProps) => {
  const shortName = getNameInitial(name);
  const [error, setError] = useState(false);
  const loadImg = !error && src;
  const style = loadImg ? undefined : { background: color };
  return (
    <div
      className={clsx("Avatar", {
        "Avatar--is-followed": isBeingFollowed,
        "Avatar--is-current-user": isCurrentUser,
      })}
      style={style}
      onClick={onClick}
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
