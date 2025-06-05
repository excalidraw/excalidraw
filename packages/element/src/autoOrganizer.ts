import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import { randomId } from "@excalidraw/common";
import { createRabbitGroup, getRabbitGroupsFromElements } from './rabbitGroupUtils';
import { updateBoundElements } from './binding'; // adjust path as needed

import { Scene } from './Scene';

cytoscape.use(dagre);

interface ImageData {
  id: string;
  src: string;
  alt: string;
  name: string;
}

interface TabData {
  name: string;
  images: ImageData[];
}

class AutoOrganizer {
  private excalidrawAPI: ExcalidrawImperativeAPI;

  constructor(excalidrawAPI: ExcalidrawImperativeAPI) {
    this.excalidrawAPI = excalidrawAPI;
  }

  forceBindingRefresh(): void {
    const currentElements = this.excalidrawAPI.getSceneElements();
    
    // Create elements map like the delta system does
    const elementsMap = new Map(currentElements.map(el => [el.id, el]));
    
    // Create temporary scene just like ElementsDelta.applyTo does
    const tempScene = new Scene(elementsMap);
    
    // Find all bindable elements that might need binding updates
    const bindableElements = currentElements.filter(el => 
      !el.isDeleted && (
        el.type === 'rectangle' || el.type === 'diamond' || el.type === 'ellipse' ||
        el.type === 'rabbit-searchbox' || el.type === 'rabbit-image' ||
        el.type === 'text' || el.type === 'image' || el.type === 'frame' ||
        el.type === 'magicframe' || el.type === 'embeddable' || el.type === 'iframe'
      )
    );
    
    // Create changed elements map
    const changedElements = new Map(bindableElements.map(el => [el.id, el]));
    
    // Use the same method as ElementsDelta - call redrawBoundArrows or just updateBoundElements directly
    bindableElements.forEach(element => {
      updateBoundElements(element, tempScene, {
        changedElements: changedElements,
      });
    });
    
    // Get the updated elements from the scene and apply them back
    const updatedElements = Array.from(tempScene.getNonDeletedElementsMap().values());
    
    this.excalidrawAPI.updateScene({
      elements: updatedElements
    });
  }

  async enhanceAddToCanvas(
    selectedImages: string[], 
    searchQuery: string, 
    tabData: TabData[], 
    originalAddToCanvas: (images: string[]) => void | Promise<void>
  ): Promise<void> {
    await originalAddToCanvas(selectedImages);
    
    setTimeout(() => {
      try {
        const currentElements = this.excalidrawAPI.getSceneElements();
        
        const searchBox = currentElements.find((el: ExcalidrawElement) => 
          el.type === 'rabbit-searchbox' && 
          (el as any).text?.trim() === searchQuery.trim()
        );
        
        const allRabbitImages = currentElements.filter((el: ExcalidrawElement) => el.type === 'rabbit-image');
        const newImages = allRabbitImages.slice(-selectedImages.length);
        
        if (!searchBox || !newImages.length) {
          return;
        }

        createRabbitGroup(
          this.excalidrawAPI, 
          searchBox.id, 
          newImages.map(img => img.id), 
          searchQuery
        );

        setTimeout(() => {
          this.organizeHierarchical();
        }, 200);

      } catch (error) {
        console.error("Error in enhanceAddToCanvas:", error);
      }
    }, 100);
  }

