import React from "react";

interface StoredIdsListProps {
  ids: string[];
  currentId?: string;
  onChange: (selectedId: string) => {};
}

export function StoredIdsList({
  ids,
  currentId,
  onChange,
}: StoredIdsListProps) {
  return (
    <React.Fragment>
      <select
        className="stored-ids-select"
        onChange={({ target }) => onChange(target.value)}
        value={currentId}
      >
        {ids.map(id => (
          <option key={id} value={id}>
            id={id}
          </option>
        ))}
      </select>
    </React.Fragment>
  );
}
