import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { randomId } from "@excalidraw/common";

interface RabbitGroupData {
  groupId: string;
  query: string;
  color: string;
  createdAt: number;
}

interface RabbitGroup {
  groupId: string;
  searchBox: ExcalidrawElement | null;
  images: ExcalidrawElement[];
  query: string;
  color: string;
}

export const getRabbitGroupsFromElements = (elements: readonly ExcalidrawElement[]): Map<string, RabbitGroup> => {
  const groups = new Map<string, RabbitGroup>();
  
  elements.forEach(element => {
    if ((element.type === 'rabbit-searchbox' || element.type === 'rabbit-image') && 
        element.customData?.rabbitGroup) {
      
      const groupData = element.customData.rabbitGroup as RabbitGroupData;
      const groupId = groupData.groupId;
      
      if (!groups.has(groupId)) {
        groups.set(groupId, {
          groupId,
          searchBox: null,
          images: [],
          query: groupData.query,
          color: groupData.color
        });
      }
      
      const group = groups.get(groupId)!;
      if (element.type === 'rabbit-searchbox') {
        group.searchBox = element;
      } else {
        group.images.push(element);
      }
    }
  });
  
  return groups;
};

export const getSelectedRabbitGroupIds = (
  selectedElements: ExcalidrawElement[], 
  allElements: readonly ExcalidrawElement[]
): string[] => {
  const rabbitElements = selectedElements.filter(el => {
    const isRabbitType = el.type === 'rabbit-searchbox' || el.type === 'rabbit-image';
    const hasRabbitGroup = !!el.customData?.rabbitGroup;
    return isRabbitType && hasRabbitGroup;
  });
  
  if (rabbitElements.length === 0) return [];
  
  const groups = getRabbitGroupsFromElements(allElements);
  const selectedGroupIds = new Set<string>();
  
  for (const [groupId, group] of groups) {
    const groupElementIds: string[] = [
      ...(group.searchBox ? [group.searchBox.id] : []),
      ...group.images.map(img => img.id)
    ];
    
    const hasSelectedElement = rabbitElements.some(el => 
      groupElementIds.includes(el.id)
    );
    
    if (hasSelectedElement) {
      selectedGroupIds.add(groupId);
    }
  }
  
  return Array.from(selectedGroupIds);
};

export const getSelectedRabbitGroupId = (
  selectedElements: ExcalidrawElement[], 
  allElements: readonly ExcalidrawElement[]
): string | null => {
  const selectedGroupIds = getSelectedRabbitGroupIds(selectedElements, allElements);
  
  if (selectedGroupIds.length !== 1) return null;
  
  const groupId = selectedGroupIds[0];
  const groups = getRabbitGroupsFromElements(allElements);
  const group = groups.get(groupId);
  if (!group) return null;
  
  const groupElementIds: string[] = [
    ...(group.searchBox ? [group.searchBox.id] : []),
    ...group.images.map(img => img.id)
  ];
  
  const selectedElementIds = new Set(selectedElements.map(el => el.id));
  
  const allGroupElementsSelected = groupElementIds.every(id => 
    selectedElementIds.has(id)
  );
  
  return allGroupElementsSelected ? groupId : null;
};

export const generateUniqueColor = (usedColors: Set<string>): string => {
  const maxAttempts = 100;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 65 + Math.floor(Math.random() * 25);
    const lightness = 45 + Math.floor(Math.random() * 15);
    
    const hexColor = hslToHex(hue, saturation, lightness);
    
    if (!usedColors.has(hexColor)) {
      usedColors.add(hexColor);
      return hexColor;
    }
    attempts++;
  }
  
  const fallbackHue = (Date.now() % 360);
  const fallbackColor = hslToHex(fallbackHue, 70, 50);
  usedColors.add(fallbackColor);
  return fallbackColor;
};

const hslToHex = (h: number, s: number, l: number): string => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export const createRabbitGroup = (
  excalidrawAPI: ExcalidrawImperativeAPI,
  searchBoxId: string,
  imageIds: string[],
  searchQuery: string
): void => {
  const elements = excalidrawAPI.getSceneElements();
  const existingGroups = getRabbitGroupsFromElements(elements);
  
  // Check if a group with the same search query already exists
  let existingGroup: RabbitGroup | null = null;
  for (const [groupId, group] of existingGroups) {
    if (group.query.toLowerCase().trim() === searchQuery.toLowerCase().trim()) {
      existingGroup = group;
      break;
    }
  }
  
  let groupId: string;
  let groupColor: string;
  let groupData: RabbitGroupData;
  
  if (existingGroup) {
    // Use existing group's ID and color
    groupId = existingGroup.groupId;
    groupColor = existingGroup.color;
    groupData = {
      groupId,
      query: searchQuery,
      color: groupColor,
      createdAt: Date.now()
    };
  } else {
    // Create new group
    const usedColors = new Set<string>();
    existingGroups.forEach(group => usedColors.add(group.color));

    groupId = randomId();
    groupColor = generateUniqueColor(usedColors);
    groupData = {
      groupId,
      query: searchQuery,
      color: groupColor,
      createdAt: Date.now()
    };
  }

  const targetIds = [searchBoxId, ...imageIds];

  const updatedElements = elements.map((el: ExcalidrawElement) => {
    if (targetIds.includes(el.id)) {
      return { 
        ...el, 
        strokeColor: groupColor,
        groupIds: [...(el.groupIds || []), groupId],
        customData: {
          ...el.customData,
          rabbitGroup: groupData
        }
      };
    }
    return el;
  });

  excalidrawAPI.updateScene({ elements: updatedElements });
};

export const changeGroupColor = (
  excalidrawAPI: ExcalidrawImperativeAPI,
  groupId: string,
  newColor: string
): void => {
  const elements = excalidrawAPI.getSceneElements();
  const groups = getRabbitGroupsFromElements(elements);
  const group = groups.get(groupId);
  
  if (!group) return;
  
  const groupElementIds: string[] = [
    ...(group.searchBox ? [group.searchBox.id] : []),
    ...group.images.map(img => img.id)
  ];

  const updatedElements = elements.map(element => {
    if (groupElementIds.includes(element.id)) {
      return { 
        ...element, 
        strokeColor: newColor,
        customData: {
          ...element.customData,
          rabbitGroup: {
            ...element.customData?.rabbitGroup,
            color: newColor
          }
        }
      };
    }
    return element;
  });

  excalidrawAPI.updateScene({ elements: updatedElements });
};

export const removeRabbitGroup = (
  excalidrawAPI: ExcalidrawImperativeAPI,
  groupId: string
): void => {
  const elements = excalidrawAPI.getSceneElements();
  const groups = getRabbitGroupsFromElements(elements);
  const group = groups.get(groupId);
  
  if (!group) return;
  
  const groupElementIds: string[] = [
    ...(group.searchBox ? [group.searchBox.id] : []),
    ...group.images.map(img => img.id)
  ];

  const updatedElements = elements.map(element => {
    if (groupElementIds.includes(element.id)) {
      const newCustomData: Record<string, any> = { ...element.customData };
      delete newCustomData.rabbitGroup;
      
      return {
        ...element,
        groupIds: element.groupIds?.filter(id => id !== groupId) || [],
        customData: Object.keys(newCustomData).length > 0 ? newCustomData : undefined
      };
    }
    return element;
  });

  excalidrawAPI.updateScene({ elements: updatedElements });
};