  // New method to organize a single group
  organizeSingleGroup(groupId: string, layoutType: string = 'dagre'): Promise<void> | void {
    try {
      const currentElements = this.excalidrawAPI.getSceneElements();
      const groups = getRabbitGroupsFromElements(currentElements);
      const group = groups.get(groupId);
      
      if (!group) {
        return;
      }

      // Get only elements from this specific group
      const groupElementIds: string[] = [
        ...(group.searchBox ? [group.searchBox.id] : []),
        ...group.images.map(img => img.id)
      ];

      const groupElements = currentElements.filter(el => groupElementIds.includes(el.id));
      
      if (groupElements.length === 0) {
        return;
      }

      const cyElements = this.convertToCytoscapeFormatSingleGroup(groupElements, group);
      
      if (cyElements.length === 0) {
        return;
      }

      const cy = cytoscape({
        elements: cyElements,
        headless: true, 
      });

      const layout = cy.layout(this.getLayoutConfigSingleGroup(layoutType, group));
      
      return new Promise<void>((resolve) => {
        layout.on('layoutstop', () => {
          const updatedElements = this.applyLayoutPositionsSingleGroup(currentElements, cy, layoutType, groupElementIds);
          
          this.excalidrawAPI.updateScene({
            elements: updatedElements
          });

          // Force binding refresh after a short delay to ensure positions are applied
          setTimeout(() => {
            this.forceBindingRefresh();
          }, 50);

          cy.destroy();
          resolve();
        });
        
        layout.run();
      });

    } catch (error) {
      console.error("Error in organizeSingleGroup:", error);
    }
  }

  autoOrganize(layoutType: string = 'dagre'): Promise<void> | void {
    try {
      const currentElements = this.excalidrawAPI.getSceneElements();
      const groups = getRabbitGroupsFromElements(currentElements);
      
      const cyElements = this.convertToCytoscapeFormat(currentElements, groups);
      
      if (cyElements.length === 0) {
        return;
      }

      const cy = cytoscape({
        elements: cyElements,
        headless: true, 
      });

      const layout = cy.layout(this.getLayoutConfig(layoutType, groups));
      
      return new Promise<void>((resolve) => {
        layout.on('layoutstop', () => {
          const updatedElements = this.applyLayoutPositions(currentElements, cy, layoutType);
          
          this.excalidrawAPI.updateScene({
            elements: updatedElements
          });

          // Force binding refresh after a short delay to ensure positions are applied
          setTimeout(() => {
            this.forceBindingRefresh();
          }, 50);

          cy.destroy();
          resolve();
        });
        
        layout.run();
      });

    } catch (error) {
      console.error("Error in autoOrganize:", error);
    }
  }

  convertToCytoscapeFormatSingleGroup(elements: readonly ExcalidrawElement[], group: any): any[] {
    const nodes: any[] = [];
    const edges: any[] = [];

    elements.forEach((element: ExcalidrawElement) => {
        if (element.type === 'rabbit-searchbox' || element.type === 'rabbit-image') {
            nodes.push({
                data: { 
                    id: element.id, 
                    type: element.type,
                    width: element.width || 100,
                    height: element.height || 100
                }
            });
        }
    });

    // Add edges from searchbox to images within this group
    group.images.forEach((image: any) => {
      const sourceExists = elements.find(el => el.id === group.searchBox?.id);
      const targetExists = elements.find(el => el.id === image.id);
      
      if (sourceExists && targetExists) {
        edges.push({
          data: {
            id: `${group.searchBox.id}-${image.id}`,
            source: group.searchBox.id,
            target: image.id
          }
        });
      }
    });

    return [...nodes, ...edges];
  }

  convertToCytoscapeFormat(elements: readonly ExcalidrawElement[], groups: Map<string, any>): any[] {
    const nodes: any[] = [];
    const edges: any[] = [];

    elements.forEach((element: ExcalidrawElement) => {
        if (element.type === 'rabbit-searchbox' || element.type === 'rabbit-image') {
            nodes.push({
                data: { 
                    id: element.id, 
                    type: element.type,
                    width: element.width || 100,
                    height: element.height || 100
                }
            });
        }
    });

    groups.forEach((group) => {
      group.images.forEach((image: any) => {
        const sourceExists = elements.find(el => el.id === group.searchBox?.id);
        const targetExists = elements.find(el => el.id === image.id);
        
        if (sourceExists && targetExists) {
          edges.push({
            data: {
              id: `${group.searchBox.id}-${image.id}`,
              source: group.searchBox.id,
              target: image.id
            }
          });
        }
      });
    });

    return [...nodes, ...edges];
  }

