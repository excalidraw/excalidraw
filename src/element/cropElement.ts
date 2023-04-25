import { Point } from "points-on-curve";
import { centerPoint, rotatePoint } from "../math";
import { updateBoundElements } from "./binding";
import { mutateElement } from "./mutateElement";
import { MaybeTransformHandleType, TransformHandleType } from "./transformHandles";
import { ExcalidrawElement, ExcalidrawImageElement, NonDeleted } from "./types";
import { getResizedElementAbsoluteCoords } from "./bounds";


export function cropElement(    
	element: ExcalidrawImageElement,
	transformHandle: TransformHandleType,
	stateAtCropStart: NonDeleted<ExcalidrawElement>,
	pointerX: number,
	pointerY: number
) {
	const maxWidth = element.widthAtCreation * element.rescaleX;
	const maxHeight = element.heightAtCreation * element.rescaleY;
	const eastCropAmount = element.rightSideCropAmount * element.rescaleX;
	const westCropAmount = element.leftSideCropAmount * element.rescaleX;
	const northCropAmount = element.topCropAmount * element.rescaleY;
	const southCropAmount = element.bottomCropAmount * element.rescaleY;

	const availableSpaceToCropNorth = (maxHeight - southCropAmount) - stateAtCropStart.height;
	const availableSpaceToCropWest = (maxWidth - eastCropAmount) - stateAtCropStart.width;

	const rotatedPointer = rotatePoint(
		[pointerX, pointerY], 
		[stateAtCropStart.x + (stateAtCropStart.width / 2), stateAtCropStart.y + (stateAtCropStart.height / 2)], 
		-stateAtCropStart.angle
	);

	pointerX = rotatedPointer[0];
	pointerY = rotatedPointer[1];

	let mutatedX = element.x;
	let mutatedY = element.y;
	let mutatedWidth = element.width;
	let mutatedHeight = element.height;
	let xToPullFromImage = element.xToPullFromImage;
	let yToPullFromImage = element.yToPullFromImage;
	let wToPullFromImage = element.wToPullFromImage;
	let hToPullFromImage = element.hToPullFromImage;

	if (transformHandle == 'n') {
		const northBound = stateAtCropStart.y - availableSpaceToCropNorth;
		const southBound = stateAtCropStart.y + stateAtCropStart.height;

		pointerY = clamp(pointerY, northBound, southBound);

		const verticalMouseMovement = pointerY - stateAtCropStart.y;
		const newHeight = stateAtCropStart.height - verticalMouseMovement;
		const portionOfTopSideCropped = (verticalMouseMovement + northCropAmount) / maxHeight;
		const newOrigin = recomputeOrigin(stateAtCropStart, transformHandle, element.width, newHeight);

		mutateElement(element, {
			x: newOrigin[0],
			y: newOrigin[1],
			height: newHeight,
			yToPullFromImage: portionOfTopSideCropped * element.underlyingImageHeight,
			hToPullFromImage: (newHeight / maxHeight) * element.underlyingImageHeight
		})
	} else if (transformHandle == 's') {
		const northBound = stateAtCropStart.y;
		const southBound = stateAtCropStart.y + (maxHeight - northCropAmount);

		pointerY = clamp(pointerY, northBound, southBound);

		const newHeight = pointerY - stateAtCropStart.y;
		const newOrigin = recomputeOrigin(stateAtCropStart, transformHandle, element.width, newHeight);

		mutateElement(element, {
			x: newOrigin[0],
			y: newOrigin[1],
			height: newHeight,
			hToPullFromImage: (newHeight / maxHeight) * element.underlyingImageHeight
		})
	} else if (transformHandle == 'w') {
		const eastBound = stateAtCropStart.x + stateAtCropStart.width;
		const westBound = stateAtCropStart.x - availableSpaceToCropWest;

		pointerX = clamp(pointerX, westBound, eastBound);
	
		const horizontalMouseMovement = pointerX - stateAtCropStart.x;
		const newWidth = stateAtCropStart.width - horizontalMouseMovement;
		const portionOfLeftSideCropped = (horizontalMouseMovement + westCropAmount) / maxWidth;
		const newOrigin = recomputeOrigin(stateAtCropStart, transformHandle, newWidth, element.height);

		mutateElement(element, {
			x: newOrigin[0],
			y: newOrigin[1],
			width: newWidth,
			xToPullFromImage: portionOfLeftSideCropped * element.underlyingImageWidth,
			wToPullFromImage: (newWidth / maxWidth) * element.underlyingImageWidth
		})
	} else if (transformHandle == 'e') {
		const eastBound = stateAtCropStart.x + (maxWidth - westCropAmount);
		const westBound = stateAtCropStart.x;

		pointerX = clamp(pointerX, westBound, eastBound);

		const newWidth = pointerX - stateAtCropStart.x;
		const newOrigin = recomputeOrigin(stateAtCropStart, transformHandle, newWidth, element.height);

		mutateElement(element, {
			x: newOrigin[0],
			y: newOrigin[1],
			width: newWidth,
			wToPullFromImage: (newWidth / maxWidth) * element.underlyingImageWidth
		})
	}

	// resize does this, but i don't know what it does, so i'm leaving it out for now
	// updateBoundElements(element, {
	// 	newSize: { width: element.width, height: element.height },
	// });

	return;
}

