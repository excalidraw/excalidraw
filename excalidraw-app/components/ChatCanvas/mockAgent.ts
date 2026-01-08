/**
 * Mock Agent Service
 * Simulates an AI agent that processes user messages and returns canvas operations.
 */

export interface AgentRequest {
  message: string;
  selectedElements: string[];
  elementCount: number;
  elementDetails?: any[];
}

export interface AgentResponse {
  success: boolean;
  message: string;
  actions?: AgentAction[];
  error?: string;
}

export interface AgentAction {
  type: "addElements" | "updateSelected" | "deleteElements" | "applyStyle";
  payload: any;
}

/**
 * Mock agent that simulates AI responses.
 * In production, this would call a real backend API.
 */
export const mockAgent = async (
  request: AgentRequest
): Promise<AgentResponse> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const { message, selectedElements, elementCount, elementDetails } = request;

  // Simple keyword-based responses
  if (
    message.toLowerCase().includes("color") ||
    message.toLowerCase().includes("red") ||
    message.toLowerCase().includes("blue") ||
    message.toLowerCase().includes("green")
  ) {
    const colorMatch = message.match(/(red|blue|green|yellow|purple|orange)/i);
    const color = colorMatch
      ? colorMatch[1].toLowerCase()
      : "blue";

    const colorMap: Record<string, string> = {
      red: "#ff0000",
      blue: "#0000ff",
      green: "#00ff00",
      yellow: "#ffff00",
      purple: "#800080",
      orange: "#ffa500",
    };

    return {
      success: true,
      message: `Applied ${color} color to ${elementCount} selected element${
        elementCount !== 1 ? "s" : ""
      }.`,
      actions: [
        {
          type: "updateSelected",
          payload: {
            strokeColor: colorMap[color],
            backgroundColor: colorMap[color],
          },
        },
      ],
    };
  }

  if (
    message.toLowerCase().includes("align") ||
    message.toLowerCase().includes("center")
  ) {
    return {
      success: true,
      message: `Aligned ${elementCount} selected element${
        elementCount !== 1 ? "s" : ""
      } to center.`,
      actions: [
        {
          type: "updateSelected",
          payload: {
            textAlign: "center",
          },
        },
      ],
    };
  }

  if (
    message.toLowerCase().includes("bold") ||
    message.toLowerCase().includes("thicker")
  ) {
    return {
      success: true,
      message: `Made ${elementCount} selected element${
        elementCount !== 1 ? "s" : ""
      } bolder.`,
      actions: [
        {
          type: "updateSelected",
          payload: {
            strokeWidth: 3,
          },
        },
      ],
    };
  }

  if (
    message.toLowerCase().includes("duplicate") ||
    message.toLowerCase().includes("copy")
  ) {
    return {
      success: true,
      message: `Duplicated ${elementCount} selected element${
        elementCount !== 1 ? "s" : ""
      }.`,
      actions: [
        {
          type: "addElements",
          payload: {
            elements: elementDetails?.map((el) => ({
              ...el,
              id: `${el.id}-copy-${Date.now()}`,
              x: el.x + 20,
              y: el.y + 20,
            })) || [],
          },
        },
      ],
    };
  }

  if (
    message.toLowerCase().includes("add note") ||
    message.toLowerCase().includes("add text")
  ) {
    return {
      success: true,
      message: "Added a note to the canvas.",
      actions: [
        {
          type: "addElements",
          payload: {
            elements: [
              {
                type: "text",
                text: message.replace(/add note|add text/i, "").trim() || "Note",
                x: 100,
                y: 100,
                width: 200,
                height: 50,
                fontSize: 16,
                fontFamily: 1,
                textAlign: "left",
                verticalAlign: "top",
                strokeColor: "#000000",
                backgroundColor: "#fffacd",
                fillStyle: "solid",
                strokeWidth: 1,
                angle: 0,
              },
            ],
          },
        },
      ],
    };
  }

  // Default response
  return {
    success: true,
    message: `Received: "${message}". Try asking me to change colors, align elements, or add notes!`,
    actions: [],
  };
};