  getLayoutConfigSingleGroup(layoutType: string, group: any): any {
    const nodeCount = 1 + group.images.length; // searchbox + images
    
    const layouts: Record<string, any> = {
      dagre: {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 80,
        rankSep: 60,
        fit: false,
        padding: 20
      },
      grid: {
        name: 'grid',
        rows: undefined,
        cols: Math.ceil(Math.sqrt(nodeCount)),
        fit: false,
        padding: 20,
        spacingFactor: 1.2,
        avoidOverlap: true,
        condense: false
      },
      circle: {
        name: 'circle',
        fit: false,
        padding: 20,
        radius: Math.max(100, nodeCount * 20),
        avoidOverlap: true,
        spacingFactor: 1
      },
      breadthfirst: {
        name: 'breadthfirst',
        directed: true,
        roots: group.searchBox ? [group.searchBox.id] : [],
        spacingFactor: 1.5,
        fit: false,
        padding: 20,
        avoidOverlap: true
      }
    };

    return layouts[layoutType] || layouts.dagre;
  }

  getLayoutConfig(layoutType: string, groups: Map<string, any>): any {
    const layouts: Record<string, any> = {
      dagre: {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 120,
        rankSep: 100,
        fit: false,
        padding: 30
      },
      grid: {
        name: 'grid',
        rows: undefined,
        cols: Math.ceil(Math.sqrt(this.getTotalNodeCount(groups))),
        fit: false,
        padding: 30,
        spacingFactor: 1.5,
        avoidOverlap: true,
        condense: false
      },
      circle: {
        name: 'circle',
        fit: false,
        padding: 30,
        radius: 250,
        avoidOverlap: true,
        spacingFactor: 1
      },
      breadthfirst: {
        name: 'breadthfirst',
        directed: true,
        roots: this.getRootNodes(groups),
        spacingFactor: 2,
        fit: false,
        padding: 30,
        avoidOverlap: true
      }
    };

    return layouts[layoutType] || layouts.dagre;
  }

  getTotalNodeCount(groups: Map<string, any>): number {
    const allSearchBoxes = Array.from(groups.values()).length;
    const allImages = Array.from(groups.values()).reduce((count, group) => count + group.images.length, 0);
    return allSearchBoxes + allImages;
  }

  applyLayoutPositionsSingleGroup(elements: readonly ExcalidrawElement[], cy: any, layoutType: string, groupElementIds: string[]): ExcalidrawElement[] {
    const positions: { x: number, y: number, id: string }[] = [];
    cy.nodes().forEach((node: any) => {
      const pos = node.position();
      positions.push({ x: pos.x, y: pos.y, id: node.id() });
    });
    
    if (positions.length === 0) return [...elements];

    // Use your original layout methods but only apply to group elements
    let tempElements = [...elements];
    
    // Create a temporary set with only the group elements for layout calculation
    const groupElementsForLayout = elements.filter(el => groupElementIds.includes(el.id));
    
    // Apply your original layout method to get the positioning logic
    let layoutedGroupElements: ExcalidrawElement[];
    switch (layoutType) {
      case 'grid':
        layoutedGroupElements = this.applyGridLayout(groupElementsForLayout, positions);
        break;
      case 'breadthfirst':
        layoutedGroupElements = this.applyBreadthFirstLayout(groupElementsForLayout, positions);
        break;
      case 'circle':
        layoutedGroupElements = this.applyCircularLayout(groupElementsForLayout, positions);
        break;
      case 'dagre':
      default:
        layoutedGroupElements = this.applyHierarchicalLayout(groupElementsForLayout, positions);
        break;
    }

    // Apply the new positions only to the group elements
    return tempElements.map((element: ExcalidrawElement) => {
      if (groupElementIds.includes(element.id)) {
        const layoutedElement = layoutedGroupElements.find(el => el.id === element.id);
        return layoutedElement || element;
      }
      return element; // Don't change elements not in this group
    });
  }

