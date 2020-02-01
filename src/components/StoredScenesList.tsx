import React from "react";
import { PreviousScene } from "../scene/types";
import { t } from "../i18n";

interface StoredScenesListProps {
  scenes: PreviousScene[];
  currentId?: string;
  onChange: (selectedId: string) => {};
}

export function StoredScenesList({
  scenes,
  currentId,
  onChange,
}: StoredScenesListProps) {
  return (
    <React.Fragment>
      <select
        className="stored-ids-select"
        onChange={({ currentTarget }) => onChange(currentTarget.value)}
        value={currentId}
        title={t("buttons.previouslyLoadedScenes")}
      >
        {scenes.map(scene => (
          <option key={scene.id} value={scene.id}>
            id={scene.id}
          </option>
        ))}
      </select>
    </React.Fragment>
  );
}
