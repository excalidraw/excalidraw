import React from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/dist/types/excalidraw/types';
import { 
  FillStyle, 
  StrokeStyle, 
  Arrowhead, 
  ExcalidrawElement, 
  FractionalIndex, 
  PointBinding, 
  ExcalidrawTextElement, 
  ExcalidrawArrowElement 
} from '../packages/element/src/types';
import { Radians, LocalPoint } from '../packages/math/src/types';
import { pointFrom } from '../packages/math/src/point';

interface SidebarProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

const Sidebar: React.FC<SidebarProps> = ({ excalidrawAPI }) => {
  const addRectangle = () => {
    if (!excalidrawAPI) return;
    const elements = [
      {
        id: 'a1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        text: '',
        strokeColor: '#000000',
        backgroundColor: '#ffffff',
        fillStyle: 'solid' as FillStyle,
        strokeWidth: 1,
        strokeStyle: 'solid' as StrokeStyle,
        roughness: 0,
        opacity: 100,
        seed: 1,
        angle: 0 as Radians,
        startBinding: null,
        endBinding: null,
        lastCommittedPoint: null,
        startArrowhead: null,
        endArrowhead: 'arrow',
        roundness: null,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        groupIds: [],
        frameId: null,
        boundElements: [],
        updated: Date.now(),
        link: null,
        locked: false,
        index: 'a1' as FractionalIndex
      } as ExcalidrawElement,
    ] as readonly ExcalidrawElement[];
    excalidrawAPI.updateScene({ elements });
  };

  const addTemplate = () => {
    if (!excalidrawAPI) return;
    const elements = [
      {
        id: 'text-1',
        type: 'text',
        x: 150,
        y: 150,
        width: 100,
        height: 30,
        text: 'Hello World',
        strokeColor: '#000000',
        backgroundColor: 'transparent',
        fillStyle: 'solid' as FillStyle,
        strokeWidth: 1,
        strokeStyle: 'solid' as StrokeStyle,
        roughness: 1,
        opacity: 100,
        seed: 1,
        angle: 0 as Radians,
        originalText: 'Hello World',
        lineHeight: 25 as number & { _brand: 'unitlessLineHeight' },
        fontSize: 20,
        fontFamily: 1,
        textAlign: 'left',
        verticalAlign: 'top',
        containerId: null,
        autoResize: true,
        roundness: null,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        groupIds: [],
        frameId: null,
        boundElements: [],
        updated: Date.now(),
        link: null,
        locked: false,
        index: 'a0' as FractionalIndex
      } as ExcalidrawTextElement,
      {
        id: 'arrow-1',
        type: 'arrow',
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        strokeColor: '#000000',
        backgroundColor: 'transparent',
        fillStyle: 'solid' as FillStyle,
        strokeWidth: 1,
        strokeStyle: 'solid' as StrokeStyle,
        roughness: 1,
        opacity: 100,
        seed: 1,
        angle: 0 as Radians,
        points: [pointFrom(100, 100), pointFrom(200, 200)] as readonly LocalPoint[],
        lastCommittedPoint: pointFrom(200, 200),
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: null,
        elbowed: false,
        roundness: null,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        groupIds: [],
        frameId: null,
        boundElements: [],
        updated: Date.now(),
        link: null,
        locked: false,
        customData: {},
        index: 'a1' as FractionalIndex
      } as ExcalidrawArrowElement
    ];

    excalidrawAPI.updateScene({ elements });
  };

  const saveDiagram = () => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    console.log('Saving diagram:', elements);
  };

  return (
    <div style={{ width: '200px', padding: '10px', borderRight: '1px solid #ccc' }}>
      <button onClick={addRectangle}>Add Rectangle</button>
      <button onClick={addTemplate}>Add Template</button>
      <button onClick={saveDiagram}>Save Diagram</button>
    </div>
  );
};

export default Sidebar;