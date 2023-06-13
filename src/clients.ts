function hashToInteger(id: string) {
  let hash = 0;
  if (id.length === 0) {
    return hash;
  }
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = (hash << 5) - hash + char;
  }
  return hash;
}

export const getClientColor = (
  /**
   * any uniquely identifying key, such as user id or socket id
   */
  id: string,
) => {
  // to get more even distribution in case `id` is not uniformly distributed to
  // begin with, we hash it
  const hash = Math.abs(hashToInteger(id));
  // we want to get a multiple of 10 number in the range of 0-360 (in other
  // words a hue value of step size 10). There are 37 such values including 0.
  const hue = (hash % 37) * 10;
  const saturation = 100;
  const lightness = 83;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/**
 * returns first char, capitalized
 */
export const getNameInitial = (name?: string | null) => {
  // first char can be a surrogate pair, hence using codePointAt
  const firstCodePoint = name?.trim()?.codePointAt(0);
  return (
    firstCodePoint ? String.fromCodePoint(firstCodePoint) : "?"
  ).toUpperCase();
};
