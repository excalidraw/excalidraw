/**
 * Custom actions функционала TBoard
 */

import { collabAPIAtom } from "../excalidraw-app/collab/Collab";
import { jotaiStore } from "../jotai";

/**
 * Проверка, что комната еще не запущена.
 * @returns boolean
 */
export const checkCollaborationStarted = () => {
  const store = jotaiStore.get(collabAPIAtom);

  return store?.isCollaborating() || false;
};

/**
 * Функция запуска новой комнаты.
 * Универсальная, можно запускать из любого компонента.
 * @param newRoomLinkData Параметры новой комнаты
 * @return void
 */
export const startCollaboration = (
  newRoomLinkData: null | { roomId: string; roomKey: string },
) => {
  const store = jotaiStore.get(collabAPIAtom);

  return store?.startCollaboration(null, newRoomLinkData);
};
