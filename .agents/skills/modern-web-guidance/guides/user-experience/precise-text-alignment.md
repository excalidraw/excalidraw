# Precise Text Alignment

## The Problem

Browsers automatically add extra whitespace above and below text characters to accommodate line-height and font-specific metrics like ascenders and descenders. This "ghost space" makes it impossible to achieve pixel-perfect vertical alignment using standard CSS.

Common issues include:
- **Misaligned Icons**: Text appears visually lower or higher than an adjacent icon even when using `align-items: center`.
- **Inaccurate Padding**: A button with `padding: 12px` visually appears to have more space on top or bottom because of the font's internal leading.
- **Flush Alignment**: You cannot align the top of a capital letter exactly with the top of a container or an adjacent image without using "magic number" negative margins.

## The Solution

The `text-box-trim` and `text-box-edge` properties (shorthand `text-box`) allow you to trim this internal leading based on specific font metrics. By trimming the text box to the **cap-height** (top of capital letters) and the **alphabetic baseline** (bottom of most letters), you can ensure that the element's bounding box matches its visual content.

### Implementation Strategy

1. **MANDATORY**: Apply `text-box-trim: trim-both` (or the `text-box` shorthand) to the element containing the text.
2. **MANDATORY**: Specify which metrics to use for trimming with `text-box-edge`. For most UI alignment, use `cap alphabetic`.
3. **DO** use this to achieve visual vertical centering in flex or grid containers.
4. **DO** use it to ensure that your CSS `padding` values match the visual gap between the text and the container edge.
5. **DO NOT** use it on long-form body text where traditional line-spacing is necessary for readability. It is best suited for headings, buttons, and UI labels.

## Implementation Guide

### Use case 1: Trim internal leading for badges

Different fonts have different amounts of built-in spacing above and below the text. This can provide challenges in matching a design, or in visually centering text in a badge. When you want a container's padding to exactly hug the text, use `text-box: trim-both cap alphabetic`. This is especially useful for dense UI components like badges or tags. This allows the padding to start right at the text edge on all sides.

```css
.badge {
  padding: 10px;
  background: hotpink;
  border-radius: 10px;
  /* 
    Trims the top to the cap-height and 
    the bottom to the alphabetic baseline.
  */
  text-box: trim-both cap alphabetic;
}
```

### Use case 2: Center text with icons

When using Flexbox to align text and icons, the "ghost space" often makes the text look slightly off-center. Trimming the box ensures the layout engine uses the actual visible letter height for alignment.

```css
.button {
  display: inline-flex;
  align-items: center;
  gap: 8px; 
}
/* 
  text-box does NOT inherit, and must be applied directly to the text element.
*/
.button-text{
  /* 
    The flex container now centers against the 
    visible letters, not the invisible font box.
  */
  text-box: trim-both cap alphabetic;
}
```

### Use case 3: Align text flush with top edges

To align a heading perfectly with the top of an adjacent image or decorative element, use `trim-start cap alphabetic`. Even though the end will not be trimmed, the end edge must be defined.

```css
.hero {
  display: flex;
  align-items: flex-start;
}

h1 {
  /* MANDATORY: The bottom edge must also be defined, even though only the top is trimmed. */
  text-box: trim-start cap alphabetic;
}
```

## Best Practices

- **DO** use the `text-box` shorthand for conciseness: `text-box: <trim-direction> <edges>`.
- **DO** always specify both edges, even if only one edge is being trimmed (unless using the default `text` edge).
- **DO** combine with `line-height` for controlled spacing. Trimming removes the leading before the first and last line of text, but `line-height` still affects the distance between lines in multi-line text.
- **DO NOT** apply to every element. Use it only where precision alignment is a requirement.

### Fallback strategies

text-box has limited availability.
Supported by: Chrome 133 (Feb 2025), Edge 133 (Feb 2025), and Safari 18.2 (Dec 2024).
Unsupported in: Firefox.

`text-box` is a progressive enhancement. In browsers that do not support it, the text will simply render with its default leading. Your layout will still be functional, though slightly less precise. No special fallback code is required as the properties are safely ignored by older browsers.

## Other Considerations

1. **Font Metrics**: Different fonts have different internal metrics. `cap alphabetic` is a reliable default, but some fonts or use cases may require `ex` (x-height) for better lowercase alignment.
2. **Multi-line Text**: Trimming applies to the first and last line of the block. Internal lines are not affected.
