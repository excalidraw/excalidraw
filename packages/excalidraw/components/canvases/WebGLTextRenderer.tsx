import React, { useRef, useEffect, useMemo } from "react";
import {
  THEME,
  applyDarkModeFilter,
  getFontFamilyString,
  isRTL,
} from "@excalidraw/common";

import { getLineHeightInPx, isTextElement } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "../../types";

type WebGLTextRendererProps = {
  visibleElements: readonly NonDeletedExcalidrawElement[];
  appState: Pick<
    AppState,
    "zoom" | "scrollX" | "scrollY" | "theme" | "editingTextElement"
  >;
  enabled: boolean;
};

class GlyphAtlas {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private glyphMap: Map<string, { x: number; y: number; width: number; height: number }>;
  private nextX: number;
  private nextY: number;
  private rowHeight: number;
  private readonly atlasSize: number;

  constructor(size: number = 1024) {
    this.atlasSize = size;
    this.canvas = document.createElement("canvas");
    this.canvas.width = size;
    this.canvas.height = size;
    this.context = this.canvas.getContext("2d")!;
    this.glyphMap = new Map();
    this.nextX = 0;
    this.nextY = 0;
    this.rowHeight = 0;

    // Clear the atlas
    this.context.fillStyle = "#000";
    this.context.fillRect(0, 0, size, size);
  }

  getGlyph(char: string, font: string): { x: number; y: number; width: number; height: number } {
    const key = `${char}:${font}`;
    if (this.glyphMap.has(key)) {
      return this.glyphMap.get(key)!;
    }

    // Measure the glyph
    this.context.font = font;
    const metrics = this.context.measureText(char);
    const width = Math.ceil(metrics.width) + 2;
    const height = Math.ceil(parseFloat(font) * 1.5) + 2;

    // Check if we need to start a new row
    if (this.nextX + width > this.atlasSize) {
      this.nextX = 0;
      this.nextY += this.rowHeight;
      this.rowHeight = 0;
    }

    // Check if we need to resize the atlas
    if (this.nextY + height > this.atlasSize) {
      // For simplicity, we'll just return a default glyph for now
      // In a real implementation, we would resize the atlas
      return { x: 0, y: 0, width: 10, height: 10 };
    }

    // Draw the glyph
    this.context.font = font;
    this.context.fillStyle = "#fff";
    this.context.fillText(char, this.nextX + 1, this.nextY + height - 1);

    // Store the glyph information
    const glyph = { x: this.nextX, y: this.nextY, width, height };
    this.glyphMap.set(key, glyph);

    // Update the next position
    this.nextX += width;
    this.rowHeight = Math.max(this.rowHeight, height);

    return glyph;
  }

  getTexture(): HTMLCanvasElement {
    return this.canvas;
  }
}

class WebGLTextRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private glyphAtlas: GlyphAtlas;
  private program: WebGLProgram;
  private positionAttribute: number;
  private texCoordAttribute: number;
  private projectionUniform: WebGLUniformLocation;
  private modelViewUniform: WebGLUniformLocation;
  private colorUniform: WebGLUniformLocation;
  private glyphTextureUniform: WebGLUniformLocation;
  private glyphInfoUniform: WebGLUniformLocation;
  private buffer: WebGLBuffer;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2")!;
    this.glyphAtlas = new GlyphAtlas();

    // Create shaders
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      uniform mat4 u_projection;
      uniform mat4 u_modelView;
      varying vec2 v_texCoord;

      void main() {
        gl_Position = u_projection * u_modelView * vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `);

    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_glyphTexture;
      uniform vec4 u_color;
      uniform vec4 u_glyphInfo; // x: glyphX, y: glyphY, z: glyphWidth, w: glyphHeight
      uniform vec2 u_atlasSize;

      void main() {
        vec2 texCoord = vec2(
          (u_glyphInfo.x + v_texCoord.x * u_glyphInfo.z) / u_atlasSize.x,
          (u_glyphInfo.y + v_texCoord.y * u_glyphInfo.w) / u_atlasSize.y
        );
        float alpha = texture2D(u_glyphTexture, texCoord).r;
        gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
      }
    `);

    // Create program
    this.program = this.createProgram(vertexShader, fragmentShader);

    // Get locations
    this.positionAttribute = this.gl.getAttribLocation(this.program, "a_position");
    this.texCoordAttribute = this.gl.getAttribLocation(this.program, "a_texCoord");
    this.projectionUniform = this.gl.getUniformLocation(this.program, "u_projection")!;
    this.modelViewUniform = this.gl.getUniformLocation(this.program, "u_modelView")!;
    this.colorUniform = this.gl.getUniformLocation(this.program, "u_color")!;
    this.glyphTextureUniform = this.gl.getUniformLocation(this.program, "u_glyphTexture")!;
    this.glyphInfoUniform = this.gl.getUniformLocation(this.program, "u_glyphInfo")!;

    // Create buffer
    this.buffer = this.gl.createBuffer()!;

    // Setup texture
    const texture = this.gl.createTexture()!;
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
  }

  private createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error("Shader compilation error:", this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      throw new Error("Shader compilation failed");
    }
    return shader;
  }

  private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error("Program linking error:", this.gl.getProgramInfoLog(program));
      this.gl.deleteProgram(program);
      throw new Error("Program linking failed");
    }
    return program;
  }

  renderText(text: string, x: number, y: number, fontSize: number, fontFamily: string, color: string): void {
    this.gl.useProgram(this.program);

    // Update projection matrix
    const projectionMatrix = [
      2 / this.canvas.width, 0, 0, 0,
      0, -2 / this.canvas.height, 0, 0,
      0, 0, 1, 0,
      -1, 1, 0, 1
    ];
    this.gl.uniformMatrix4fv(this.projectionUniform, false, projectionMatrix);

    // Update model-view matrix
    const modelViewMatrix = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      x, y, 0, 1
    ];
    this.gl.uniformMatrix4fv(this.modelViewUniform, false, modelViewMatrix);

    // Update color
    const [r, g, b, a] = this.hexToRgba(color);
    this.gl.uniform4f(this.colorUniform, r, g, b, a);

    // Update glyph texture
    const glyphTexture = this.glyphAtlas.getTexture();
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.gl.createTexture());
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, glyphTexture);
    this.gl.uniform1i(this.glyphTextureUniform, 0);

    // Render each character
    let currentX = 0;
    for (const char of text) {
      const glyph = this.glyphAtlas.getGlyph(char, `${fontSize}px ${fontFamily}`);
      
      // Update glyph info
      this.gl.uniform4f(this.glyphInfoUniform, glyph.x, glyph.y, glyph.width, glyph.height);

      // Create vertices
      const vertices = [
        currentX, 0,
        currentX + glyph.width, 0,
        currentX, glyph.height,
        currentX + glyph.width, glyph.height
      ];

      const texCoords = [
        0, 1,
        1, 1,
        0, 0,
        1, 0
      ];

      // Combine vertices and tex coords
      const data = new Float32Array([
        vertices[0], vertices[1], texCoords[0], texCoords[1],
        vertices[2], vertices[3], texCoords[2], texCoords[3],
        vertices[4], vertices[5], texCoords[4], texCoords[5],
        vertices[6], vertices[7], texCoords[6], texCoords[7]
      ]);

      // Bind buffer
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.DYNAMIC_DRAW);

      // Enable attributes
      this.gl.enableVertexAttribArray(this.positionAttribute);
      this.gl.vertexAttribPointer(this.positionAttribute, 2, this.gl.FLOAT, false, 16, 0);
      this.gl.enableVertexAttribArray(this.texCoordAttribute);
      this.gl.vertexAttribPointer(this.texCoordAttribute, 2, this.gl.FLOAT, false, 16, 8);

      // Draw
      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

      currentX += glyph.width;
    }
  }

  private hexToRgba(hex: string): [number, number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
      1.0
    ] : [0, 0, 0, 1];
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }
}

const WebGLTextOverlay = ({
  visibleElements,
  appState,
  enabled,
}: WebGLTextRendererProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLTextRenderer | null>(null);

  useEffect(() => {
    if (enabled && canvasRef.current) {
      if (!rendererRef.current) {
        rendererRef.current = new WebGLTextRenderer(canvasRef.current);
      }

      const renderer = rendererRef.current;
      const canvas = canvasRef.current;

      // Resize canvas
      const container = canvas.parentElement;
      if (container) {
        const { width, height } = container.getBoundingClientRect();
        canvas.width = width;
        canvas.height = height;
        renderer.resize(width, height);
      }

      // Render text elements
      const textElements = visibleElements.filter((element) => isTextElement(element));
      
      // Clear canvas
      const gl = canvas.getContext("webgl2")!;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Render each text element
      textElements.forEach((element) => {
        const zoom = appState.zoom.value;
        const scrollX = appState.scrollX;
        const scrollY = appState.scrollY;

        const fontSize = element.fontSize * zoom;
        const lineHeight = getLineHeightInPx(element.fontSize, element.lineHeight) * zoom;
        const width = element.width * zoom;
        const height = element.height * zoom;
        const cx = (element.x + element.width / 2 + scrollX) * zoom;
        const cy = (element.y + element.height / 2 + scrollY) * zoom;

        const color = appState.theme === THEME.DARK
          ? applyDarkModeFilter(element.strokeColor)
          : element.strokeColor;

        const fontFamily = getFontFamilyString({ fontFamily: element.fontFamily });

        // Render text
        renderer.renderText(
          element.text,
          cx - width / 2,
          cy - height / 2,
          fontSize,
          fontFamily,
          color
        );
      });
    }
  }, [visibleElements, appState, enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <div className="excalidraw__text-overlay">
      <canvas
        ref={canvasRef}
        className="excalidraw__webgl-text-overlay"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none"
        }}
      />
    </div>
  );
};

export default React.memo(WebGLTextOverlay);