  applyLayoutPositions(elements: readonly ExcalidrawElement[], cy: any, layoutType: string): ExcalidrawElement[] {
    const positions: { x: number, y: number, id: string }[] = [];
    cy.nodes().forEach((node: any) => {
      const pos = node.position();
      positions.push({ x: pos.x, y: pos.y, id: node.id() });
    });
    
    if (positions.length === 0) return [...elements];

    switch (layoutType) {
      case 'grid':
        return this.applyGridLayout(elements, positions);
      case 'breadthfirst':
        return this.applyBreadthFirstLayout(elements, positions);
      case 'circle':
        return this.applyCircularLayout(elements, positions);
      case 'dagre':
      default:
        return this.applyHierarchicalLayout(elements, positions);
    }
  }

  applyGridLayout(elements: readonly ExcalidrawElement[], positions: { x: number, y: number, id: string }[]): ExcalidrawElement[] {
    const rabbitElements = elements.filter(el => el.type === 'rabbit-searchbox' || el.type === 'rabbit-image');
    const maxWidth = Math.max(...rabbitElements.map(el => el.width || 100));
    const maxHeight = Math.max(...rabbitElements.map(el => el.height || 100));
    
    const minSpacingX = maxWidth + 50;
    const minSpacingY = maxHeight + 40;
    const startX = 100;
    const startY = 100;

    const totalNodes = positions.length;
    const cols = Math.ceil(Math.sqrt(totalNodes));

    return elements.map((element: ExcalidrawElement) => {
      const position = positions.find(p => p.id === element.id);
      if (position) {
        const sortedPositions = [...positions].sort((a, b) => a.y - b.y || a.x - b.x);
        const gridIndex = sortedPositions.findIndex(p => p.id === element.id);
        
        const col = gridIndex % cols;
        const row = Math.floor(gridIndex / cols);
        
        const x = startX + (col * minSpacingX);
        const y = startY + (row * minSpacingY);
        
        return {
          ...element,
          x: x - (element.width || 100) / 2,
          y: y - (element.height || 100) / 2
        };
      }
      return element;
    });
  }

  applyBreadthFirstLayout(elements: readonly ExcalidrawElement[], positions: { x: number, y: number, id: string }[]): ExcalidrawElement[] {
    const rabbitElements = elements.filter(el => el.type === 'rabbit-searchbox' || el.type === 'rabbit-image');
    const maxWidth = Math.max(...rabbitElements.map(el => el.width || 100));
    const maxHeight = Math.max(...rabbitElements.map(el => el.height || 100));
    
    const minSpacingX = maxWidth + 60;
    const minSpacingY = maxHeight + 50;
    const startX = 200;
    const startY = 100;

    const levels = new Map<number, { x: number, y: number, id: string }[]>();
    const tolerance = 50;
    
    positions.forEach(pos => {
      let levelY = Math.round(pos.y / tolerance) * tolerance;
      if (!levels.has(levelY)) {
        levels.set(levelY, []);
      }
      levels.get(levelY)!.push(pos);
    });

    const sortedLevels = Array.from(levels.entries()).sort(([a], [b]) => a - b);

    return elements.map((element: ExcalidrawElement) => {
      const position = positions.find(p => p.id === element.id);
      if (position) {
        let levelIndex = 0;
        let positionInLevel = 0;
        
        for (let i = 0; i < sortedLevels.length; i++) {
          const [, levelPositions] = sortedLevels[i];
          const foundIndex = levelPositions.findIndex(p => p.id === element.id);
          if (foundIndex !== -1) {
            levelIndex = i;
            positionInLevel = foundIndex;
            break;
          }
        }
        
        const levelPositions = sortedLevels[levelIndex][1];
        const levelWidth = (levelPositions.length - 1) * minSpacingX;
        const levelStartX = startX - levelWidth / 2;
        
        const x = levelStartX + (positionInLevel * minSpacingX);
        const y = startY + (levelIndex * minSpacingY);
        
        return {
          ...element,
          x: x - (element.width || 100) / 2,
          y: y - (element.height || 100) / 2
        };
      }
      return element;
    });
  }

