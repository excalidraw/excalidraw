// Convert SVG to Excalidraw elements

import {
  newElement,
  newTextElement,
  newArrowElement,
  syncInvalidIndices,
} from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import { pointFrom } from "@excalidraw/math";

interface SVGRect {
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  rx?: number; // border radius
}

interface SVGText {
  x: number;
  y: number;
  text: string;
  fontSize?: number;
}

interface SVGPath {
  d: string; // path data
  stroke?: string;
  fill?: string;
}

/**
 * Parse Mermaid SVG and convert to Excalidraw elements
 * Handles Mermaid-specific SVG structure with proper validation
 */
export function svgToExcalidraw(
  svgString: string,
  startX: number = 100,
  startY: number = 100,
): ExcalidrawElement[] {
  const elements: ExcalidrawElement[] = [];

  try {
    // Parse SVG string
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
    const svgElement = svgDoc.querySelector("svg");

    if (!svgElement) {
      throw new Error("Invalid SVG");
    }

    // Get SVG dimensions for proper scaling
    const svgWidth = parseFloat(svgElement.getAttribute("width") || "800");
    const svgHeight = parseFloat(svgElement.getAttribute("height") || "600");
    const viewBox = svgElement.getAttribute("viewBox");
    
    let scaleX = 1;
    let scaleY = 1;
    let offsetX = 0;
    let offsetY = 0;
    
    if (viewBox) {
      const [vx, vy, vw, vh] = viewBox.split(" ").map(Number);
      scaleX = svgWidth / vw;
      scaleY = svgHeight / vh;
      offsetX = -vx * scaleX;
      offsetY = -vy * scaleY;
    }

    // Extract Mermaid nodes (rectangles and other shapes)
    const nodes = svgElement.querySelectorAll("g.node");
    console.log("Processing", nodes.length, "nodes");
    
    nodes.forEach((node, nodeIndex) => {
      try {
        // Check for transform attribute on the g element (Mermaid uses this for positioning)
        const transform = node.getAttribute("transform");
        let translateX = 0;
        let translateY = 0;
        
        if (transform) {
          const translateMatch = transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
          if (translateMatch) {
            translateX = parseFloat(translateMatch[1]);
            translateY = parseFloat(translateMatch[2]);
            console.log(`Node ${nodeIndex} transform: translate(${translateX}, ${translateY})`);
          }
        }
        
        // Get the shape element (rect, circle, polygon, etc.)
        const rect = node.querySelector("rect");
        const polygon = node.querySelector("polygon");
        const circle = node.querySelector("circle");
        const ellipse = node.querySelector("ellipse");
        
        let shape = "rectangle";
        let x = 0, y = 0, width = 100, height = 50;
        let fill = "#a5d8ff";
        let stroke = "#1971c2";
        let label = "";
        
        if (rect) {
          x = parseFloat(rect.getAttribute("x") || "0");
          y = parseFloat(rect.getAttribute("y") || "0");
          width = parseFloat(rect.getAttribute("width") || "100");
          height = parseFloat(rect.getAttribute("height") || "50");
          fill = rect.getAttribute("fill") || "#a5d8ff";
          stroke = rect.getAttribute("stroke") || "#1971c2";
        } else if (circle) {
          const cx = parseFloat(circle.getAttribute("cx") || "0");
          const cy = parseFloat(circle.getAttribute("cy") || "0");
          const r = parseFloat(circle.getAttribute("r") || "25");
          x = cx - r;
          y = cy - r;
          width = height = r * 2;
          fill = circle.getAttribute("fill") || "#a5d8ff";
          stroke = circle.getAttribute("stroke") || "#1971c2";
          shape = "ellipse";
        } else if (ellipse) {
          const cx = parseFloat(ellipse.getAttribute("cx") || "0");
          const cy = parseFloat(ellipse.getAttribute("cy") || "0");
          const rx = parseFloat(ellipse.getAttribute("rx") || "50");
          const ry = parseFloat(ellipse.getAttribute("ry") || "25");
          x = cx - rx;
          y = cy - ry;
          width = rx * 2;
          height = ry * 2;
          fill = ellipse.getAttribute("fill") || "#a5d8ff";
          stroke = ellipse.getAttribute("stroke") || "#1971c2";
          shape = "ellipse";
        } else if (polygon) {
          // Handle diamond shapes
          const points = polygon.getAttribute("points") || "";
          const coords = points.split(" ").map(p => p.split(",").map(Number));
          if (coords.length >= 4) {
            const xs = coords.map(c => c[0]);
            const ys = coords.map(c => c[1]);
            x = Math.min(...xs);
            y = Math.min(...ys);
            width = Math.max(...xs) - x;
            height = Math.max(...ys) - y;
            fill = polygon.getAttribute("fill") || "#a5d8ff";
            stroke = polygon.getAttribute("stroke") || "#1971c2";
            shape = "diamond";
          }
        }
        
        // Apply transform translation first (this is the actual node position!)
        x += translateX;
        y += translateY;
        
        // Then apply scaling and offset
        x = (x * scaleX + offsetX) + startX;
        y = (y * scaleY + offsetY) + startY;
        width = width * scaleX;
        height = height * scaleY;
        
        // Extract text label - look for all text elements in the node
        const textElements = node.querySelectorAll("text, tspan");
        console.log(`Node ${nodeIndex}: Found ${textElements.length} text elements`);
        
        if (textElements.length > 0) {
          const textParts: string[] = [];
          textElements.forEach((te, idx) => {
            const content = te.textContent?.trim();
            console.log(`  Text element ${idx}: "${content}"`);
            if (content) {
              textParts.push(content);
            }
          });
          label = textParts.join(" ");
        }
        
        // If still no label, try getting text from the entire node
        if (!label) {
          const allText = node.textContent?.trim();
          if (allText) {
            label = allText;
            console.log(`  Using node.textContent: "${label}"`);
          }
        }
        
        console.log(`Node ${nodeIndex}: "${label}" at (${Math.round(x)}, ${Math.round(y)}) size ${Math.round(width)}x${Math.round(height)}`);
        
        // Validate dimensions
        if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height) || 
            width <= 0 || height <= 0) {
          console.warn("Invalid element dimensions, skipping");
          return;
        }
        
        // Create Excalidraw element
        const element = newElement({
          type: shape === "ellipse" ? "ellipse" : shape === "diamond" ? "diamond" : "rectangle",
          x,
          y,
          width,
          height,
          strokeColor: stroke || "#1971c2",
          backgroundColor: fill === "none" ? "transparent" : fill || "#a5d8ff",
          fillStyle: fill === "none" ? "hachure" : "solid",
          strokeWidth: 2,
          roughness: 1,
        });
        
        if (element && element.id) {
          elements.push(element);
          
          // Add text label if we found one
          if (label) {
            const text = newTextElement({
              x: x + width / 2,
              y: y + height / 2,
              text: label,
              fontSize: 16,
              fontFamily: 1,
              textAlign: "center",
              verticalAlign: "middle",
              containerId: element.id,
              originalText: label,
            });
            
            if (text && text.id) {
              elements.push(text);
            }
          }
        }
      } catch (error) {
        console.warn("Failed to create node element:", error);
      }
    });

    // Extract Mermaid edges (arrows)
    // Mermaid v10+ uses different class names, try multiple selectors
    let edges = svgElement.querySelectorAll("g.edge");
    console.log("Edge selector 'g.edge' found:", edges.length);
    
    // Try alternative selectors if no edges found
    if (edges.length === 0) {
      // Try finding paths with edge-related classes
      const edgePaths = svgElement.querySelectorAll("path.edge-path, path[class*='edge'], path[class*='flowchart-link']");
      console.log("Alternative edge paths found:", edgePaths.length);
      
      // If we found edge paths, wrap them in a structure similar to g.edge
      if (edgePaths.length > 0) {
        // Process paths directly instead of waiting for g.edge elements
        edgePaths.forEach((path) => {
          try {
            const d = path.getAttribute("d") || "";
            const pathCommands = d.match(/[ML][\d\s,.-]+/g);
            
            if (pathCommands && pathCommands.length >= 2) {
              const startMatch = pathCommands[0].match(/[ML]([\d.-]+)[,\s]+([\d.-]+)/);
              const endMatch = pathCommands[pathCommands.length - 1].match(/[ML]([\d.-]+)[,\s]+([\d.-]+)/);
              
              if (startMatch && endMatch) {
                let x1 = parseFloat(startMatch[1]);
                let y1 = parseFloat(startMatch[2]);
                let x2 = parseFloat(endMatch[1]);
                let y2 = parseFloat(endMatch[2]);
                
                // Apply scaling and offset
                x1 = x1 * scaleX + offsetX + startX;
                y1 = y1 * scaleY + offsetY + startY;
                x2 = x2 * scaleX + offsetX + startX;
                y2 = y2 * scaleY + offsetY + startY;
                
                if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
                  const arrow = newArrowElement({
                    type: "arrow",
                    x: Math.min(x1, x2),
                    y: Math.min(y1, y2),
                    width: Math.abs(x2 - x1) || 1,
                    height: Math.abs(y2 - y1) || 1,
                    strokeColor: path.getAttribute("stroke") || "#1971c2",
                    strokeWidth: 2,
                    roughness: 1,
                    startArrowhead: null,
                    endArrowhead: "arrow",
                    points: [
                      pointFrom(0, 0),
                      pointFrom(x2 - Math.min(x1, x2), y2 - Math.min(y1, y2)),
                    ],
                  });
                  
                  if (arrow && arrow.id) {
                    elements.push(arrow);
                  }
                }
              }
            }
          } catch (error) {
            console.warn("Failed to create arrow from path:", error);
          }
        });
      }
    }
    
    edges.forEach((edge) => {
      try {
        const path = edge.querySelector("path");
        if (path) {
          const d = path.getAttribute("d") || "";
          const pathCommands = d.match(/[ML][\d\s,.-]+/g);
          
          if (pathCommands && pathCommands.length >= 2) {
            // Extract start and end points
            const startMatch = pathCommands[0].match(/[ML]([\d.-]+)[,\s]+([\d.-]+)/);
            const endMatch = pathCommands[pathCommands.length - 1].match(/[ML]([\d.-]+)[,\s]+([\d.-]+)/);
            
            if (startMatch && endMatch) {
              let x1 = parseFloat(startMatch[1]);
              let y1 = parseFloat(startMatch[2]);
              let x2 = parseFloat(endMatch[1]);
              let y2 = parseFloat(endMatch[2]);
              
              // Apply scaling and offset
              x1 = (x1 * scaleX + offsetX) + startX;
              y1 = (y1 * scaleY + offsetY) + startY;
              x2 = (x2 * scaleX + offsetX) + startX;
              y2 = (y2 * scaleY + offsetY) + startY;
              
              // Validate coordinates
              if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
                console.warn("Invalid arrow coordinates, skipping");
                return;
              }
              
              const arrow = newArrowElement({
                type: "arrow",
                x: Math.min(x1, x2),
                y: Math.min(y1, y2),
                width: Math.abs(x2 - x1) || 1,
                height: Math.abs(y2 - y1) || 1,
                strokeColor: path.getAttribute("stroke") || "#1971c2",
                strokeWidth: 2,
                roughness: 1,
                startArrowhead: null,
                endArrowhead: "arrow",
                points: [
                  pointFrom(0, 0),
                  pointFrom(x2 - Math.min(x1, x2), y2 - Math.min(y1, y2)),
                ],
              });
              
              if (arrow && arrow.id) {
                elements.push(arrow);
              }
            }
          }
        }
        
        // Add edge label if present
        const textElement = edge.querySelector("text");
        if (textElement && textElement.textContent) {
          let textX = parseFloat(textElement.getAttribute("x") || "0");
          let textY = parseFloat(textElement.getAttribute("y") || "0");
          
          // Apply scaling and offset
          textX = (textX * scaleX + offsetX) + startX;
          textY = (textY * scaleY + offsetY) + startY;
          
          if (!isNaN(textX) && !isNaN(textY)) {
            const text = newTextElement({
              x: textX,
              y: textY,
              text: textElement.textContent.trim(),
              fontSize: 14,
              fontFamily: 1,
              textAlign: "center",
              verticalAlign: "middle",
            });
            
            if (text && text.id) {
              elements.push(text);
            }
          }
        }
      } catch (error) {
        console.warn("Failed to create edge element:", error);
      }
    });

    // Center the diagram on the canvas
    if (elements.length > 0) {
      // Calculate bounding box of all elements
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      elements.forEach(element => {
        if (element.type !== "text") { // Skip text elements for centering calculation
          minX = Math.min(minX, element.x);
          minY = Math.min(minY, element.y);
          maxX = Math.max(maxX, element.x + element.width);
          maxY = Math.max(maxY, element.y + element.height);
        }
      });
      
      // Calculate center offset
      const diagramWidth = maxX - minX;
      const diagramHeight = maxY - minY;
      const centerX = startX - minX + (diagramWidth > 0 ? 50 : 0);
      const centerY = startY - minY + (diagramHeight > 0 ? 50 : 0);
      
      // Apply centering offset to all elements (create new array with updated positions)
      const centeredElements = elements.map(element => ({
        ...element,
        x: element.x + centerX,
        y: element.y + centerY,
      }));
      
      // Replace elements array with centered elements
      elements.length = 0;
      elements.push(...centeredElements);
    }

    // CRITICAL: Sync fractional indices before returning
    const validElements = syncInvalidIndices(elements);
    
    console.log("=== SVG to Excalidraw Conversion ===");
    console.log("Total elements created:", validElements.length);
    console.log("Element types:", validElements.map(e => `${e.type} (${e.id.substring(0, 8)})`));
    console.log("Nodes found:", nodes.length);
    console.log("Edges found:", edges.length);
    
    // Log element positions for debugging
    validElements.forEach((el, idx) => {
      if (el.type !== "text") {
        console.log(`Element ${idx}: ${el.type} at (${Math.round(el.x)}, ${Math.round(el.y)}) size ${Math.round(el.width)}x${Math.round(el.height)}`);
      }
    });
    
    return validElements;
  } catch (error) {
    console.error("Failed to convert SVG to Excalidraw:", error);
    throw new Error("Unable to parse SVG");
  }
}
