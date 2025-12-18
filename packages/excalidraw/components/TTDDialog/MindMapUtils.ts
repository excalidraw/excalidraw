import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import { DEFAULT_EXPORT_PADDING } from "@excalidraw/common";
import { canvasToBlob } from "../../data/blob";
import { exportToCanvas } from "../../index";

// Simple ID generator
const randomId = () => Math.random().toString(36).substr(2, 9);

export interface MindMapNode {
    text: string;
    children?: MindMapNode[];
    bgColor?: string;
    textColor?: string;
}

interface LayoutNode {
    data: MindMapNode;
    x: number;
    y: number;
    width: number;
    height: number;
    children: LayoutNode[];
    id: string;
    bgColor: string;
}

const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 80;
const GAP_X = 100;
const GAP_Y = 20;

const COLORS = [
    "#ffc9c9",
    "#b2f2bb",
    "#a5d8ff",
    "#ffec99",
    "#eebefa",
];

const getRandomColor = (depth: number) => {
    return COLORS[depth % COLORS.length];
};

const createTextElement = (text: string, x: number, y: number, width: number, height: number, id: string): any => {
    // Approximate centering
    // In a real implementation we would measure text
    const fontSize = 16;
    const lineHeight = 1.25;
    const estimatedTextHeight = text.split("\n").length * fontSize * lineHeight;
    const textY = y + (height - estimatedTextHeight) / 2;

    return {
        type: "text",
        version: 1,
        versionNonce: 0,
        isDeleted: false,
        id: id + "-text",
        fillStyle: "hachure",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        angle: 0,
        x: x + 10, // padding
        y: textY,
        strokeColor: "#1e1e1e",
        backgroundColor: "transparent",
        width: width - 20,
        height: estimatedTextHeight,
        seed: Math.random() * 100000,
        groupIds: [],
        frameId: null,
        roundness: null,
        boundElements: [],
        updated: Date.now(),
        link: null,
        locked: false,
        fontSize,
        fontFamily: 1,
        text,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: id,
        originalText: text,
        lineHeight,
    };
};

const createRectElement = (x: number, y: number, width: number, height: number, bgColor: string, id: string): any => {
    return {
        type: "rectangle",
        version: 1,
        versionNonce: 0,
        isDeleted: false,
        id,
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        angle: 0,
        x,
        y,
        strokeColor: "#000000",
        backgroundColor: bgColor,
        width,
        height,
        seed: Math.random() * 100000,
        groupIds: [],
        frameId: null,
        roundness: { type: 3 }, // adaptive radius
        boundElements: [],
        updated: Date.now(),
        link: null,
        locked: false,
    };
};

const createArrowElement = (startId: string, endId: string, startX: number, startY: number, endX: number, endY: number): any => {
    const id = randomId();
    // Simple straight line for now, Excalidraw will bind them
    return {
        id,
        type: "arrow",
        x: startX,
        y: startY,
        width: endX - startX,
        height: endY - startY,
        angle: 0,
        strokeColor: "#40c057",
        backgroundColor: "transparent",
        fillStyle: "hachure",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: { type: 2 },
        seed: Math.random() * 100000,
        version: 1,
        versionNonce: 0,
        isDeleted: false,
        boundElements: [],
        updated: Date.now(),
        points: [[0, 0], [endX - startX, endY - startY]],
        startBinding: { elementId: startId, focus: 0.1, gap: 1 },
        endBinding: { elementId: endId, focus: 0.1, gap: 1 },
        startArrowhead: null,
        endArrowhead: "arrow",
    };
};

// Recursive layout
const calculateLayout = (node: MindMapNode, depth: number = 0): { node: LayoutNode, totalHeight: number } => {
    const width = DEFAULT_WIDTH;
    const height = DEFAULT_HEIGHT;
    const id = randomId();
    const bgColor = node.bgColor || getRandomColor(depth);

    if (!node.children || node.children.length === 0) {
        return {
            node: {
                data: node,
                x: 0,
                y: 0,
                width,
                height,
                children: [],
                id,
                bgColor,
            },
            totalHeight: height,
        };
    }

    const childLayouts: LayoutNode[] = [];
    let currentY = 0;

    for (const child of node.children) {
        const layout = calculateLayout(child, depth + 1);
        // Offset child relative to parent later
        // For now just store the structure
        childLayouts.push(layout.node); // Temporarily simpler
        // We need to store the layout result properly?
        // Actually we need to traverse again to set positions.
    }

    // Re-do correctly
    return {
        node: {
            data: node,
            x: 0,
            y: 0,
            width,
            height,
            children: [], // will fill
            id,
            bgColor,
        },
        totalHeight: 0
    };
};

// Let's do a simpler approach: 
// 1. Calculate subtree heights
// 2. Position nodes

interface ProcessedNode extends MindMapNode {
    id: string;
    width: number;
    height: number;
    subtreeHeight: number;
    x: number;
    y: number;
    bgColor: string;
}

