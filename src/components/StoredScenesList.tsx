import React from "react";
import { useTranslation } from "react-i18next";
import { PreviousScene } from "../scene/types";

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
  const { t } = useTranslation();

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
