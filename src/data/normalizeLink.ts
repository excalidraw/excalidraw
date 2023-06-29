export const normalizeLink = (link: string) => {
  if (link && !link.match("^https?://")) {
    link = `https://${link}`;
  }
  return link;
};