  applyCircularLayout(elements: readonly ExcalidrawElement[], positions: { x: number, y: number, id: string }[]): ExcalidrawElement[] {
    const rabbitElements = elements.filter(el => el.type === 'rabbit-searchbox' || el.type === 'rabbit-image');
    const maxWidth = Math.max(...rabbitElements.map(el => el.width || 100));
    const maxHeight = Math.max(...rabbitElements.map(el => el.height || 100));
    
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y));
    
    const cytoscapeWidth = maxX - minX || 1;
    const cytoscapeHeight = maxY - minY || 1;
    
    const targetSpacing = Math.max(maxWidth, maxHeight) + 30;
    const scaleX = Math.max(1, targetSpacing * positions.length / (cytoscapeWidth * 2));
    const scaleY = Math.max(1, targetSpacing * positions.length / (cytoscapeHeight * 2));

    return elements.map((element: ExcalidrawElement) => {
      const position = positions.find(p => p.id === element.id);
      if (position) {
        const scaledX = (position.x - minX) * scaleX + 300;
        const scaledY = (position.y - minY) * scaleY + 300;
        
        return {
          ...element,
          x: scaledX - (element.width || 100) / 2,
          y: scaledY - (element.height || 100) / 2
        };
      }
      return element;
    });
  }

  applyHierarchicalLayout(elements: readonly ExcalidrawElement[], positions: { x: number, y: number, id: string }[]): ExcalidrawElement[] {
    const rabbitElements = elements.filter(el => el.type === 'rabbit-searchbox' || el.type === 'rabbit-image');
    const maxWidth = Math.max(...rabbitElements.map(el => el.width || 100));
    const maxHeight = Math.max(...rabbitElements.map(el => el.height || 100));
    
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y));
    
    const cytoscapeWidth = maxX - minX || 1;
    const cytoscapeHeight = maxY - minY || 1;
    
    const targetSpacingX = maxWidth + 60;
    const targetSpacingY = maxHeight + 5;
    
    const scaleX = Math.max(1.2, targetSpacingX * positions.length / cytoscapeWidth);
    const scaleY = Math.max(1.0, targetSpacingY * Math.sqrt(positions.length) / cytoscapeHeight);

    return elements.map((element: ExcalidrawElement) => {
      const position = positions.find(p => p.id === element.id);
      if (position) {
        const scaledX = (position.x - minX) * scaleX + 100;
        const scaledY = (position.y - minY) * scaleY + 100;
        
        return {
          ...element,
          x: scaledX - (element.width || 100) / 2,
          y: scaledY - (element.height || 100) / 2
        };
      }
      return element;
    });
  }

  getRootNodes(groups: Map<string, any>): string[] {
    return Array.from(groups.values()).map(group => group.searchBox?.id).filter(Boolean);
  }

  // Single group organization methods that use your original formatting
  organizeSingleGroupHierarchical(groupId: string): Promise<void> | void { 
    return this.organizeSingleGroup(groupId, 'dagre'); 
  }
  
  organizeSingleGroupGrid(groupId: string): Promise<void> | void { 
    return this.organizeSingleGroup(groupId, 'grid'); 
  }
  
  organizeSingleGroupCircular(groupId: string): Promise<void> | void { 
    return this.organizeSingleGroup(groupId, 'circle'); 
  }
  
  organizeSingleGroupBreadthFirst(groupId: string): Promise<void> | void { 
    return this.organizeSingleGroup(groupId, 'breadthfirst'); 
  }

  // All groups organization methods (your original methods preserved)
  organizeHierarchical(): Promise<void> | void { 
    return this.autoOrganize('dagre'); 
  }
  
  organizeGrid(): Promise<void> | void { 
    return this.autoOrganize('grid'); 
  }
  
  organizeCircular(): Promise<void> | void { 
    return this.autoOrganize('circle'); 
  }
  
  organizeBreadthFirst(): Promise<void> | void { 
    return this.autoOrganize('breadthfirst'); 
  }

  // New method to organize multiple selected groups
  organizeMultipleGroups(groupIds: string[], layoutType: string = 'dagre'): Promise<void> | void {
    try {
      const currentElements = this.excalidrawAPI.getSceneElements();
      const allGroups = getRabbitGroupsFromElements(currentElements);
      
      // Get all elements from the specified groups
      const multiGroupElementIds: string[] = [];
      const selectedGroups: any[] = [];
      
      groupIds.forEach(groupId => {
        const group = allGroups.get(groupId);
        if (group) {
          selectedGroups.push(group);
          const groupElementIds = [
            ...(group.searchBox ? [group.searchBox.id] : []),
            ...group.images.map(img => img.id)
          ];
          multiGroupElementIds.push(...groupElementIds);
        }
      });

      if (multiGroupElementIds.length === 0) {
        return;
      }

      const multiGroupElements = currentElements.filter(el => multiGroupElementIds.includes(el.id));
      
      const cyElements = this.convertToCytoscapeFormatMultipleGroups(multiGroupElements, selectedGroups);
      
      if (cyElements.length === 0) {
        return;
      }

      const cy = cytoscape({
        elements: cyElements,
        headless: true, 
      });

      const layout = cy.layout(this.getLayoutConfigMultipleGroups(layoutType, selectedGroups));
      
      return new Promise<void>((resolve) => {
        layout.on('layoutstop', () => {
          const updatedElements = this.applyLayoutPositionsMultipleGroups(currentElements, cy, layoutType, multiGroupElementIds);
          
          this.excalidrawAPI.updateScene({
            elements: updatedElements
          });

          // Force binding refresh after a short delay to ensure positions are applied
          setTimeout(() => {
            this.forceBindingRefresh();
          }, 50);

          cy.destroy();
          resolve();
        });
        
        layout.run();
      });

    } catch (error) {
      console.error("Error in organizeMultipleGroups:", error);
    }
  }

  convertToCytoscapeFormatMultipleGroups(elements: readonly ExcalidrawElement[], selectedGroups: any[]): any[] {
    const nodes: any[] = [];
    const edges: any[] = [];

    elements.forEach((element: ExcalidrawElement) => {
        if (element.type === 'rabbit-searchbox' || element.type === 'rabbit-image') {
            nodes.push({
                data: { 
                    id: element.id, 
                    type: element.type,
                    width: element.width || 100,
                    height: element.height || 100
                }
            });
        }
    });

    // Add edges from searchboxes to images within each selected group
    selectedGroups.forEach(group => {
      group.images.forEach((image: any) => {
        const sourceExists = elements.find(el => el.id === group.searchBox?.id);
        const targetExists = elements.find(el => el.id === image.id);
        
        if (sourceExists && targetExists) {
          edges.push({
            data: {
              id: `${group.searchBox.id}-${image.id}`,
              source: group.searchBox.id,
              target: image.id
            }
          });
        }
      });
    });

    return [...nodes, ...edges];
  }

  getLayoutConfigMultipleGroups(layoutType: string, selectedGroups: any[]): any {
    const totalNodes = selectedGroups.reduce((count, group) => {
      return count + 1 + group.images.length; // searchbox + images
    }, 0);
    
    const layouts: Record<string, any> = {
      dagre: {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 120,
        rankSep: 100,
        fit: false,
        padding: 30
      },
      grid: {
        name: 'grid',
        rows: undefined,
        cols: Math.ceil(Math.sqrt(totalNodes)),
        fit: false,
        padding: 30,
        spacingFactor: 1.5,
        avoidOverlap: true,
        condense: false
      },
      circle: {
        name: 'circle',
        fit: false,
        padding: 30,
        radius: Math.max(200, totalNodes * 30),
        avoidOverlap: true,
        spacingFactor: 1
      },
      breadthfirst: {
        name: 'breadthfirst',
        directed: true,
        roots: selectedGroups.map(group => group.searchBox?.id).filter(Boolean),
        spacingFactor: 2,
        fit: false,
        padding: 30,
        avoidOverlap: true
      }
    };

    return layouts[layoutType] || layouts.dagre;
  }

  applyLayoutPositionsMultipleGroups(elements: readonly ExcalidrawElement[], cy: any, layoutType: string, multiGroupElementIds: string[]): ExcalidrawElement[] {
    const positions: { x: number, y: number, id: string }[] = [];
    cy.nodes().forEach((node: any) => {
      const pos = node.position();
      positions.push({ x: pos.x, y: pos.y, id: node.id() });
    });
    
    if (positions.length === 0) return [...elements];

    // Use your original layout methods but only apply to selected group elements
    let tempElements = [...elements];
    
    // Create a temporary set with only the selected group elements for layout calculation
    const multiGroupElementsForLayout = elements.filter(el => multiGroupElementIds.includes(el.id));
    
    // Apply your original layout method to get the positioning logic
    let layoutedMultiGroupElements: ExcalidrawElement[];
    switch (layoutType) {
      case 'grid':
        layoutedMultiGroupElements = this.applyGridLayout(multiGroupElementsForLayout, positions);
        break;
      case 'breadthfirst':
        layoutedMultiGroupElements = this.applyBreadthFirstLayout(multiGroupElementsForLayout, positions);
        break;
      case 'circle':
        layoutedMultiGroupElements = this.applyCircularLayout(multiGroupElementsForLayout, positions);
        break;
      case 'dagre':
      default:
        layoutedMultiGroupElements = this.applyHierarchicalLayout(multiGroupElementsForLayout, positions);
        break;
    }

    // Apply the new positions only to the selected group elements
    return tempElements.map((element: ExcalidrawElement) => {
      if (multiGroupElementIds.includes(element.id)) {
        const layoutedElement = layoutedMultiGroupElements.find(el => el.id === element.id);
        return layoutedElement || element;
      }
      return element; // Don't change elements not in selected groups
    });
  }

  // Multiple groups organization methods that use your original formatting
  organizeMultipleGroupsHierarchical(groupIds: string[]): Promise<void> | void { 
    return this.organizeMultipleGroups(groupIds, 'dagre'); 
  }

  organizeMultipleGroupsGrid(groupIds: string[]): Promise<void> | void { 
    return this.organizeMultipleGroups(groupIds, 'grid'); 
  }

  organizeMultipleGroupsCircular(groupIds: string[]): Promise<void> | void { 
    return this.organizeMultipleGroups(groupIds, 'circle'); 
  }

  organizeMultipleGroupsBreadthFirst(groupIds: string[]): Promise<void> | void { 
    return this.organizeMultipleGroups(groupIds, 'breadthfirst'); 
  }

  getGroupsCount(): number {
    const elements = this.excalidrawAPI.getSceneElements();
    const groups = getRabbitGroupsFromElements(elements);
    return groups.size;
  }

  removeAllSearchGroups(): number {
    const elements = this.excalidrawAPI.getSceneElements();
    const groups = getRabbitGroupsFromElements(elements);
    
    const updatedElements = elements.map(element => {
      if (element.customData?.rabbitGroup) {
        const newCustomData = { ...element.customData };
        delete newCustomData.rabbitGroup;
        return {
          ...element,
          customData: Object.keys(newCustomData).length > 0 ? newCustomData : undefined
        };
      }
      return element;
    });

    this.excalidrawAPI.updateScene({ elements: updatedElements });
    return groups.size;
  }
}

export { AutoOrganizer };