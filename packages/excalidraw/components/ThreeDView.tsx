import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../i18n";
import { actionToggleThreeDMode } from "../actions/actionToggleThreeDMode";
import { actionDeleteSelected } from "../actions";

import type { AppClassProperties, AppState } from "../types";

const CameraIcon = (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
    <circle cx="12" cy="13" r="4"></circle>
  </svg>
);

const PointerIcon = (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 6l4.153 11.793a0.365 .365 0 0 0 .331 .207a0.366 .366 0 0 0 .332 -.207l2.184 -4.793l4.787 -1.994a0.355 .355 0 0 0 .213 -.323a0.355 .355 0 0 0 -.213 -.323l-11.787 -4.36z" />
    <path d="M13.5 13.5l4.5 4.5" />
  </svg>
);

interface ThreeDViewProps {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
  app: AppClassProperties;
}

export const ThreeDView = ({ appState, elements, app }: ThreeDViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const userShapesRef = useRef<THREE.Mesh[]>([]);
  const elementsGroupRef = useRef<THREE.Group | null>(null);
  const meshesMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const [selectedMeshes, setSelectedMeshes] = useState<Set<THREE.Mesh>>(
    new Set(),
  );
  const [meshProps, setMeshProps] = useState<{
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
    materialType: number;
    color: string;
    lightIntensity: number;
  } | null>(null);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const dragPlaneRef = useRef<THREE.Plane>(
    new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
  );
  const isDraggingRef = useRef<boolean>(false);
  const dragStartPointRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const [selectionBox, setSelectionBox] = useState<{
    start: { x: number; y: number };
    current: { x: number; y: number };
    visible: boolean;
  } | null>(null);
  const boxHelpersRef = useRef<Map<THREE.Mesh, THREE.BoxHelper>>(new Map());
  const [interactionMode, setInteractionMode] = useState<"pointer" | "camera">(
    "pointer",
  );
  const [ambientLightIntensity, setAmbientLightIntensity] = useState(0.6);
  const bgTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const [isLiquidMode, setIsLiquidMode] = useState(false);
  const liquidMeshRef = useRef<THREE.Mesh | null>(null);

  const MATERIAL_TYPES = [
    "Matte Plastic",
    "Shiny Plastic",
    "Polished Metal",
    "Brushed Metal",
    "Glass/Crystal",
    "Wireframe",
    "Cartoon",
    "Classic Shiny",
    "Ceramic",
    "Neon",
    "Gold",
    "Grass",
    "Water",
  ];

  const liquidVertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  const liquidFragmentShader = `
    precision highp float;
    uniform vec3 uCamPos;
    uniform mat4 uCamInverseProj;
    uniform mat4 uCamInverseView;
    uniform vec2 uResolution;
    
    struct Shape {
      int type;
      vec3 pos;
      vec3 rot; // Euler angles
      vec3 size;
      vec3 color;
      float intensity;
    };
    
    uniform Shape uShapes[20];
    uniform int uCount;
    uniform float uAmbientLight;
    
    varying vec2 vUv;

    // SDF Primitives
    float sdSphere( vec3 p, float s ) {
      return length(p)-s;
    }
    
    float sdBox( vec3 p, vec3 b ) {
      vec3 q = abs(p) - b;
      return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
    }
    
    float sdCappedCylinder( vec3 p, float h, float r ) {
      vec2 d = abs(vec2(length(p.xz),p.y)) - vec2(r,h);
      return min(max(d.x,d.y),0.0) + length(max(d,0.0));
    }
    
    float sdCappedCone( vec3 p, float h, float r1, float r2 ) {
      vec2 q = vec2( length(p.xz), p.y );
      vec2 k1 = vec2(r2,h);
      vec2 k2 = vec2(r2-r1,2.0*h);
      vec2 ca = vec2(q.x-min(q.x,(q.y<0.0)?r1:r2), abs(q.y)-h);
      vec2 cb = q - k1 + k2*clamp( dot(k1-q,k2)/dot(k2,k2), 0.0, 1.0 );
      float s = (cb.x<0.0 && ca.y<0.0) ? -1.0 : 1.0;
      return s*sqrt( min(dot(ca,ca),dot(cb,cb)) );
    }
    
    float sdTorus( vec3 p, vec2 t ) {
      vec2 q = vec2(length(p.xz)-t.x,p.y);
      return length(q)-t.y;
    }

    // Rotation
    mat3 rotate(vec3 r) {
      float cx = cos(r.x), sx = sin(r.x);
      float cy = cos(r.y), sy = sin(r.y);
      float cz = cos(r.z), sz = sin(r.z);
      return mat3(
        cy*cz, -cy*sz, sy,
        cx*sz + sx*sy*cz, cx*cz - sx*sy*sz, -sx*cy,
        sx*sz - cx*sy*cz, sx*cz + cx*sy*sz, cx*cy
      );
    }

    // Smooth Min
    vec4 opSmoothUnion( vec4 d1, vec4 d2, float k ) {
      float h = clamp( 0.5 + 0.5*(d2.x-d1.x)/k, 0.0, 1.0 );
      float d = mix( d2.x, d1.x, h ) - k*h*(1.0-h);
      vec3 col = mix( d2.yzw, d1.yzw, h );
      return vec4(d, col);
    }

    vec4 map(vec3 p) {
      vec4 res = vec4(10000.0, 0.0, 0.0, 0.0);
      
      for(int i=0; i<20; i++) {
        if(i >= uCount) break;
        
        vec3 localP = p - uShapes[i].pos;
        // Apply inverse rotation
        localP = localP * rotate(uShapes[i].rot);
        
        float d = 10000.0;
        if(uShapes[i].type == 0) d = sdBox(localP, uShapes[i].size / 2.0); // Box size is full width
        else if(uShapes[i].type == 1) d = sdSphere(localP, uShapes[i].size.x); // Sphere radius
        else if(uShapes[i].type == 2) d = sdCappedCylinder(localP, uShapes[i].size.y / 2.0, uShapes[i].size.x); // Cylinder
        else if(uShapes[i].type == 3) d = sdCappedCone(localP, uShapes[i].size.y / 2.0, uShapes[i].size.x, 0.0); // Cone
        else if(uShapes[i].type == 4) d = sdTorus(localP, vec2(uShapes[i].size.x, uShapes[i].size.y)); // Torus
        else if(uShapes[i].type == 5) d = sdSphere(localP, uShapes[i].size.x); // Icosahedron approx as sphere
        
        // Combine color and intensity into yzw
        // We pack intensity into color magnitude or separate?
        // Let's just mix color. Intensity is handled by lighting.
        // We'll use color * (1.0 + intensity) for emission?
        vec3 col = uShapes[i].color;
        if (uShapes[i].intensity > 0.0) {
             col += col * uShapes[i].intensity * 0.5;
        }
        
        res = opSmoothUnion(res, vec4(d, col), 20.0);
      }
      return res;
    }

    vec3 calcNormal( in vec3 p ) {
      const float h = 0.0001;
      const vec2 k = vec2(1,-1);
      return normalize( k.xyy*map( p + k.xyy*h ).x + 
                        k.yyx*map( p + k.yyx*h ).x + 
                        k.yxy*map( p + k.yxy*h ).x + 
                        k.xxx*map( p + k.xxx*h ).x );
    }

    void main() {
      // Ray generation
      vec4 ndc = vec4(vUv * 2.0 - 1.0, -1.0, 1.0);
      vec4 viewRay = uCamInverseProj * ndc;
      viewRay.z = -1.0;
      viewRay.w = 0.0;
      vec3 rd = normalize((uCamInverseView * viewRay).xyz);
      vec3 ro = uCamPos;

      // Raymarching
      float t = 0.0;
      float tmax = 5000.0;
      vec4 res = vec4(-1.0);
      
      for(int i=0; i<128; i++) {
        vec3 p = ro + t*rd;
        res = map(p);
        if(res.x < 0.01 || t > tmax) break;
        t += res.x;
      }

      if(t < tmax && res.x < 0.01) {
        vec3 p = ro + t*rd;
        vec3 n = calcNormal(p);
        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
        
        // Lighting
        float diff = max(dot(n, lightDir), 0.0);
        float amb = uAmbientLight;
        
        vec3 col = res.yzw * (diff + amb);
        
        // Specular
        vec3 ref = reflect(-lightDir, n);
        float spec = pow(max(dot(ref, -rd), 0.0), 32.0);
        col += vec3(1.0) * spec * 0.5;

        gl_FragColor = vec4(col, 1.0);
        
        // Depth output for correct occlusion (approx)
        // This requires WebGL 2 or extension. 
        // For now we just render on top or mix.
        // gl_FragDepth = ...
      } else {
        discard; // Draw nothing if no hit
      }
    }
  `;

  const createMaterial = (type: number, color: THREE.ColorRepresentation) => {
    const threeColor = new THREE.Color(color);

    switch (type) {
      case 0: // Matte Plastic
        return new THREE.MeshStandardMaterial({
          color: threeColor,
          roughness: 0.5,
          metalness: 0.1,
        });
      case 1: // Shiny Plastic
        return new THREE.MeshStandardMaterial({
          color: threeColor,
          roughness: 0.05,
          metalness: 0.1,
        });
      case 2: // Polished Metal
        return new THREE.MeshStandardMaterial({
          color: threeColor,
          roughness: 0.05,
          metalness: 1.0,
        });
      case 3: // Brushed Metal
        return new THREE.MeshStandardMaterial({
          color: threeColor,
          roughness: 0.4,
          metalness: 0.8,
        });
      case 4: // Glass/Crystal
        return new THREE.MeshPhysicalMaterial({
          color: threeColor,
          metalness: 0,
          roughness: 0,
          transmission: 0.9,
          transparent: true,
          opacity: 1,
        });
      case 5: // Wireframe
        return new THREE.MeshBasicMaterial({
          color: threeColor,
          wireframe: true,
        });
      case 6: // Cartoon
        return new THREE.MeshToonMaterial({ color: threeColor });
      case 7: // Classic Shiny (Phong)
        return new THREE.MeshPhongMaterial({
          color: threeColor,
          shininess: 150,
          specular: 0x666666,
        });
      case 8: // Ceramic/Clearcoat
        return new THREE.MeshPhysicalMaterial({
          color: threeColor,
          roughness: 0.2,
          metalness: 0.1,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05,
        });
      case 9: // Neon/Glow
        return new THREE.MeshStandardMaterial({
          color: threeColor,
          emissive: threeColor,
          emissiveIntensity: 0.8,
          roughness: 0.2,
        });
      case 10: // Gold
        return new THREE.MeshStandardMaterial({
          color: 0xffd700,
          roughness: 0.1,
          metalness: 1.0,
        });
      case 11: // Grass
        return new THREE.MeshStandardMaterial({
          color: 0x4caf50,
          roughness: 0.8,
          metalness: 0.0,
          flatShading: true,
        });
      case 12: // Water
        return new THREE.MeshPhysicalMaterial({
          color: 0x00ffff,
          metalness: 0.2,
          roughness: 0.05,
          transmission: 0.9,
          transparent: true,
          opacity: 0.8,
          clearcoat: 1.0,
        });
      default:
        return new THREE.MeshStandardMaterial({ color: threeColor });
    }
  };

  const addShape = (
    type: "cube" | "sphere" | "cylinder" | "cone" | "torus" | "icosahedron",
  ) => {
    if (!sceneRef.current) {
      return;
    }

    let geometry;
    const color = Math.random() * 0xffffff;
    const materialType = Math.floor(Math.random() * 13);
    const material = createMaterial(materialType, color);

    switch (type) {
      case "cube":
        geometry = new THREE.BoxGeometry(100, 100, 100);
        break;
      case "sphere":
        geometry = new THREE.SphereGeometry(70, 32, 32);
        break;
      case "cylinder":
        geometry = new THREE.CylinderGeometry(50, 50, 100, 32);
        break;
      case "cone":
        geometry = new THREE.ConeGeometry(50, 100, 32);
        break;
      case "torus":
        geometry = new THREE.TorusGeometry(40, 15, 16, 100);
        break;
      case "icosahedron":
        geometry = new THREE.IcosahedronGeometry(60);
        break;
    }

    if (geometry) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { isUserShape: true, materialType };
      // Random position above the plane
      mesh.position.set(
        (Math.random() - 0.5) * 500,
        (Math.random() - 0.5) * 500,
        100,
      );
      sceneRef.current.add(mesh);
      userShapesRef.current.push(mesh);
    }
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    pointerDownPos.current = { x: event.clientX, y: event.clientY };

    if (!cameraRef.current || !sceneRef.current || !containerRef.current) {
      return;
    }

    if (interactionMode === "camera") {
      return;
    }

    // Don't start drag if interacting with TransformControls (gizmo)
    if (
      transformControlsRef.current &&
      (transformControlsRef.current as any).axis
    ) {
      return;
    }

    // Don't start drag if clicking on UI
    if (
      (event.target as HTMLElement).tagName === "BUTTON" ||
      (event.target as HTMLElement).tagName === "INPUT"
    ) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const interactableObjects = [
      ...userShapesRef.current,
      ...(elementsGroupRef.current ? elementsGroupRef.current.children : []),
    ];

    const intersects = raycaster.intersectObjects(interactableObjects);

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;

      // Start dragging
      isDraggingRef.current = true;
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
      }

      // Multi-select logic
      if (!selectedMeshes.has(mesh)) {
        // If clicking an unselected item, select it
        // If shift is not held, clear others (simplified: always clear for now unless we add shift logic)
        // But user asked for "dragging the clicked mouse multiple items", implying box select.
        // For click-drag, if we click something NOT selected, we usually select ONLY that.
        // If we click something ALREADY selected, we keep selection and drag all.
        const newSelection = new Set<THREE.Mesh>();
        newSelection.add(mesh);
        setSelectedMeshes(newSelection);

        // Update props for the single selected item
        setMeshProps({
          position: {
            x: mesh.position.x,
            y: mesh.position.y,
            z: mesh.position.z,
          },
          rotation: {
            x: mesh.rotation.x,
            y: mesh.rotation.y,
            z: mesh.rotation.z,
          },
          scale: {
            x: mesh.scale.x,
            y: mesh.scale.y,
            z: mesh.scale.z,
          },
          materialType: mesh.userData.materialType ?? 0,
          color: `#${
            (
              mesh.material as THREE.MeshStandardMaterial
            ).color?.getHexString() ?? "ffffff"
          }`,
          lightIntensity: mesh.userData.lightIntensity ?? 0,
        });
      } else {
        // If clicking already selected item, keep selection
        // Update props if it's the only one, or maybe just the clicked one
        setMeshProps({
          position: {
            x: mesh.position.x,
            y: mesh.position.y,
            z: mesh.position.z,
          },
          rotation: {
            x: mesh.rotation.x,
            y: mesh.rotation.y,
            z: mesh.rotation.z,
          },
          scale: {
            x: mesh.scale.x,
            y: mesh.scale.y,
            z: mesh.scale.z,
          },
          materialType: mesh.userData.materialType ?? 0,
          color: `#${
            (
              mesh.material as THREE.MeshStandardMaterial
            ).color?.getHexString() ?? "ffffff"
          }`,
          lightIntensity: mesh.userData.lightIntensity ?? 0,
        });
      }

      // Setup drag plane at object's Z height
      dragPlaneRef.current.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 0, 1),
        mesh.position,
      );

      const intersectPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragPlaneRef.current, intersectPoint)) {
        dragStartPointRef.current.copy(intersectPoint);
      }
    } else {
      // Clicked empty space - Start Box Selection
      setSelectionBox({
        start: { x: event.clientX, y: event.clientY },
        current: { x: event.clientX, y: event.clientY },
        visible: true,
      });
      // Clear selection if not holding shift (simplified: always clear on empty click)
      setSelectedMeshes(new Set());
      setMeshProps(null);
    }
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (isDraggingRef.current && cameraRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

      const intersectPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragPlaneRef.current, intersectPoint)) {
        const delta = new THREE.Vector3().subVectors(
          intersectPoint,
          dragStartPointRef.current,
        );

        // Move all selected meshes
        selectedMeshes.forEach((mesh) => {
          mesh.position.add(delta);
          mesh.userData.isModified = true;
        });

        // Update drag start point for next frame
        dragStartPointRef.current.copy(intersectPoint);

        // Update props if single selection
        if (selectedMeshes.size === 1) {
          const mesh = Array.from(selectedMeshes)[0];
          setMeshProps({
            position: {
              x: mesh.position.x,
              y: mesh.position.y,
              z: mesh.position.z,
            },
            rotation: {
              x: mesh.rotation.x,
              y: mesh.rotation.y,
              z: mesh.rotation.z,
            },
            scale: {
              x: mesh.scale.x,
              y: mesh.scale.y,
              z: mesh.scale.z,
            },
            materialType: mesh.userData.materialType ?? 0,
            color: `#${
              (
                mesh.material as THREE.MeshStandardMaterial
              ).color?.getHexString() ?? "ffffff"
            }`,
            lightIntensity: mesh.userData.lightIntensity ?? 0,
          });
        }
      }
    } else if (selectionBox && selectionBox.visible) {
      // Update selection box
      setSelectionBox({
        ...selectionBox,
        current: { x: event.clientX, y: event.clientY },
      });
    }
  };

  const handlePointerUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
    }

    if (
      selectionBox &&
      selectionBox.visible &&
      cameraRef.current &&
      containerRef.current
    ) {
      // Perform box selection
      const startX = Math.min(selectionBox.start.x, selectionBox.current.x);
      const endX = Math.max(selectionBox.start.x, selectionBox.current.x);
      const startY = Math.min(selectionBox.start.y, selectionBox.current.y);
      const endY = Math.max(selectionBox.start.y, selectionBox.current.y);

      const rect = containerRef.current.getBoundingClientRect();
      const newSelection = new Set<THREE.Mesh>();

      const interactableObjects = [
        ...userShapesRef.current,
        ...(elementsGroupRef.current ? elementsGroupRef.current.children : []),
      ] as THREE.Mesh[];

      interactableObjects.forEach((mesh) => {
        // Project mesh position to screen space
        const position = mesh.position.clone();
        position.project(cameraRef.current!);

        const screenX = (position.x * 0.5 + 0.5) * rect.width + rect.left;
        const screenY = (-(position.y * 0.5) + 0.5) * rect.height + rect.top;

        if (
          screenX >= startX &&
          screenX <= endX &&
          screenY >= startY &&
          screenY <= endY
        ) {
          newSelection.add(mesh);
        }
      });

      setSelectedMeshes(newSelection);

      // Update props if single selection
      if (newSelection.size === 1) {
        const mesh = Array.from(newSelection)[0];
        setMeshProps({
          position: {
            x: mesh.position.x,
            y: mesh.position.y,
            z: mesh.position.z,
          },
          rotation: {
            x: mesh.rotation.x,
            y: mesh.rotation.y,
            z: mesh.rotation.z,
          },
          scale: {
            x: mesh.scale.x,
            y: mesh.scale.y,
            z: mesh.scale.z,
          },
          materialType: mesh.userData.materialType ?? 0,
          color: `#${
            (
              mesh.material as THREE.MeshStandardMaterial
            ).color?.getHexString() ?? "ffffff"
          }`,
          lightIntensity: mesh.userData.lightIntensity ?? 0,
        });
      } else {
        setMeshProps(null);
      }

      setSelectionBox(null);
    }
  };

  const handleCanvasClick = (event: React.MouseEvent) => {
    // Click handling is now mostly done in pointerDown/Up for selection
    // We keep this to prevent event propagation if needed
  };

  const updateMesh = (
    type:
      | "position"
      | "rotation"
      | "scale"
      | "materialType"
      | "color"
      | "lightIntensity",
    axis: "x" | "y" | "z" | null,
    value: number | string,
  ) => {
    setMeshProps((prev) => {
      if (!prev) {
        return null;
      }
      if (type === "materialType") {
        return { ...prev, materialType: value as number };
      }
      if (type === "color") {
        return { ...prev, color: value as string };
      }
      if (type === "lightIntensity") {
        return { ...prev, lightIntensity: value as number };
      }
      if (axis) {
        return {
          ...prev,
          [type]: {
            ...prev[type as "position" | "rotation" | "scale"],
            [axis]: value,
          },
        };
      }
      return prev;
    });
  };

  const handleDelete = () => {
    if (selectedMeshes.size === 0) {
      return;
    }

    const elementsToDelete: string[] = [];

    selectedMeshes.forEach((mesh) => {
      if (mesh.userData.isUserShape) {
        // User shape
        if (sceneRef.current) {
          sceneRef.current.remove(mesh);
        }
        // Remove from userShapesRef
        const index = userShapesRef.current.indexOf(mesh);
        if (index > -1) {
          userShapesRef.current.splice(index, 1);
        }
      } else if (mesh.userData.id) {
        // Excalidraw element
        elementsToDelete.push(mesh.userData.id);
      }
    });

    if (elementsToDelete.length > 0) {
      const selectedElementIds = elementsToDelete.reduce((acc, id) => {
        acc[id] = true;
        return acc;
      }, {} as Record<string, true>);

      app.setAppState({ selectedElementIds }, () => {
        app.actionManager.executeAction(actionDeleteSelected);
      });
    }

    // Clear selection
    setSelectedMeshes(new Set());
    setMeshProps(null);
  };

  const handleReset = () => {
    // Remove all user shapes from scene
    userShapesRef.current.forEach((mesh) => {
      if (sceneRef.current) {
        sceneRef.current.remove(mesh);
      }
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    });
    userShapesRef.current = [];

    // Clear selection
    setSelectedMeshes(new Set());
    setMeshProps(null);
  };

  const handleApplyChanges = () => {
    if (selectedMeshes.size === 1 && meshProps) {
      const mesh = Array.from(selectedMeshes)[0];
      mesh.userData.isModified = true;
      mesh.position.set(
        meshProps.position.x,
        meshProps.position.y,
        meshProps.position.z,
      );
      mesh.rotation.set(
        meshProps.rotation.x,
        meshProps.rotation.y,
        meshProps.rotation.z,
      );
      mesh.scale.set(meshProps.scale.x, meshProps.scale.y, meshProps.scale.z);

      // Update Material
      if (
        mesh.userData.materialType !== meshProps.materialType ||
        (mesh.material as THREE.MeshStandardMaterial).color.getHexString() !==
          meshProps.color.substring(1)
      ) {
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose();
        }
        mesh.material = createMaterial(meshProps.materialType, meshProps.color);
        mesh.userData.materialType = meshProps.materialType;

        // Re-apply light intensity to new material
        if (
          mesh.material instanceof THREE.MeshStandardMaterial ||
          mesh.material instanceof THREE.MeshPhysicalMaterial
        ) {
          mesh.material.emissive = new THREE.Color(meshProps.color);
          mesh.material.emissiveIntensity = meshProps.lightIntensity;
        }
      }
    }
  };

  useEffect(() => {
    if (selectedMeshes.size === 1 && meshProps) {
      const mesh = Array.from(selectedMeshes)[0];
      const intensity = meshProps.lightIntensity;
      const color = new THREE.Color(meshProps.color);

      // Update material emissive properties
      if (
        mesh.material instanceof THREE.MeshStandardMaterial ||
        mesh.material instanceof THREE.MeshPhysicalMaterial
      ) {
        mesh.material.emissive = color;
        mesh.material.emissiveIntensity = intensity;
      }

      // Update or create PointLight child
      let light = mesh.children.find(
        (child) => child instanceof THREE.PointLight,
      ) as THREE.PointLight | undefined;

      if (intensity > 0) {
        if (!light) {
          // Use decay 1 (linear) instead of 2 (physical) to make light reach further at this scale
          // Increase distance to 2000
          light = new THREE.PointLight(color, intensity, 2000, 1);
          mesh.add(light);
        } else {
          light.color = color;
          light.intensity = intensity;
          light.distance = 2000;
          light.decay = 1;
        }
      } else if (light) {
        mesh.remove(light);
      }

      mesh.userData.lightIntensity = intensity;
    }
  }, [meshProps?.lightIntensity, meshProps?.color, selectedMeshes, meshProps]);

  useEffect(() => {
    // Update BoxHelpers
    if (sceneRef.current) {
      // Remove old helpers
      boxHelpersRef.current.forEach((helper) => {
        sceneRef.current?.remove(helper);
      });
      boxHelpersRef.current.clear();

      // Add new helpers
      selectedMeshes.forEach((mesh) => {
        const boxHelper = new THREE.BoxHelper(mesh, 0xffff00);
        sceneRef.current?.add(boxHelper);
        boxHelpersRef.current.set(mesh, boxHelper);
      });
    }

    // Handle TransformControls (only for single selection for now)
    if (transformControlsRef.current) {
      if (selectedMeshes.size === 1) {
        const mesh = Array.from(selectedMeshes)[0];
        transformControlsRef.current.attach(mesh);
      } else {
        transformControlsRef.current.detach();
      }
    }
  }, [selectedMeshes]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;

    // Initialize Scene
    const scene = new THREE.Scene();

    // Create vibrant modern background
    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = 512;
    bgCanvas.height = 512;
    const ctx = bgCanvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 512, 512);
      gradient.addColorStop(0, "#4158D0");
      gradient.addColorStop(0.46, "#C850C0");
      gradient.addColorStop(1, "#FFCC70");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 512);
    }
    scene.background = new THREE.CanvasTexture(bgCanvas);
    bgTextureRef.current = scene.background as THREE.CanvasTexture;
    sceneRef.current = scene;

    // Initialize Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      10000,
    );
    camera.position.set(0, -500, 1000);
    camera.lookAt(0, 0, 0);
    scene.add(camera);
    cameraRef.current = camera;

    // Initialize Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Initialize Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    // Set initial mouse buttons based on mode (default pointer)
    controls.mouseButtons.LEFT = null as any;
    controls.touches.ONE = null as any;
    controlsRef.current = controls;

    // Initialize TransformControls
    const transformControls = new TransformControls(
      camera,
      renderer.domElement,
    );
    transformControls.addEventListener("dragging-changed", (event) => {
      controls.enabled = !event.value;
    });
    transformControls.addEventListener("change", () => {
      if (transformControls.object) {
        const mesh = transformControls.object as THREE.Mesh;
        mesh.userData.isModified = true;

        // Only update props if it's the single selected mesh
        if (selectedMeshes.size === 1 && selectedMeshes.has(mesh)) {
          setMeshProps({
            position: {
              x: mesh.position.x,
              y: mesh.position.y,
              z: mesh.position.z,
            },
            rotation: {
              x: mesh.rotation.x,
              y: mesh.rotation.y,
              z: mesh.rotation.z,
            },
            scale: {
              x: mesh.scale.x,
              y: mesh.scale.y,
              z: mesh.scale.z,
            },
            materialType: mesh.userData.materialType ?? 0,
            color: `#${
              (
                mesh.material as THREE.MeshStandardMaterial
              ).color?.getHexString() ?? "ffffff"
            }`,
            lightIntensity: mesh.userData.lightIntensity ?? 0,
          });
        }
      }
    });
    scene.add(transformControls as unknown as THREE.Object3D);
    transformControlsRef.current = transformControls;

    // Add Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    ambientLight.name = "ambientLight";
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.name = "directionalLight";
    directionalLight.position.set(100, 100, 100);
    scene.add(directionalLight);

    // Create Whiteboard Plane
    // We use the static canvas from the app to create a texture
    const canvas = app.canvas;
    if (canvas) {
      const texture = new THREE.CanvasTexture(canvas);
      // Fix texture orientation/flipping if needed, usually CanvasTexture is fine

      // Calculate aspect ratio for the plane
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      const geometry = new THREE.PlaneGeometry(width, height);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        opacity: 0.3, // Make it semi-transparent so we can see 3D objects better
      });
      const plane = new THREE.Mesh(geometry, material);
      // Rotate to be flat on the ground (if we consider Z up) or facing camera
      // Let's keep it facing Z for now, matching 2D view
      scene.add(plane);
    }

    // Create a group for Excalidraw elements
    const elementsGroup = new THREE.Group();
    scene.add(elementsGroup);
    elementsGroupRef.current = elementsGroup;

    // Animation Loop
    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Update all box helpers
      boxHelpersRef.current.forEach((helper) => {
        helper.update();
      });

      // Rotate all shapes for effect
      // shapesRef.current.forEach((shape) => {
      //   shape.rotation.x += 0.01;
      //   shape.rotation.y += 0.01;
      // });

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Handle Resize
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      window.removeEventListener("resize", handleResize);
      if (rendererRef.current && container) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      if (transformControlsRef.current) {
        transformControlsRef.current.dispose();
      }
      if (sceneRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        boxHelpersRef.current.forEach((helper) => {
          sceneRef.current?.remove(helper);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
        boxHelpersRef.current.clear();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app]);

  useEffect(() => {
    if (sceneRef.current) {
      // Update Ambient Light
      const ambientLight = sceneRef.current.getObjectByName(
        "ambientLight",
      ) as THREE.AmbientLight;
      if (ambientLight) {
        ambientLight.intensity = ambientLightIntensity;
      }

      // Update Directional Light
      const directionalLight = sceneRef.current.getObjectByName(
        "directionalLight",
      ) as THREE.DirectionalLight;
      if (directionalLight) {
        // Scale directional light with ambient intensity (base 0.8)
        // If ambient is 0, directional should be 0
        // If ambient is 0.6 (default), directional is 0.8
        // Ratio approx 1.33
        directionalLight.intensity = ambientLightIntensity * 1.33;
      }

      // Update Background
      if (bgTextureRef.current) {
        const canvas = bgTextureRef.current.image as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Redraw gradient
          const gradient = ctx.createLinearGradient(0, 0, 512, 512);
          gradient.addColorStop(0, "#4158D0");
          gradient.addColorStop(0.46, "#C850C0");
          gradient.addColorStop(1, "#FFCC70");
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 512, 512);

          // Apply dimmer overlay
          // Map intensity 0-1 to opacity 1-0. Intensity > 1 keeps opacity 0.
          const opacity = Math.max(0, 1 - ambientLightIntensity);
          if (opacity > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
            ctx.fillRect(0, 0, 512, 512);
          }
        }
        bgTextureRef.current.needsUpdate = true;
      }
    }
  }, [ambientLightIntensity]);

  useEffect(() => {
    if (!sceneRef.current || !cameraRef.current) {
      return;
    }

    // Toggle visibility of user shapes
    userShapesRef.current.forEach((mesh) => {
      mesh.visible = !isLiquidMode;
    });

    // Manage Liquid Mesh
    if (isLiquidMode) {
      if (!liquidMeshRef.current) {
        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.ShaderMaterial({
          vertexShader: liquidVertexShader,
          fragmentShader: liquidFragmentShader,
          uniforms: {
            uCamPos: { value: new THREE.Vector3() },
            uCamInverseProj: { value: new THREE.Matrix4() },
            uCamInverseView: { value: new THREE.Matrix4() },
            uResolution: {
              value: new THREE.Vector2(window.innerWidth, window.innerHeight),
            },
            uShapes: { value: [] },
            uCount: { value: 0 },
            uAmbientLight: { value: ambientLightIntensity },
          },
          transparent: true,
          depthWrite: false, // Don't write depth so we can see other things? Or true?
          // If we want it to be "in scene", we need depth. But full screen quad is always at z=-1.
          // We'll just render it on top for now.
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        // Add to camera so it's always in front
        cameraRef.current.add(mesh);
        liquidMeshRef.current = mesh;
      }

      // Update Uniforms
      const material = liquidMeshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uCamPos.value.copy(cameraRef.current.position);
      material.uniforms.uCamInverseProj.value
        .copy(cameraRef.current.projectionMatrix)
        .invert();
      material.uniforms.uCamInverseView.value.copy(
        cameraRef.current.matrixWorld,
      );
      material.uniforms.uAmbientLight.value = ambientLightIntensity;

      const shapesData = userShapesRef.current.map((mesh) => {
        const color = (mesh.material as THREE.MeshStandardMaterial).color;
        let type = 0;
        const geo = mesh.geometry;
        const size = new THREE.Vector3(100, 100, 100);

        if (geo instanceof THREE.BoxGeometry) {
          type = 0;
          size.set(100 * mesh.scale.x, 100 * mesh.scale.y, 100 * mesh.scale.z);
        } else if (geo instanceof THREE.SphereGeometry) {
          type = 1;
          size.set(70 * mesh.scale.x, 0, 0);
        } else if (geo instanceof THREE.CylinderGeometry) {
          type = 2;
          size.set(50 * mesh.scale.x, 100 * mesh.scale.y, 0);
        } else if (geo instanceof THREE.ConeGeometry) {
          type = 3;
          size.set(50 * mesh.scale.x, 100 * mesh.scale.y, 0);
        } else if (geo instanceof THREE.TorusGeometry) {
          type = 4;
          size.set(40 * mesh.scale.x, 15 * mesh.scale.y, 0);
        } else if (geo instanceof THREE.IcosahedronGeometry) {
          type = 5;
          size.set(60 * mesh.scale.x, 0, 0);
        }

        return {
          type,
          pos: mesh.position,
          rot: new THREE.Vector3(
            mesh.rotation.x,
            mesh.rotation.y,
            mesh.rotation.z,
          ),
          size,
          color: new THREE.Vector3(color.r, color.g, color.b),
          intensity: mesh.userData.lightIntensity || 0,
        };
      });

      // Pad array to 20
      while (shapesData.length < 20) {
        shapesData.push({
          type: 0,
          pos: new THREE.Vector3(),
          rot: new THREE.Vector3(),
          size: new THREE.Vector3(),
          color: new THREE.Vector3(),
          intensity: 0,
        });
      }

      material.uniforms.uShapes.value = shapesData;
      material.uniforms.uCount.value = userShapesRef.current.length;
    } else if (liquidMeshRef.current) {
      cameraRef.current.remove(liquidMeshRef.current);
      liquidMeshRef.current.geometry.dispose();
      (liquidMeshRef.current.material as THREE.Material).dispose();
      liquidMeshRef.current = null;
    }
  }, [
    isLiquidMode,
    ambientLightIntensity,
    selectedMeshes,
    meshProps,
    liquidVertexShader,
    liquidFragmentShader,
  ]); // Update when selection changes (drag)

  // Need a loop to update uniforms during drag
  useEffect(() => {
    if (isLiquidMode && liquidMeshRef.current && cameraRef.current) {
      const animate = () => {
        if (!isLiquidMode || !liquidMeshRef.current) {
          return;
        }

        const material = liquidMeshRef.current.material as THREE.ShaderMaterial;
        material.uniforms.uCamPos.value.copy(cameraRef.current!.position);
        material.uniforms.uCamInverseProj.value
          .copy(cameraRef.current!.projectionMatrix)
          .invert();
        material.uniforms.uCamInverseView.value.copy(
          cameraRef.current!.matrixWorld,
        );

        // Update shapes positions (they might be dragging)
        const shapesData = userShapesRef.current.map((mesh) => {
          const color = (mesh.material as THREE.MeshStandardMaterial).color;
          let type = 0;
          const size = new THREE.Vector3(100, 100, 100);

          if (mesh.geometry instanceof THREE.BoxGeometry) {
            type = 0;
            size.set(
              100 * mesh.scale.x,
              100 * mesh.scale.y,
              100 * mesh.scale.z,
            );
          } else if (mesh.geometry instanceof THREE.SphereGeometry) {
            type = 1;
            size.set(70 * mesh.scale.x, 0, 0);
          } else if (mesh.geometry instanceof THREE.CylinderGeometry) {
            type = 2;
            size.set(50 * mesh.scale.x, 100 * mesh.scale.y, 0);
          } else if (mesh.geometry instanceof THREE.ConeGeometry) {
            type = 3;
            size.set(50 * mesh.scale.x, 100 * mesh.scale.y, 0);
          } else if (mesh.geometry instanceof THREE.TorusGeometry) {
            type = 4;
            size.set(40 * mesh.scale.x, 15 * mesh.scale.y, 0);
          } else if (mesh.geometry instanceof THREE.IcosahedronGeometry) {
            type = 5;
            size.set(60 * mesh.scale.x, 0, 0);
          }

          return {
            type,
            pos: mesh.position,
            rot: new THREE.Vector3(
              mesh.rotation.x,
              mesh.rotation.y,
              mesh.rotation.z,
            ),
            size,
            color: new THREE.Vector3(color.r, color.g, color.b),
            intensity: mesh.userData.lightIntensity || 0,
          };
        });

        while (shapesData.length < 20) {
          shapesData.push({
            type: 0,
            pos: new THREE.Vector3(),
            rot: new THREE.Vector3(),
            size: new THREE.Vector3(),
            color: new THREE.Vector3(),
            intensity: 0,
          });
        }

        material.uniforms.uShapes.value = shapesData;
        material.uniforms.uCount.value = userShapesRef.current.length;

        requestAnimationFrame(animate);
      };
      animate();
    }
  }, [isLiquidMode]);

  useEffect(() => {
    if (controlsRef.current) {
      if (interactionMode === "camera") {
        controlsRef.current.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
        controlsRef.current.touches.ONE = THREE.TOUCH.ROTATE;
      } else {
        controlsRef.current.mouseButtons.LEFT = null as any;
        controlsRef.current.touches.ONE = null as any;
      }
      controlsRef.current.update();
    }
  }, [interactionMode]);

  useEffect(() => {
    if (!elementsGroupRef.current) {
      return;
    }

    const currentIds = new Set<string>();

    // Render elements
    elements.forEach((element) => {
      if (element.isDeleted) {
        return;
      }

      currentIds.add(element.id);

      let mesh = meshesMapRef.current.get(element.id);
      let geometry;
      let material;

      const color =
        element.backgroundColor !== "transparent"
          ? element.backgroundColor
          : element.strokeColor;
      const threeColor = new THREE.Color(color);

      // Determine geometry based on type
      if (element.type === "rectangle" || element.type === "diamond") {
        geometry = new THREE.BoxGeometry(element.width, element.height, 20);
      } else if (element.type === "ellipse") {
        geometry = new THREE.CylinderGeometry(
          element.width / 2,
          element.width / 2,
          20,
          32,
        );
        if (geometry) {
          geometry.rotateX(Math.PI / 2);
        }
      }

      if (geometry) {
        material = new THREE.MeshStandardMaterial({ color: threeColor });

        if (!mesh) {
          // Create new mesh
          mesh = new THREE.Mesh(geometry, material);
          mesh.userData = {
            id: element.id,
            isModified: false,
            materialType: 0,
            lightIntensity: 0,
          };
          elementsGroupRef.current?.add(mesh);
          meshesMapRef.current.set(element.id, mesh);
        } else {
          // Update existing mesh geometry/material
          mesh.geometry.dispose();
          mesh.geometry = geometry;
          if (mesh.material instanceof THREE.Material) {
            mesh.material.dispose();
          }
          mesh.material = material;
        }

        // Update position/rotation only if not modified by user in 3D
        if (!mesh.userData.isModified) {
          const centerX = element.x + element.width / 2;
          const centerY = element.y + element.height / 2;

          const canvas = app.canvas;
          const offsetX = canvas
            ? canvas.width / window.devicePixelRatio / 2
            : 0;
          const offsetY = canvas
            ? canvas.height / window.devicePixelRatio / 2
            : 0;

          mesh.position.set(centerX - offsetX, -(centerY - offsetY), 10);

          mesh.rotation.set(0, 0, -element.angle);

          if (element.type === "diamond") {
            mesh.rotation.z -= Math.PI / 4;
            const scale = Math.sqrt(2);
            mesh.scale.set(1 / scale, 1 / scale, 1);
          } else {
            mesh.scale.set(1, 1, 1);
          }
        }
      }
    });

    // Remove deleted elements
    meshesMapRef.current.forEach((mesh, id) => {
      if (!currentIds.has(id)) {
        if (mesh.parent) {
          mesh.parent.remove(mesh);
        }
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose();
        }
        meshesMapRef.current.delete(id);
      }
    });
  }, [elements, app.canvas]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={handleCanvasClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 1000,
        background:
          "linear-gradient(135deg, #4158D0 0%, #C850C0 46%, #FFCC70 100%)",
      }}
    >
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <button
          className="ToolIcon_type_button ToolIcon_size_medium"
          onClick={() => addShape("cube")}
          style={{
            padding: "10px",
            background: "var(--color-surface-low)",
            border: "1px solid var(--color-gray-40)",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Add Cube
        </button>
        <button
          className="ToolIcon_type_button ToolIcon_size_medium"
          onClick={() => addShape("sphere")}
          style={{
            padding: "10px",
            background: "var(--color-surface-low)",
            border: "1px solid var(--color-gray-40)",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Add Sphere
        </button>
        <button
          className="ToolIcon_type_button ToolIcon_size_medium"
          onClick={() => addShape("cylinder")}
          style={{
            padding: "10px",
            background: "var(--color-surface-low)",
            border: "1px solid var(--color-gray-40)",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Add Cylinder
        </button>
        <button
          className="ToolIcon_type_button ToolIcon_size_medium"
          onClick={() => addShape("cone")}
          style={{
            padding: "10px",
            background: "var(--color-surface-low)",
            border: "1px solid var(--color-gray-40)",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Add Cone
        </button>
        <button
          className="ToolIcon_type_button ToolIcon_size_medium"
          onClick={() => addShape("torus")}
          style={{
            padding: "10px",
            background: "var(--color-surface-low)",
            border: "1px solid var(--color-gray-40)",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Add Torus
        </button>
        <button
          className="ToolIcon_type_button ToolIcon_size_medium"
          onClick={() => addShape("icosahedron")}
          style={{
            padding: "10px",
            background: "var(--color-surface-low)",
            border: "1px solid var(--color-gray-40)",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Add Icosahedron
        </button>
        <button
          className="ToolIcon_type_button ToolIcon_size_medium"
          onClick={handleReset}
          style={{
            padding: "10px",
            background: "var(--color-danger)",
            color: "white",
            border: "1px solid var(--color-gray-40)",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Reset Board
        </button>
        <div
          style={{
            padding: "10px",
            background: "var(--color-surface-low)",
            border: "1px solid var(--color-gray-40)",
            borderRadius: "4px",
          }}
        >
          <strong
            style={{ display: "block", marginBottom: "5px", fontSize: "12px" }}
          >
            Ambient Light: {ambientLightIntensity}
          </strong>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={ambientLightIntensity}
            onChange={(e) =>
              setAmbientLightIntensity(parseFloat(e.target.value))
            }
            style={{ width: "100%" }}
          />
        </div>
        <div
          style={{
            padding: "10px",
            background: "var(--color-surface-low)",
            border: "1px solid var(--color-gray-40)",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <input
            type="checkbox"
            id="liquidMode"
            checked={isLiquidMode}
            onChange={(e) => setIsLiquidMode(e.target.checked)}
          />
          <label
            htmlFor="liquidMode"
            style={{ fontSize: "12px", cursor: "pointer" }}
          >
            Liquid Physics
          </label>
        </div>
      </div>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          zIndex: 1001,
          display: "flex",
          gap: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            background: "var(--color-surface-low)",
            border: "1px solid var(--color-gray-40)",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setInteractionMode("pointer")}
            style={{
              padding: "10px",
              background:
                interactionMode === "pointer"
                  ? "var(--color-primary-light)"
                  : "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--icon-fill-color)",
            }}
            title="Select & Move"
          >
            {PointerIcon}
          </button>
          <button
            onClick={() => setInteractionMode("camera")}
            style={{
              padding: "10px",
              background:
                interactionMode === "camera"
                  ? "var(--color-primary-light)"
                  : "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--icon-fill-color)",
            }}
            title="Rotate Camera"
          >
            {CameraIcon}
          </button>
        </div>
        <button
          className="ToolIcon_type_button ToolIcon_size_medium"
          onClick={() =>
            app.actionManager.executeAction(actionToggleThreeDMode)
          }
          style={{
            padding: "10px",
            background: "var(--color-surface-low)",
            border: "1px solid var(--color-gray-40)",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          {t("buttons.exitThreeDMode")}
        </button>
      </div>
      {selectedMeshes.size === 1 && meshProps && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 80,
            right: 20,
            width: 200,
            background: "rgba(255, 255, 255, 0.9)",
            padding: "15px",
            borderRadius: "8px",
            zIndex: 1001,
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>Properties</h3>
          <div style={{ marginBottom: "10px" }}>
            <strong style={{ display: "block", marginBottom: "5px" }}>
              Material
            </strong>
            <select
              value={meshProps.materialType}
              onChange={(e) =>
                updateMesh("materialType", null, parseInt(e.target.value))
              }
              style={{ width: "100%", padding: "5px" }}
            >
              {MATERIAL_TYPES.map((name, index) => (
                <option key={index} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <strong style={{ display: "block", marginBottom: "5px" }}>
              Color
            </strong>
            <input
              type="color"
              value={meshProps.color}
              onChange={(e) => updateMesh("color", null, e.target.value)}
              style={{ width: "100%", height: "30px" }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <strong style={{ display: "block", marginBottom: "5px" }}>
              Light Intensity: {meshProps.lightIntensity}
            </strong>
            <input
              type="range"
              min="0"
              max="50"
              step="0.5"
              value={meshProps.lightIntensity}
              onChange={(e) =>
                updateMesh("lightIntensity", null, parseFloat(e.target.value))
              }
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <strong style={{ display: "block", marginBottom: "5px" }}>
              Scale
            </strong>
            <div
              style={{ display: "flex", gap: "5px", flexDirection: "column" }}
            >
              <label>
                X:{" "}
                <input
                  type="number"
                  step="0.1"
                  value={meshProps.scale.x}
                  onChange={(e) =>
                    updateMesh("scale", "x", parseFloat(e.target.value))
                  }
                  style={{ width: "60px" }}
                />
              </label>
              <label>
                Y:{" "}
                <input
                  type="number"
                  step="0.1"
                  value={meshProps.scale.y}
                  onChange={(e) =>
                    updateMesh("scale", "y", parseFloat(e.target.value))
                  }
                  style={{ width: "60px" }}
                />
              </label>
              <label>
                Z:{" "}
                <input
                  type="number"
                  step="0.1"
                  value={meshProps.scale.z}
                  onChange={(e) =>
                    updateMesh("scale", "z", parseFloat(e.target.value))
                  }
                  style={{ width: "60px" }}
                />
              </label>
            </div>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <strong style={{ display: "block", marginBottom: "5px" }}>
              Position
            </strong>
            <div
              style={{ display: "flex", gap: "5px", flexDirection: "column" }}
            >
              <label>
                X:{" "}
                <input
                  type="number"
                  value={meshProps.position.x}
                  onChange={(e) =>
                    updateMesh("position", "x", parseFloat(e.target.value))
                  }
                  style={{ width: "60px" }}
                />
              </label>
              <label>
                Y:{" "}
                <input
                  type="number"
                  value={meshProps.position.y}
                  onChange={(e) =>
                    updateMesh("position", "y", parseFloat(e.target.value))
                  }
                  style={{ width: "60px" }}
                />
              </label>
              <label>
                Z:{" "}
                <input
                  type="number"
                  value={meshProps.position.z}
                  onChange={(e) =>
                    updateMesh("position", "z", parseFloat(e.target.value))
                  }
                  style={{ width: "60px" }}
                />
              </label>
            </div>
          </div>
          <div>
            <strong style={{ display: "block", marginBottom: "5px" }}>
              Rotation
            </strong>
            <div
              style={{ display: "flex", gap: "5px", flexDirection: "column" }}
            >
              <label>
                X:{" "}
                <input
                  type="number"
                  step="0.1"
                  value={meshProps.rotation.x}
                  onChange={(e) =>
                    updateMesh("rotation", "x", parseFloat(e.target.value))
                  }
                  style={{ width: "60px" }}
                />
              </label>
              <label>
                Y:{" "}
                <input
                  type="number"
                  step="0.1"
                  value={meshProps.rotation.y}
                  onChange={(e) =>
                    updateMesh("rotation", "y", parseFloat(e.target.value))
                  }
                  style={{ width: "60px" }}
                />
              </label>
              <label>
                Z:{" "}
                <input
                  type="number"
                  step="0.1"
                  value={meshProps.rotation.z}
                  onChange={(e) =>
                    updateMesh("rotation", "z", parseFloat(e.target.value))
                  }
                  style={{ width: "60px" }}
                />
              </label>
            </div>
          </div>
          <div
            style={{
              marginTop: "10px",
              textAlign: "right",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <button
              onClick={handleDelete}
              style={{
                padding: "5px 10px",
                background: "var(--color-danger)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Delete
            </button>
            <button
              onClick={handleApplyChanges}
              style={{
                padding: "5px 10px",
                background: "var(--color-primary)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Update
            </button>
          </div>
        </div>
      )}
      {selectionBox && selectionBox.visible && (
        <div
          style={{
            position: "fixed",
            left: Math.min(selectionBox.start.x, selectionBox.current.x),
            top: Math.min(selectionBox.start.y, selectionBox.current.y),
            width: Math.abs(selectionBox.current.x - selectionBox.start.x),
            height: Math.abs(selectionBox.current.y - selectionBox.start.y),
            border: "1px solid white",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            pointerEvents: "none",
            zIndex: 2000,
          }}
        />
      )}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          zIndex: 1001,
          background: "rgba(255,255,255,0.8)",
          padding: "10px",
          borderRadius: "4px",
        }}
      >
        <p>3D Mode: Left Click to Select, Right Click to Pan, Scroll to Zoom</p>
      </div>
    </div>
  );
};
