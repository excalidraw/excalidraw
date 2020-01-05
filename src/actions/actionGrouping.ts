import { Action } from "./types";
import { KEYS } from "../keys";
import { ExcalidrawGroupElement } from "../element/types";
import { newGroupElement } from "../element/newElement";

export const actionGroupElements: Action = {
  name: "groupElements",
  perform: (elements, groups) => {
    const result = Array.from(groups);
    const selected: ExcalidrawGroupElement = newGroupElement();
    elements
      .filter(el => el.isSelected)
      .forEach(el => {
        const index = result.findIndex(group => group.children.find(id => id === el.id));
        if (index !== -1) {
          result[index].children.forEach(e => selected.children.push(e));
          result.splice(index, 1);
        } else {
          selected.children.push(el.id);
        }
      });
    if (selected.children.length > 1) {
      result.push(selected);
    }

    return {
      elements: elements,
      groups: Array.from(new Set(result))
    };
  },
  contextItemLabel: "labels.groupElements",
  keyTest: event => event[KEYS.META] && event.key === "g",
  contextMenuOrder: 0,
};

export const actionUngroupElements: Action = {
  name: "ungroupElements",
  perform: (elements, groups) => {
    const result = Array.from(groups);
    const selectedElements = elements.filter(el => el.isSelected);
    const groupIndex = result.findIndex(group => {
      for (const i in selectedElements) {
        const element = selectedElements[i];
        if (!group.children.find(id => id === element.id)) {
          return false;
        }
      }
      return true;
    });
    if (groupIndex !== -1) {
      const group = result[groupIndex];
      selectedElements.forEach(el => {
        const index = group.children.indexOf(el.id);
        if (index) {
          group.children.splice(index, 1);
        }
      });
      if (group.children.length < 2) {
        result.splice(groupIndex, 1);
      }
    }
    return {
      elements: elements,
      groups: Array.from(new Set(result)),
    };
  },
  contextItemLabel: "labels.ungroupElements",
  keyTest: event => event[KEYS.META] && event.shiftKey && event.key === "G",
  contextMenuOrder: 0,
};