function recomputeOrigin(
	stateAtCropStart: NonDeleted<ExcalidrawElement>,
	transformHandle: TransformHandleType,
	width: number,
	height: number
) {
	const [x1, y1, x2, y2] = getResizedElementAbsoluteCoords(
		stateAtCropStart,
		stateAtCropStart.width,
		stateAtCropStart.height,
		true,
	);
	const startTopLeft: Point = [x1, y1];
	const startBottomRight: Point = [x2, y2];
	const startCenter: any = centerPoint(startTopLeft, startBottomRight);

	const [newBoundsX1, newBoundsY1, newBoundsX2, newBoundsY2] =
	getResizedElementAbsoluteCoords(
		stateAtCropStart,
		width,
		height,
		true,
	);
	const newBoundsWidth = newBoundsX2 - newBoundsX1;
	const newBoundsHeight = newBoundsY2 - newBoundsY1;

	// Calculate new topLeft based on fixed corner during resize
	let newTopLeft = [...startTopLeft] as [number, number];

	if (["n", "w", "nw"].includes(transformHandle)) {
		newTopLeft = [
			startBottomRight[0] - Math.abs(newBoundsWidth),
			startBottomRight[1] - Math.abs(newBoundsHeight),
		];
	}
	if (transformHandle === "ne") {
		const bottomLeft = [startTopLeft[0], startBottomRight[1]];
		newTopLeft = [bottomLeft[0], bottomLeft[1] - Math.abs(newBoundsHeight)];
	}
	if (transformHandle === "sw") {
		const topRight = [startBottomRight[0], startTopLeft[1]];
		newTopLeft = [topRight[0] - Math.abs(newBoundsWidth), topRight[1]];
	}

	// adjust topLeft to new rotation point
	const angle = stateAtCropStart.angle;
	const rotatedTopLeft = rotatePoint(newTopLeft, startCenter, angle);
	const newCenter: Point = [
		newTopLeft[0] + Math.abs(newBoundsWidth) / 2,
		newTopLeft[1] + Math.abs(newBoundsHeight) / 2,
	];
	const rotatedNewCenter = rotatePoint(newCenter, startCenter, angle);
	newTopLeft = rotatePoint(rotatedTopLeft, rotatedNewCenter, -angle);

	const newOrigin = [...newTopLeft];
	newOrigin[0] += stateAtCropStart.x - newBoundsX1;
	newOrigin[1] += stateAtCropStart.y - newBoundsY1;

	return newOrigin;
}

function clamp(numberToClamp: number, minBound: number, maxBound: number) {
	if (numberToClamp < minBound) {
		return minBound;
	}

	if (numberToClamp > maxBound) {
		return maxBound;
	}

	return numberToClamp;
}


export function onElementCropped(
	element: ExcalidrawImageElement,
	handleType: TransformHandleType,
	stateAtCropStart: NonDeleted<ExcalidrawElement>
) {
	let unscaledWidth = element.width / element.rescaleX;
	let unscaledHeight = element.height / element.rescaleY;

	if (handleType == 'n') {
		let topSideCropAmount = element.heightAtCreation - unscaledHeight - element.bottomCropAmount;
		mutateElement(element, {
			topCropAmount: topSideCropAmount
		})
	} else if (handleType == 's') {
		let bottomSideCropAmount = element.heightAtCreation - unscaledHeight - element.topCropAmount;
		mutateElement(element, {
			bottomCropAmount: bottomSideCropAmount
		})
	} else if (handleType == 'w') {
		let leftSideCropAmount = element.widthAtCreation - unscaledWidth - element.rightSideCropAmount;
		mutateElement(element, {
			leftSideCropAmount: leftSideCropAmount
		})
	} else if (handleType == 'e') {
		let rightSideCropAmount = element.widthAtCreation - unscaledWidth - element.leftSideCropAmount;
		mutateElement(element, {
			rightSideCropAmount: rightSideCropAmount
		})
	}
}