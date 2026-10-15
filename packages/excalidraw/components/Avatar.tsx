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

const isValidAvatarUrl = (url?: string): boolean => {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return true;
    }
  } catch {
    if (
      url.startsWith("data:image/png;base64,") ||
      url.startsWith("data:image/jpeg;base64,") ||
      url.startsWith("data:image/gif;base64,") ||
      url.startsWith("data:image/webp;base64,")
    ) {
      return true;
    }
  }
  return false;
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
  const loadImg = !error && src && isValidAvatarUrl(src);
  const style = loadImg ? undefined : { background: color };
  return (
    <div className={clsx("Avatar", className)} style={style} onClick={onClick}>
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
