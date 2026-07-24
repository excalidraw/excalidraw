# Excalidraw Local MCP Server

Local stdio MCP server for scene file operations against `.excalidraw` files.

## Root directory

The server is limited to:

- `EXCALIDRAW_MCP_ROOT` when set.
- `/home/diplov/excalidraw/excalidraw-app` by default.

## Tools

- `scene.list`
- `scene.get`
- `scene.create`
- `scene.update`
- `scene.delete`
- `scene.export`

`scene.export` supports both `json` and `svg`.

## Build and run

```bash
cd /home/diplov/excalidraw
corepack yarn@1.22.22 --cwd ./tools/mcp-excalidraw build
node ./tools/mcp-excalidraw/dist/index.js
```

## Test

```bash
cd /home/diplov/excalidraw
corepack yarn@1.22.22 --cwd ./tools/mcp-excalidraw test
```
