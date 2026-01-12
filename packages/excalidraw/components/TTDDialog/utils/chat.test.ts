import {
  addMessages,
  getLastAssistantMessage,
  getMessagesForApi,
  removeLastAssistantMessage,
  updateAssistantContent,
} from "./chat";

import type { ChatHistory } from "../Chat";

describe("chat utils", () => {
  describe("updateAssistantContent", () => {
    it("should update the last assistant message with new payload", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "user",
            content: "Hello",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "2",
            type: "assistant",
            content: "Hi there",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = updateAssistantContent(chatHistory, {
        content: "Hi there, how can I help?",
      });

      expect(result.messages[1].content).toBe("Hi there, how can I help?");
      expect(result.messages[1].id).toBe("2"); // ID should remain the same
    });

    it("should update only the last assistant message when multiple exist", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "assistant",
            content: "First assistant message",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "2",
            type: "user",
            content: "User message",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "3",
            type: "assistant",
            content: "Second assistant message",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = updateAssistantContent(chatHistory, {
        content: "Updated second message",
      });

      expect(result.messages[0].content).toBe("First assistant message");
      expect(result.messages[2].content).toBe("Updated second message");
    });

    it("should update isGenerating flag", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "assistant",
            content: "Message",
            timestamp: new Date("2024-01-01"),
            isGenerating: false,
          },
        ],
      };

      const result = updateAssistantContent(chatHistory, {
        isGenerating: true,
      });

      expect(result.messages[0].isGenerating).toBe(true);
    });

    it("should update error information", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "assistant",
            content: "Message",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = updateAssistantContent(chatHistory, {
        error: "Something went wrong",
        errorType: "network",
      });

      expect(result.messages[0].error).toBe("Something went wrong");
      expect(result.messages[0].errorType).toBe("network");
    });

    it("should return unchanged chatHistory if no assistant message exists", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "user",
            content: "Hello",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = updateAssistantContent(chatHistory, {
        content: "New content",
      });

      expect(result).toEqual(chatHistory);
    });

    it("should not mutate original chatHistory", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "assistant",
            content: "Original",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = updateAssistantContent(chatHistory, {
        content: "Updated",
      });

      expect(chatHistory.messages[0].content).toBe("Original");
      expect(result.messages[0].content).toBe("Updated");
    });
  });

  describe("getLastAssistantMessage", () => {
    it("should return the last assistant message", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "user",
            content: "Hello",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "2",
            type: "assistant",
            content: "Hi there",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = getLastAssistantMessage(chatHistory);

      expect(result).toEqual({
        id: "2",
        type: "assistant",
        content: "Hi there",
        timestamp: new Date("2024-01-01"),
      });
    });

    it("should return the last assistant message when multiple exist", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "assistant",
            content: "First",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "2",
            type: "user",
            content: "User",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "3",
            type: "assistant",
            content: "Second",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = getLastAssistantMessage(chatHistory);

      expect(result.id).toBe("3");
      expect(result.content).toBe("Second");
    });

    it("should return undefined if no assistant message exists", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "user",
            content: "Hello",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = getLastAssistantMessage(chatHistory);

      expect(result).toBeUndefined();
    });

    it("should return undefined for empty messages array", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [],
      };

      const result = getLastAssistantMessage(chatHistory);

      expect(result).toBeUndefined();
    });
  });

  describe("addMessages", () => {
    it("should add a single message with id and timestamp", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [],
      };

      const result = addMessages(chatHistory, [
        {
          type: "user",
          content: "Hello",
        },
      ]);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toMatchObject({
        type: "user",
        content: "Hello",
      });
      expect(result.messages[0].id).toBeDefined();
      expect(result.messages[0].timestamp).toBeInstanceOf(Date);
    });

    it("should add multiple messages", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [],
      };

      const result = addMessages(chatHistory, [
        {
          type: "user",
          content: "Hello",
        },
        {
          type: "assistant",
          content: "Hi there",
        },
      ]);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].type).toBe("user");
      expect(result.messages[1].type).toBe("assistant");
    });

    it("should append to existing messages", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "user",
            content: "Existing",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = addMessages(chatHistory, [
        {
          type: "assistant",
          content: "New message",
        },
      ]);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content).toBe("Existing");
      expect(result.messages[1].content).toBe("New message");
    });

    it("should add system messages", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [],
      };

      const result = addMessages(chatHistory, [
        {
          type: "system",
          content: "Rate limit reached",
        },
      ]);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe("system");
      expect(result.messages[0].content).toBe("Rate limit reached");
    });

    it("should preserve additional message properties", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [],
      };

      const result = addMessages(chatHistory, [
        {
          type: "assistant",
          content: "Message",
          isGenerating: true,
          error: "Error text",
          errorType: "parse",
        },
      ]);

      expect(result.messages[0].isGenerating).toBe(true);
      expect(result.messages[0].error).toBe("Error text");
      expect(result.messages[0].errorType).toBe("parse");
    });

    it("should not mutate original chatHistory", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [],
      };

      const result = addMessages(chatHistory, [
        {
          type: "user",
          content: "Hello",
        },
      ]);

      expect(chatHistory.messages).toHaveLength(0);
      expect(result.messages).toHaveLength(1);
    });

    it("should generate unique IDs for each message", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [],
      };

      const result = addMessages(chatHistory, [
        {
          type: "user",
          content: "Message 1",
        },
        {
          type: "assistant",
          content: "Message 2",
        },
      ]);

      expect(result.messages[0].id).not.toBe(result.messages[1].id);
    });
  });

  describe("removeLastAssistantMessage", () => {
    it("should remove the last assistant message", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "user",
            content: "Hello",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "2",
            type: "assistant",
            content: "Hi there",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "3",
            type: "user",
            content: "How are you?",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = removeLastAssistantMessage(chatHistory);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].id).toBe("1");
      expect(result.messages[1].id).toBe("3");
    });

    it("should remove only the last assistant message when multiple exist", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "assistant",
            content: "First",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "2",
            type: "user",
            content: "User",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "3",
            type: "assistant",
            content: "Second",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = removeLastAssistantMessage(chatHistory);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].id).toBe("1");
      expect(result.messages[1].id).toBe("2");
    });

    it("should return unchanged chatHistory if no assistant message exists", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "user",
            content: "Hello",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = removeLastAssistantMessage(chatHistory);

      expect(result).toEqual(chatHistory);
    });

    it("should handle empty messages array", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [],
      };

      const result = removeLastAssistantMessage(chatHistory);

      expect(result).toEqual(chatHistory);
    });

    it("should not mutate original chatHistory", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "assistant",
            content: "Message",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = removeLastAssistantMessage(chatHistory);

      expect(chatHistory.messages).toHaveLength(1);
      expect(result.messages).toHaveLength(0);
    });
  });

  describe("getMessagesForApi", () => {
    it("should return last user message and last two assistant messages", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "user",
            content: "First question",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "2",
            type: "assistant",
            content: "First answer",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "3",
            type: "user",
            content: "Second question",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "4",
            type: "assistant",
            content: "Second answer",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = getMessagesForApi(chatHistory);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        role: "user",
        content: "Second question",
      });
      expect(result[1]).toEqual({
        role: "assistant",
        content: "First answer",
      });
      expect(result[2]).toEqual({
        role: "assistant",
        content: "Second answer",
      });
    });

    it("should filter out messages with empty content", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "user",
            content: "",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "2",
            type: "user",
            content: "Valid question",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "3",
            type: "assistant",
            content: "",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "4",
            type: "assistant",
            content: "Valid answer",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = getMessagesForApi(chatHistory);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe("Valid question");
      expect(result[1].content).toBe("Valid answer");
    });

    it("should only include last two assistant messages when more exist", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "user",
            content: "Question",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "2",
            type: "assistant",
            content: "First",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "3",
            type: "assistant",
            content: "Second",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "4",
            type: "assistant",
            content: "Third",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = getMessagesForApi(chatHistory);

      expect(result).toHaveLength(3);
      expect(result[0].role).toBe("user");
      expect(result[1].content).toBe("Second");
      expect(result[2].content).toBe("Third");
    });

    it("should return only user message if no assistant messages", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "user",
            content: "Question",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = getMessagesForApi(chatHistory);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: "user",
        content: "Question",
      });
    });

    it("should return only assistant messages if no user message", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "assistant",
            content: "Answer",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = getMessagesForApi(chatHistory);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: "assistant",
        content: "Answer",
      });
    });

    it("should return empty array for empty messages", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [],
      };

      const result = getMessagesForApi(chatHistory);

      expect(result).toEqual([]);
    });

    it("should return the last user message from multiple user messages", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "user",
            content: "First question",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "2",
            type: "user",
            content: "Second question",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "3",
            type: "user",
            content: "Third question",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "4",
            type: "assistant",
            content: "Answer",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = getMessagesForApi(chatHistory);

      expect(result[0]).toEqual({
        role: "user",
        content: "Third question",
      });
    });

    it("should handle system messages by filtering them out", () => {
      const chatHistory: ChatHistory = {
        id: "chat-1",
        currentPrompt: "",
        messages: [
          {
            id: "1",
            type: "user",
            content: "Question",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "2",
            type: "system",
            content: "System message",
            timestamp: new Date("2024-01-01"),
          },
          {
            id: "3",
            type: "assistant",
            content: "Answer",
            timestamp: new Date("2024-01-01"),
          },
        ],
      };

      const result = getMessagesForApi(chatHistory);

      expect(result).toHaveLength(2);
      expect(result.some((msg) => msg.role === "system")).toBe(false);
    });
  });
});
