import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import { newArrowElement } from "@excalidraw/element/newElement";
import { pointFrom, type LocalPoint } from "@excalidraw/math";
import { newElementWith } from "@excalidraw/element";
import { randomId } from "@excalidraw/common";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import { bindLinearElement } from "@excalidraw/element/binding";
import { updateBoundElements } from "@excalidraw/element/binding";
import type { Scene } from "@excalidraw/element/Scene";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";


// Register the dagre layout
cytoscape.use(dagre);

interface SearchGroup {
  searchBox: ExcalidrawElement;
  images: ExcalidrawElement[];
  arrows: ExcalidrawElement[];
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
  private colorPalette: string[];

  constructor(excalidrawAPI: ExcalidrawImperativeAPI) {
    this.excalidrawAPI = excalidrawAPI;
    this.searchGroups = new Map();
    this.colorPalette = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
    ];
  }

  // Hook into your existing "Add to Canvas" flow
  async enhanceAddToCanvas(
    selectedImages: string[], 
    searchQuery: string, 
    tabData: TabData[], 
    originalAddToCanvas: (images: string[]) => void | Promise<void>
  ): Promise<void> {
    // First, let your original function create the image elements
    await originalAddToCanvas(selectedImages);
    
    // Small delay to ensure elements are fully added
    setTimeout(() => {
      try {
        // Get the newly updated elements
        const currentElements = this.excalidrawAPI.getSceneElements();
        
        // Find the search box that triggered this search
        const searchBox = currentElements.find((el: ExcalidrawElement) => 
          el.type === 'rabbit-searchbox' && 
          (el as any).text?.trim() === searchQuery.trim()
        );
        
        // Find the newly added images (assuming they're the last N rabbit-image elements)
        const allRabbitImages = currentElements.filter((el: ExcalidrawElement) => el.type === 'rabbit-image');
        const newImages = allRabbitImages.slice(-selectedImages.length);
        
        if (!searchBox) {
          console.log("Could not find search box for query:", searchQuery);
          return;
        }
        
        if (!newImages.length) {
          console.log("Could not find newly added images");
          return;
        }

        // Assign color to this search group
        const groupColor = this.getColorForSearch(searchQuery);
        
        // Create arrows from search box to each image
        const arrows = this.createArrowsFromSearchBoxToImages(searchBox, newImages, groupColor);
        
        // Update colors for the group
        const coloredElements = currentElements.map((el: ExcalidrawElement) => {
          if (el.id === searchBox.id || newImages.some((img: ExcalidrawElement) => img.id === el.id)) {
            return { ...el, strokeColor: groupColor };
          }
          return el;
        });

        // Add arrows to the elements
        const elementsWithArrows = [...coloredElements, ...arrows];

        // Store the group with arrows
        const groupId = `search-${Date.now()}`;
        this.searchGroups.set(groupId, {
        searchBox,
        images: newImages,
        arrows: arrows,
        query: searchQuery,
        color: groupColor
        });

        // Update scene with colored elements and arrows
        this.excalidrawAPI.updateScene({
        elements: elementsWithArrows
        });

      } catch (error) {
        console.error("Error in enhanceAddToCanvas:", error);
      }
    }, 100);
  }

  // Auto-organize using Cytoscape layouts
  autoOrganize(layoutType: string = 'dagre'): Promise<void> | void {
    try {
      const currentElements = this.excalidrawAPI.getSceneElements();
      
      // Create Cytoscape elements
      const cyElements = this.convertToCytoscapeFormat(currentElements);
      
      if (cyElements.length === 0) {
        console.log("No elements to organize");
        return;
      }

      // Create temporary Cytoscape instance for layout calculation
      const cy = cytoscape({
        elements: cyElements,
        headless: true, // Don't render, just calculate
      });

      // Run the layout
      const layout = cy.layout(this.getLayoutConfig(layoutType));
      
      return new Promise<void>((resolve) => {
        layout.on('layoutstop', () => {
          // Apply positions back to Excalidraw elements
          const updatedElements = this.applyLayoutPositions(currentElements, cy);
          
          this.excalidrawAPI.updateScene({
            elements: updatedElements
          });

          // Force arrow binding refresh after layout
          setTimeout(() => {
            this.refreshArrowBindings();
          }, 100);

          cy.destroy(); // Clean up
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
    const nodeIds = new Set<string>();

    // Debug: Log all elements
    console.log("All elements for layout:", elements.map(el => ({ id: el.id, type: el.type })));

    // First pass: collect nodes
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
            nodeIds.add(element.id);
        }
    });

    // Debug: Log nodes
    console.log("Nodes found:", nodes);

    // Second pass: collect edges
    elements.forEach((element: ExcalidrawElement) => {
      if (element.type === 'arrow') {
          const arrowElement = element as any;
          
          // More detailed arrow logging
          console.log("Arrow element detailed:", {
              id: arrowElement.id,
              startBinding: JSON.stringify(arrowElement.startBinding),
              endBinding: JSON.stringify(arrowElement.endBinding),
              hasStartBinding: !!arrowElement.startBinding,
              hasEndBinding: !!arrowElement.endBinding
          });
          
          if (arrowElement.startBinding && arrowElement.endBinding) {
              const sourceId = arrowElement.startBinding.elementId;
              const targetId = arrowElement.endBinding.elementId;
              
              console.log("Checking binding IDs:", { 
                  sourceId, 
                  targetId, 
                  sourceExists: nodeIds.has(sourceId),
                  targetExists: nodeIds.has(targetId),
                  nodeIds: Array.from(nodeIds) 
              });
              
              if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
                  edges.push({
                      data: {
                          id: element.id,
                          source: sourceId,
                          target: targetId
                      }
                  });
                  console.log("✅ Added edge:", { source: sourceId, target: targetId });
              } else {
                  console.log("❌ Skipped edge - missing nodes:", { sourceId, targetId });
              }
          } else {
              console.log("❌ Arrow missing bindings");
          }
      }
    });

    // Debug: Log final edges
    console.log("Edges found:", edges);

    return [...nodes, ...edges];
  }

  getLayoutConfig(layoutType: string): any {
    const layouts: Record<string, any> = {
      dagre: {
        name: 'dagre',
        rankDir: 'TB', // Top to bottom
        nodeSep: 400,
        rankSep: 250,
        fit: false,
        padding: 50
      },
      grid: {
        name: 'grid',
        rows: 10,
        cols: 3,
        fit: false,
        padding: 50,
        spacingFactor: 5
      },
      circle: {
        name: 'circle',
        fit: true,
        padding: 50,
        radius: 400
      },
      breadthfirst: {
        name: 'breadthfirst',
        directed: true,
        spacingFactor: 4,
        fit: true,
        padding: 50
      },
      force: {
        name: 'cose',
        idealEdgeLength: 300,
        nodeOverlap: 100,
        refresh: 20,
        fit: true,
        padding: 50
      }
    };

    return layouts[layoutType] || layouts.dagre;
  }

  applyLayoutPositions(elements: readonly ExcalidrawElement[], cy: any): ExcalidrawElement[] {
    return elements.map((element: ExcalidrawElement) => {
      const cyNode = cy.getElementById(element.id);
      if (cyNode.length > 0) {
        const position = cyNode.position();
        return {
          ...element,
          x: position.x - (element.width || 100) / 2,
          y: position.y - (element.height || 100) / 2
        };
      }
      return element;
    });
  }

  private createArrowsFromSearchBoxToImages(
    searchBox: ExcalidrawElement, 
    images: ExcalidrawElement[], 
    groupColor: string
  ): ExcalidrawElement[] {
    const arrows: ExcalidrawElement[] = [];

    // Calculate search box center
    const searchBoxCenter = {
      x: searchBox.x + searchBox.width / 2,
      y: searchBox.y + searchBox.height / 2
    };

    images.forEach((image) => {
      // Calculate image center
      const imageCenter = {
        x: image.x + image.width / 2,
        y: image.y + image.height / 2
      };

      // Create arrow points using pointFrom to get proper LocalPoint type
      const startPoint = pointFrom<LocalPoint>(0, 0);
      const endPoint = pointFrom<LocalPoint>(
        imageCenter.x - searchBoxCenter.x,
        imageCenter.y - searchBoxCenter.y
      );

      // Create the arrow element
      const arrow = newArrowElement({
        type: "arrow",
        x: searchBoxCenter.x,
        y: searchBoxCenter.y,
        width: Math.abs(endPoint[0]),
        height: Math.abs(endPoint[1]),
        strokeColor: groupColor,
        backgroundColor: "transparent",
        points: [startPoint, endPoint],
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        startArrowhead: null,
        endArrowhead: "arrow",
        elbowed: false,
      });

      // Set up bindings to connect arrow to elements
      const arrowWithBindings = {
        ...arrow,
        startBinding: {
          elementId: searchBox.id,
          focus: 0,
          gap: 10,
        },
        endBinding: {
          elementId: image.id,
          focus: 0,
          gap: 10,
        },
      };

      arrows.push(arrowWithBindings as ExcalidrawElement);
    });

    console.log(`Created ${arrows.length} arrows from search box to images`);
    return arrows;
  }

  private refreshArrowBindings(): void {
    const elements = this.excalidrawAPI.getSceneElements();
    const arrows = elements.filter((el: any) => el.type === 'arrow');
    
    if (arrows.length === 0) {
      console.log("No arrows found to refresh");
      return;
    }

    console.log(`Refreshing bindings for ${arrows.length} arrows`);

    // Find elements that have bound arrows
    const boundElementIds = new Set<string>();
    arrows.forEach((arrow: any) => {
      if (arrow.startBinding?.elementId) {
        boundElementIds.add(arrow.startBinding.elementId);
      }
      if (arrow.endBinding?.elementId) {
        boundElementIds.add(arrow.endBinding.elementId);
      }
    });

    if (boundElementIds.size === 0) {
      console.log("No bound elements found");
      return;
    }

    console.log(`Found ${boundElementIds.size} bound elements`);

    // Very gentle nudge - just tiny position change to trigger recalculation
    const nudgedElements = elements.map((el: any) => {
      if (boundElementIds.has(el.id)) {
        return {
          ...el,
          x: el.x + 0.01, // Tiny movement
        };
      }
      return el;
    });

    // Apply the nudge
    this.excalidrawAPI.updateScene({
      elements: nudgedElements
    });

    // Move back to exact original position after a short delay
    setTimeout(() => {
      const restoredElements = nudgedElements.map((el: any) => {
        if (boundElementIds.has(el.id)) {
          return {
            ...el,
            x: el.x - 0.01, // Move back to exact original position
          };
        }
        return el;
      });

      this.excalidrawAPI.updateScene({
        elements: restoredElements
      });

      console.log("Arrow binding refresh completed");
    }, 50);
  }

  getColorForSearch(searchQuery: string): string {
    // Simple hash to consistently assign colors
    let hash = 0;
    for (let i = 0; i < searchQuery.length; i++) {
      hash = searchQuery.charCodeAt(i) + ((hash << 5) - hash);
    }
    return this.colorPalette[Math.abs(hash) % this.colorPalette.length];
  }

  // Public methods for different layout options
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
  
  organizeForceDirected(): Promise<void> | void { 
    return this.autoOrganize('force'); 
  }
}

// Updated command palette integration - no hardcoded searches!
export const createAutoOrganizerCommands = (excalidrawAPI: ExcalidrawImperativeAPI) => {
  const organizer = new AutoOrganizer(excalidrawAPI);

  return [
    {
      label: "Auto-organize: Hierarchical Layout",
      category: "App", // Use DEFAULT_CATEGORIES.app if you have it imported
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
      label: "Auto-organize: Force Directed",
      category: "App",
      predicate: () => true,
      keywords: ["organize", "layout", "force", "physics"],
      perform: () => {
        organizer.organizeForceDirected();
        excalidrawAPI?.setToast({
          message: "Applied force-directed layout",
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
    }
  ];
};

// Export the organizer class to use in App.tsx
export { AutoOrganizer };