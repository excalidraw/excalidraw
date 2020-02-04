import React from "react";
import { PreviousScene } from "../scene/types";
import { t } from "../i18n";

interface StoredScenesListProps {
  scenes: PreviousScene[];
  currentId?: string;
  onChange: (selectedId: string, k?: string) => {};
}

export function StoredScenesList({
  scenes,
  currentId,
  onChange,
}: StoredScenesListProps) {
  return (
    <select
      className="stored-ids-select"
      onChange={({ currentTarget }) => {
        const scene = scenes[(currentTarget.value as unknown) as number];
        onChange(scene.id, scene.k);
      }}
      value={currentId}
      title={t("buttons.previouslyLoadedScenes")}
    >
      {scenes.map((scene, i) => (
        <option key={i} value={i}>
          id={scene.id}
        </option>
      ))}
    </select>
  );
}
