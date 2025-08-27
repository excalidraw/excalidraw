      }

const container = getContainerElement(
        element,
        app.scene.getNonDeletedElementsMap(),
      );
      const font = getFontString({
        fontSize: app.state.currentItemFontSize,
        fontFamily: app.state.currentItemFontFamily,
      });
      if (container) {
        const boundTextElement = getBoundTextElement(
          container,
          app.scene.getNonDeletedElementsMap(),
        );
        const wrappedText = wrapText(
          `${editable.value}${data}`,
          font,
          getBoundTextMaxWidth(container, boundTextElement),
        );
        const width = getTextWidth(wrappedText, font);
        editable.style.width = `${width}px`;
      }
    };
    editable.oninput = () => {
      const normalized = normalizeText(editable.value);
      if (editable.value !== normalized) {
        const selectionStart = editable.selectionStart;
        editable.value = normalized;
        // put the cursor at some position close to where it was before
        // normalization (otherwise it'll end up at the end of the text)
        editable.selectionStart = selectionStart;
        editable.selectionEnd = selectionStart;
      }
      onChange(editable.value);
    };
  }
  
  // Helper function to get the leading whitespace from a line
  const getLeadingWhitespace = (line: string): string => {
    const match = line.match(/^[\s\t]*/);
    return match ? match[0] : "";
  };

  editable.onkeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      
      const { selectionStart, selectionEnd, value } = editable;
      const lines = value.split('\n');
      
      // Find the current line by counting newlines before cursor
      let currentLineIndex = 0;
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (charCount + lines[i].length >= selectionStart) {
          currentLineIndex = i;
          break;
        }
        charCount += lines[i].length + 1; // +1 for the newline character
      }
      
      const currentLine = lines[currentLineIndex] || "";
      const leadingWhitespace = getLeadingWhitespace(currentLine);
      
      // Insert newline with preserved indentation
      const beforeCursor = value.substring(0, selectionStart);
      const afterCursor = value.substring(selectionEnd);
      const newValue = beforeCursor + '\n' + leadingWhitespace + afterCursor;
      
      editable.value = newValue;
      
      // Update cursor position to after the inserted indentation
      const newCursorPosition = selectionStart + 1 + leadingWhitespace.length;
      editable.selectionStart = newCursorPosition;
      editable.selectionEnd = newCursorPosition;
      
      // Trigger input event to maintain consistency
      const inputEvent = new Event('input', { bubbles: true });
      editable.dispatchEvent(inputEvent);
      
      return;
    }
  };
}