const processNode = (node: MindMapNode, depth: number): ProcessedNode => {
    const id = randomId();
    const width = DEFAULT_WIDTH;
    const height = DEFAULT_HEIGHT;

    // Process children first
    let subtreeHeight = 0;
    const children = node.children || [];

    // We don't have the mapped children yet, need to map recursively
    // Logic: 
    // If leaf: height = DEFAULT_HEIGHT
    // If not leaf: height = sum(children_subtree_heights) + gaps

    // But we are returning ProcessedNode which is just data + layout props. 
    // We can't mutate the input node children in place if type is MindMapNode.

    return {
        ...node,
        id,
        width,
        height,
        subtreeHeight: 0, // Placeholder
        x: 0,
        y: 0,
        bgColor: node.bgColor || getRandomColor(depth),
    };
};

const layoutTree = (node: MindMapNode, depth: number = 0): { processed: ProcessedNode, children: any[] } => {
    const processed = processNode(node, depth);
    const childrenLayouts: any[] = [];

    let totalChildrenHeight = 0;

    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            const result = layoutTree(child, depth + 1);
            childrenLayouts.push(result);
            totalChildrenHeight += result.processed.subtreeHeight;
        }
        // Add gaps
        totalChildrenHeight += (node.children.length - 1) * GAP_Y;
    }

    processed.subtreeHeight = Math.max(processed.height, totalChildrenHeight);

    return { processed, children: childrenLayouts };
};

const positionNodes = (tree: { processed: ProcessedNode, children: any[] }, x: number, y: number, elements: any[]) => {
    const { processed, children } = tree;

    // Center parent vertically relative to subtree
    const myY = y + (processed.subtreeHeight - processed.height) / 2;

    processed.x = x;
    processed.y = myY;

    // Create Elements
    const rect = createRectElement(processed.x, processed.y, processed.width, processed.height, processed.bgColor, processed.id);
    const text = createTextElement(processed.text, processed.x, processed.y, processed.width, processed.height, processed.id);

    // Bind text to container
    // To do that properly we need to update the boundElements of rect
    rect.boundElements = [{ type: "text", id: text.id }];

    elements.push(rect);
    elements.push(text);

    if (children.length > 0) {
        let currentChildY = y;

        for (const childTree of children) {
            positionNodes(childTree, x + processed.width + GAP_X, currentChildY, elements);

            // Create arrow
            const childNode = childTree.processed;

            // Arrow from right center of parent to left center of child
            // Excalidraw bindings handle the exact points if we bind them
            // But we need initial points roughly correct
            const startX = processed.x + processed.width;
            const startY = myY + processed.height / 2;
            const endX = childNode.x; // will be calculated in recursive call? 
            // Wait, we passed x + width + GAP_X effectively. 
            // So we know where it will be.
            const endY = childNode.y + childNode.height / 2; // this is tricky, we need child's Y.

            // Actually, positionNodes computes child X and Y and pushes elements.
            // We can calculate child Y before calling positionNodes? 
            // Or we check the child attributes afterward? 
            // The `childTree.processed` is mutated (it's a reference to the object in the tree structure).

            // Ideally positionNodes returns nothing or we rely on object mutation.

            // Let's rely on the fact that `positionNodes` modifies `childTree.processed`.
            // Wait, I am calculating `myY` inside positionNodes.
            // So after `positionNodes(childTree...)` returns, `childTree.processed.y` should be set.
            // Yes.

            const childActualY = childTree.processed.y + childTree.processed.height / 2;
            const childActualX = childTree.processed.x;

            const arrow = createArrowElement(processed.id, childTree.processed.id, startX, startY, childActualX, childActualY);
            elements.push(arrow);

            currentChildY += childTree.processed.subtreeHeight + GAP_Y;
        }
    }
};

export const parseMermaidToMindMap = (json: MindMapNode): NonDeletedExcalidrawElement[] => {
    const elements: NonDeletedExcalidrawElement[] = [];

    if (!json) return elements;

    const layout = layoutTree(json);
    positionNodes(layout, 0, 0, elements);

    return elements;
};

export const convertMindMapToExcalidraw = async ({
    canvasRef,
    json,
    data,
    setError,
}: {
    canvasRef: React.RefObject<HTMLDivElement | null>;
    json: MindMapNode;
    data: React.MutableRefObject<{
        elements: readonly NonDeletedExcalidrawElement[];
        files: any | null;
    }>;
    setError: (error: Error | null) => void;
}) => {
    const canvasNode = canvasRef.current;
    const parent = canvasNode?.parentElement;

    if (!canvasNode || !parent) {
        return;
    }

    try {
        const elements = parseMermaidToMindMap(json);
        data.current = {
            elements,
            files: null,
        };
        setError(null);

        const canvas = await exportToCanvas({
            elements: data.current.elements,
            files: data.current.files,
            exportPadding: DEFAULT_EXPORT_PADDING,
            maxWidthOrHeight:
                Math.max(parent.offsetWidth, parent.offsetHeight) *
                window.devicePixelRatio,
        });

        try {
            await canvasToBlob(canvas);
        } catch (e: any) {
            if (e.name === "CANVAS_POSSIBLY_TOO_BIG") {
                throw new Error("Canvas too big");
            }
            throw e;
        }
        parent.style.background = "var(--default-bg-color)";
        canvasNode.replaceChildren(canvas);
    } catch (err: any) {
        parent.style.background = "var(--default-bg-color)";
        setError(err);
    }
};
