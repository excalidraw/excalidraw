const re_protocol = /^(?:(?:(?:https?|ftp):\/\/)|www.)/;

export const normalizeLink = (link: string) => {
  link = link.trim();

  if (link.match(re_protocol)) {
    return link;
  }

  // local link
  if (link.startsWith("/")) {
    return location.origin + link;
  }

  return `https://${link}`;
};

export const isLocalLink = (link: string | null) => {
  return !!link?.includes(location.origin);
};
