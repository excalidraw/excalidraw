import { useState } from "react";
import clsx from "clsx";

import { Sidebar, useExcalidrawAPI } from "@excalidraw/excalidraw";
import { t } from "@excalidraw/excalidraw/i18n";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import {
  CloseIcon,
  PlusIcon,
  TrashIcon,
  checkIcon,
  pencilIcon,
} from "@excalidraw/excalidraw/components/icons";

import { useAtomValue } from "../app-jotai";
import { activeProjectIdAtom, projectsListAtom } from "../app-jotai";
import { collabAPIAtom } from "../collab/Collab";
import {
  createProject,
  deleteProject,
  renameProject,
  switchProject,
} from "../data/projectSwitch";

import "./ProjectsSidebar.scss";

import type { ProjectIndexEntry } from "../data/projectsStore";

export const PROJECTS_SIDEBAR_NAME = "projects";

const formatUpdatedAt = (updatedAt: number) => {
  try {
    return new Date(updatedAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch (error) {
    return "";
  }
};

export const ProjectsSidebar = () => {
  const excalidrawAPI = useExcalidrawAPI();
  const collabAPI = useAtomValue(collabAPIAtom);
  const projects = useAtomValue(projectsListAtom);
  const activeProjectId = useAtomValue(activeProjectIdAtom);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  if (!excalidrawAPI) {
    return null;
  }

  const onSwitch = (id: string) => {
    switchProject(id, { excalidrawAPI, collabAPI });
  };

  const onCreate = () => {
    createProject({ excalidrawAPI, collabAPI });
  };

  const startRename = (project: ProjectIndexEntry) => {
    setEditingId(project.id);
    setEditingTitle(project.title);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const commitRename = async () => {
    const title = editingTitle.trim();
    if (editingId && title) {
      await renameProject(editingId, title, { excalidrawAPI });
    }
    cancelRename();
  };

  const onDelete = async (project: ProjectIndexEntry) => {
    const confirmed = await openConfirmModal({
      title: t("projects.deleteConfirm.title"),
      description: t("projects.deleteConfirm.description", {
        title: project.title,
      }),
      actionLabel: t("projects.deleteConfirm.button"),
      color: "danger",
    });
    if (confirmed) {
      await deleteProject(project.id, { excalidrawAPI, collabAPI });
    }
  };

  return (
    <Sidebar name={PROJECTS_SIDEBAR_NAME} className="projects-sidebar">
      <Sidebar.Header>{t("projects.title")}</Sidebar.Header>

      <div className="projects-sidebar__content">
        <button
          type="button"
          className="projects-sidebar__new"
          onClick={onCreate}
        >
          {PlusIcon}
          {t("projects.new")}
        </button>

        {projects.length === 0 ? (
          <div className="projects-sidebar__empty">{t("projects.empty")}</div>
        ) : (
          <ul className="projects-sidebar__list">
            {projects.map((project) => (
              <li
                key={project.id}
                className={clsx("projects-sidebar__item", {
                  "projects-sidebar__item--active":
                    project.id === activeProjectId,
                })}
              >
                {editingId === project.id ? (
                  <div className="projects-sidebar__item-edit">
                    <input
                      type="text"
                      value={editingTitle}
                      autoFocus
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          commitRename();
                        } else if (event.key === "Escape") {
                          cancelRename();
                        }
                      }}
                    />
                    <button
                      type="button"
                      title={t("buttons.confirm")}
                      onClick={commitRename}
                    >
                      {checkIcon}
                    </button>
                    <button
                      type="button"
                      title={t("buttons.cancel")}
                      onClick={cancelRename}
                    >
                      {CloseIcon}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="projects-sidebar__item-main"
                      onClick={() => onSwitch(project.id)}
                      disabled={project.id === activeProjectId}
                    >
                      <span className="projects-sidebar__item-title">
                        {project.title}
                      </span>
                      <span className="projects-sidebar__item-date">
                        {formatUpdatedAt(project.updatedAt)}
                      </span>
                    </button>
                    <div className="projects-sidebar__item-actions">
                      <button
                        type="button"
                        title={t("projects.rename")}
                        onClick={() => startRename(project)}
                      >
                        {pencilIcon}
                      </button>
                      <button
                        type="button"
                        title={t("projects.delete")}
                        onClick={() => onDelete(project)}
                      >
                        {TrashIcon}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sidebar>
  );
};
