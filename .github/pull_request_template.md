## Test plan

### Drawing and selection

- [ ] Draw every shape, multi-segment arrow, multi-segment line, single-line text, and multi-line text on the canvas
- [ ] Change the properties (color etc) of a shape and text
- [ ] Resize an element (try every resize handle)
- [ ] Click select an element and drag it.
- [ ] Alt-drag to duplicate an element
- [ ] Click an an element, shift-click others to select a group. Drag the group.
- [ ] Select an element, tap the up/down/left/right arrow keys. It moves.

### Scrolling

- [ ] Pinch-to-zoom works on both desktop touchpad and iOS
- [ ] 2-finger-scroll works on desktop touchpad
- [ ] Hold spacebar and click and drag the canvas. It moves

### Exports

- [ ] Unselect all elements and press the "export" button. The preview looks correct.
- [ ] Select a subset of elements and press the "export" button. The preview contains only the selected elements.
- [ ] Press the "download" button. A `.excalidraw` file is saved to disk.
- [ ] Click the trash button. It clears the screen.
- [ ] Reload the file saved above. It looks correct.

### Performance

- [ ] Load a [big file](https://drive.google.com/open?id=1Yb4UPBiHVXQMmqMN73tirl2zHkKlabE3) and drag one of the elements. It drags smoothly.
