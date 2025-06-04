import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import { randomId } from "@excalidraw/common";

// Register the dagre layout
cytoscape.use(dagre);

interface SearchGroup {
  searchBox: ExcalidrawElement;
  images: ExcalidrawElement[];
  query: string;
  color: string;
}

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
  private searchGroups: Map<string, SearchGroup>;
  private usedColors: Set<string>;
  private currentLayoutType: string = 'dagre'; // Track current layout type

  constructor(excalidrawAPI: ExcalidrawImperativeAPI) {
    this.excalidrawAPI = excalidrawAPI;
    this.searchGroups = new Map();
    this.usedColors = new Set();
    this.currentLayoutType = 'dagre';
  }

  generateUniqueColor(): string {
    const maxAttempts = 1000;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const hue = Math.floor(Math.random() * 360);
      const saturation = 65 + Math.floor(Math.random() * 25);
      const lightness = 45 + Math.floor(Math.random() * 15);
      
      const hexColor = this.hslToHex(hue, saturation, lightness);
      
      if (!this.usedColors.has(hexColor)) {
        this.usedColors.add(hexColor);
        return hexColor;
      }
      attempts++;
    }
    
    const fallbackHue = (Date.now() % 360);
    const fallbackColor = this.hslToHex(fallbackHue, 70, 50);
    this.usedColors.add(fallbackColor);
    return fallbackColor;
  }

  hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  getColorForSearch(searchQuery: string): string {
    // Check if we already have a color for this exact query
    for (const [groupId, group] of this.searchGroups) {
      if (group.query === searchQuery) {
        return group.color;
      }
    }
    return this.generateUniqueColor();
  }

  async enhanceAddToCanvas(
    selectedImages: string[], 
    searchQuery: string, 
    tabData: TabData[], 
    originalAddToCanvas: (images: string[]) => void | Promise<void>
  ): Promise<void> {
    // create the image elements
    await originalAddToCanvas(selectedImages);
    
    // delay to make sure elements are fully added
    setTimeout(() => {
      try {
        // get newly updated elements
        const currentElements = this.excalidrawAPI.getSceneElements();
        
        // find search box that triggered this search
        const searchBox = currentElements.find((el: ExcalidrawElement) => 
          el.type === 'rabbit-searchbox' && 
          (el as any).text?.trim() === searchQuery.trim()
        );
        
        // find newly added images (assuming last N rabbit-image elements)
        const allRabbitImages = currentElements.filter((el: ExcalidrawElement) => el.type === 'rabbit-image');
        const newImages = allRabbitImages.slice(-selectedImages.length);
        
        if (!searchBox || !newImages.length) {
          console.log("Could not find search box or images for grouping");
          return;
        }

        // Generate unique group ID and color for this search
        const groupId = randomId();
        const groupColor = this.getColorForSearch(searchQuery);
        
        // Update all elements to be part of the same group with same color
        const updatedElements = currentElements.map((el: ExcalidrawElement) => {
          if (el.id === searchBox.id || newImages.some((img: ExcalidrawElement) => img.id === el.id)) {
            return { 
              ...el, 
              strokeColor: groupColor,
              groupIds: [...(el.groupIds || []), groupId] // Add to group
            };
          }
          return el;
        });

        // Store the group information
        this.searchGroups.set(groupId, {
          searchBox: { ...searchBox, groupIds: [...(searchBox.groupIds || []), groupId] },
          images: newImages.map(img => ({ ...img, groupIds: [...(img.groupIds || []), groupId] })),
          query: searchQuery,
          color: groupColor
        });

        // update scene with colored elements
        this.excalidrawAPI.updateScene({
          elements: updatedElements
        });

        // Auto-organize with hierarchical layout after a short delay
        setTimeout(() => {
          this.organizeHierarchical();
        }, 200);

      } catch (error) {
        console.error("Error in enhanceAddToCanvas:", error);
      }
    }, 100);
  }

  // Method to manually group existing elements by search query
  groupExistingElementsByColor(): void {
    const currentElements = this.excalidrawAPI.getSceneElements();
    const colorGroups = new Map<string, ExcalidrawElement[]>();
    
    // Group elements by color
    currentElements.forEach((element) => {
      if (element.type === 'rabbit-searchbox' || element.type === 'rabbit-image') {
        const color = element.strokeColor;
        if (!colorGroups.has(color)) {
          colorGroups.set(color, []);
        }
        colorGroups.get(color)!.push(element);
      }
    });
    
    // Create groups for each color
    const updatedElements = [...currentElements];
    colorGroups.forEach((elements, color) => {
      if (elements.length > 1) {
        const groupId = randomId();
        const searchBox = elements.find(el => el.type === 'rabbit-searchbox');
        const images = elements.filter(el => el.type === 'rabbit-image');
        
        if (searchBox) {
          // Update elements to be part of the same group
          elements.forEach((element) => {
            const elementIndex = updatedElements.findIndex(el => el.id === element.id);
            if (elementIndex !== -1) {
              updatedElements[elementIndex] = {
                ...updatedElements[elementIndex],
                groupIds: [...(element.groupIds || []), groupId]
              };
            }
          });
          
          // Store group information
          this.searchGroups.set(groupId, {
            searchBox: { ...searchBox, groupIds: [...(searchBox.groupIds || []), groupId] },
            images: images.map(img => ({ ...img, groupIds: [...(img.groupIds || []), groupId] })),
            query: (searchBox as any).text || 'unknown',
            color: color
          });
        }
      }
    });
    
    // Update scene with grouped elements
    this.excalidrawAPI.updateScene({
      elements: updatedElements
    });
  }

  // Method to remove a search group (frees up color and ungroups elements)
  removeSearchGroup(groupId: string): void {
    const group = this.searchGroups.get(groupId);
    if (group) {
      this.usedColors.delete(group.color);
      
      // Remove groupId from all elements in the group
      const currentElements = this.excalidrawAPI.getSceneElements();
      const updatedElements = currentElements.map((element) => {
        if (element.groupIds?.includes(groupId)) {
          return {
            ...element,
            groupIds: element.groupIds.filter(id => id !== groupId)
          };
        }
        return element;
      });
      
      this.excalidrawAPI.updateScene({
        elements: updatedElements
      });
      
      this.searchGroups.delete(groupId);
    }
  }

  // auto-organize using Cytoscape layouts
  autoOrganize(layoutType: string = 'dagre'): Promise<void> | void {
    try {
      this.currentLayoutType = layoutType; // Store current layout type
      const currentElements = this.excalidrawAPI.getSceneElements();
      
      // create cytoscape elements
      const cyElements = this.convertToCytoscapeFormat(currentElements);
      
      if (cyElements.length === 0) {
        return;
      }

      // create temporary Cytoscape instance for layout calculation
      const cy = cytoscape({
        elements: cyElements,
        headless: true, 
      });

      // run the layout
      const layout = cy.layout(this.getLayoutConfig(layoutType));
      
      return new Promise<void>((resolve) => {
        layout.on('layoutstop', () => {
          // apply positions back to Excalidraw elements
          const updatedElements = this.applyLayoutPositions(currentElements, cy, layoutType);
          
          this.excalidrawAPI.updateScene({
            elements: updatedElements
          });

          cy.destroy(); // clean up temporary cytoscape elements
          resolve();
        });
        
        layout.run();
      });

    } catch (error) {
      console.error("Error in autoOrganize:", error);
    }
  }

  convertToCytoscapeFormat(elements: readonly ExcalidrawElement[]): any[] {
    const nodes: any[] = [];
    const edges: any[] = [];

    // collect nodes (only search boxes and associated rabbit images)
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

    // create edges between search boxes and their associated images
    // If searchGroups is empty, try to rebuild relationships from stroke colors
    if (this.searchGroups.size === 0) {
      this.rebuildSearchGroupsFromElements(elements);
    }

    this.searchGroups.forEach((group) => {
      group.images.forEach((image) => {
        // Check if both nodes exist in current elements
        const sourceExists = elements.find(el => el.id === group.searchBox.id);
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

  rebuildSearchGroupsFromElements(elements: readonly ExcalidrawElement[]): void {
    // Group elements by stroke color to rebuild relationships
    const colorGroups = new Map<string, { searchBox: ExcalidrawElement | null, images: ExcalidrawElement[] }>();
    
    elements.forEach((element) => {
      if (element.type === 'rabbit-searchbox' || element.type === 'rabbit-image') {
        const color = element.strokeColor;
        if (!colorGroups.has(color)) {
          colorGroups.set(color, { searchBox: null, images: [] });
        }
        
        const group = colorGroups.get(color)!;
        if (element.type === 'rabbit-searchbox') {
          group.searchBox = element;
        } else if (element.type === 'rabbit-image') {
          group.images.push(element);
        }
      }
    });
    
    // Rebuild searchGroups from color groups
    this.searchGroups.clear();
    colorGroups.forEach((group, color) => {
      if (group.searchBox && group.images.length > 0) {
        const groupId = `rebuilt-${Date.now()}-${Math.random()}`;
        this.searchGroups.set(groupId, {
          searchBox: group.searchBox,
          images: group.images,
          query: (group.searchBox as any).text || 'unknown',
          color: color
        });
      }
    });
  }

  getLayoutConfig(layoutType: string): any {
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
        cols: Math.ceil(Math.sqrt(this.getTotalNodeCount())), // Dynamic columns based on node count
        fit: false,
        padding: 30,
        spacingFactor: 1.5, // Increased spacing factor
        avoidOverlap: true,
        condense: false // Don't condense to prevent overlap
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
        roots: this.getRootNodes(),
        spacingFactor: 2, // Increased spacing factor for BFS
        fit: false,
        padding: 30,
        avoidOverlap: true
      }
    };

    return layouts[layoutType] || layouts.dagre;
  }

  getTotalNodeCount(): number {
    // Count all rabbit elements for grid layout calculations
    const allSearchBoxes = Array.from(this.searchGroups.values()).length;
    const allImages = Array.from(this.searchGroups.values()).reduce((count, group) => count + group.images.length, 0);
    return allSearchBoxes + allImages;
  }

  applyLayoutPositions(elements: readonly ExcalidrawElement[], cy: any, layoutType: string): ExcalidrawElement[] {
    // Get all positions first
    const positions: { x: number, y: number, id: string }[] = [];
    cy.nodes().forEach((node: any) => {
      const pos = node.position();
      positions.push({ x: pos.x, y: pos.y, id: node.id() });
    });
    
    if (positions.length === 0) return [...elements];

    // Apply layout-specific positioning
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
    // Calculate spacing based on actual element sizes
    const rabbitElements = elements.filter(el => el.type === 'rabbit-searchbox' || el.type === 'rabbit-image');
    const maxWidth = Math.max(...rabbitElements.map(el => el.width || 100));
    const maxHeight = Math.max(...rabbitElements.map(el => el.height || 100));
    
    const minSpacingX = maxWidth + 50; // Element width + padding
    const minSpacingY = maxHeight + 40; // Element height + padding
    const startX = 100;
    const startY = 100;

    // Calculate grid dimensions
    const totalNodes = positions.length;
    const cols = Math.ceil(Math.sqrt(totalNodes));

    return elements.map((element: ExcalidrawElement) => {
      const position = positions.find(p => p.id === element.id);
      if (position) {
        // Find grid position based on sorted positions
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
    // Calculate spacing based on actual element sizes
    const rabbitElements = elements.filter(el => el.type === 'rabbit-searchbox' || el.type === 'rabbit-image');
    const maxWidth = Math.max(...rabbitElements.map(el => el.width || 100));
    const maxHeight = Math.max(...rabbitElements.map(el => el.height || 100));
    
    const minSpacingX = maxWidth + 60; // Horizontal spacing between siblings
    const minSpacingY = maxHeight + 50; // Vertical spacing between levels
    const startX = 200;
    const startY = 100;

    // Group positions by Y level (approximately)
    const levels = new Map<number, { x: number, y: number, id: string }[]>();
    const tolerance = 50; // Y-coordinate tolerance for same level
    
    positions.forEach(pos => {
      let levelY = Math.round(pos.y / tolerance) * tolerance;
      if (!levels.has(levelY)) {
        levels.set(levelY, []);
      }
      levels.get(levelY)!.push(pos);
    });

    // Sort levels by Y coordinate
    const sortedLevels = Array.from(levels.entries()).sort(([a], [b]) => a - b);

    return elements.map((element: ExcalidrawElement) => {
      const position = positions.find(p => p.id === element.id);
      if (position) {
        // Find which level this element belongs to
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
    // Calculate spacing based on actual element sizes
    const rabbitElements = elements.filter(el => el.type === 'rabbit-searchbox' || el.type === 'rabbit-image');
    const maxWidth = Math.max(...rabbitElements.map(el => el.width || 100));
    const maxHeight = Math.max(...rabbitElements.map(el => el.height || 100));
    
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y));
    
    const cytoscapeWidth = maxX - minX || 1;
    const cytoscapeHeight = maxY - minY || 1;
    
    // Calculate scale based on element sizes
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
    // Calculate spacing based on actual element sizes
    const rabbitElements = elements.filter(el => el.type === 'rabbit-searchbox' || el.type === 'rabbit-image');
    const maxWidth = Math.max(...rabbitElements.map(el => el.width || 100));
    const maxHeight = Math.max(...rabbitElements.map(el => el.height || 100));
    
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y));
    
    const cytoscapeWidth = maxX - minX || 1;
    const cytoscapeHeight = maxY - minY || 1;
    
    // Calculate scale based on actual element sizes
    const targetSpacingX = maxWidth + 60;
    const targetSpacingY = maxHeight + 15;
    
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

  getRootNodes(): string[] {
    // return search box IDs as root nodes for hierarchical layouts
    return Array.from(this.searchGroups.values()).map(group => group.searchBox.id);
  }

  // public methods for different layout options
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

  getAllSearchGroupIds(): string[] {
    return Array.from(this.searchGroups.keys());
  }

  // Public method to get search groups count
  getSearchGroupsCount(): number {
    return this.searchGroups.size;
  }

  // Public method to remove all search groups
  removeAllSearchGroups(): number {
    const groupIds = this.getAllSearchGroupIds();
    groupIds.forEach(groupId => this.removeSearchGroup(groupId));
    return groupIds.length;
  }

  // Public method to check if there are any search groups
  hasSearchGroups(): boolean {
    return this.searchGroups.size > 0;
  }
}

// command palette integration
export const createAutoOrganizerCommands = (excalidrawAPI: ExcalidrawImperativeAPI) => {
  const organizer = new AutoOrganizer(excalidrawAPI);

  return [
    {
      label: "Auto-organize",
      category: "App",
      predicate: () => true,
      keywords: ["organize", "layout", "auto", "default"],
      perform: () => {
        organizer.organizeHierarchical();
        excalidrawAPI?.setToast({
          message: "Applied auto-organization",
          duration: 2000
        });
      }
    },
    {
      label: "Auto-organize: Hierarchical Layout",
      category: "App",
      predicate: () => true,
      keywords: ["organize", "layout", "hierarchy", "tree", "dagre"],
      perform: () => {
        organizer.organizeHierarchical();
        excalidrawAPI?.setToast({
          message: "Applied hierarchical layout",
          duration: 2000
        });
      }
    },
    {
      label: "Auto-organize: Grid Layout",
      category: "App",
      predicate: () => true,
      keywords: ["organize", "layout", "grid", "rows", "columns"],
      perform: () => {
        organizer.organizeGrid();
        excalidrawAPI?.setToast({
          message: "Applied grid layout",
          duration: 2000
        });
      }
    },
    {
      label: "Auto-organize: Circular Layout",
      category: "App",
      predicate: () => true,
      keywords: ["organize", "layout", "circle", "radial"],
      perform: () => {
        organizer.organizeCircular();
        excalidrawAPI?.setToast({
          message: "Applied circular layout",
          duration: 2000
        });
      }
    },
    {
      label: "Auto-organize: Breadth First",
      category: "App", 
      predicate: () => true,
      keywords: ["organize", "layout", "breadth", "tree"],
      perform: () => {
        organizer.organizeBreadthFirst();
        excalidrawAPI?.setToast({
          message: "Applied breadth-first layout",
          duration: 2000
        });
      }
    },
    {
      label: "Group Existing Elements by Color",
      category: "App",
      predicate: () => true,
      keywords: ["group", "color", "organize", "existing"],
      perform: () => {
        organizer.groupExistingElementsByColor();
        excalidrawAPI?.setToast({
          message: "Grouped elements by color",
          duration: 2000
        });
      }
    },
    {
      label: "Remove All Search Groups",
      category: "App", 
      predicate: () => true,
      keywords: ["ungroup", "remove", "clear", "groups"],
      perform: () => {
        const removedCount = organizer.removeAllSearchGroups();
        excalidrawAPI?.setToast({
          message: `Removed ${removedCount} search groups`,
          duration: 2000
        });
      }
    }
  ];
};

// Export the organizer class to use in App.tsx
export { AutoOrganizer };