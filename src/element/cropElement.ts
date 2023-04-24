import { Point } from "points-on-curve";
import { centerPoint, rotatePoint } from "../math";
import { updateBoundElements } from "./binding";
import { mutateElement } from "./mutateElement";
import { MaybeTransformHandleType, TransformHandleType } from "./transformHandles";
import { ExcalidrawElement, ExcalidrawImageElement, NonDeleted } from "./types";
import { getResizedElementAbsoluteCoords } from "./bounds";


export function cropElement(    
	element: ExcalidrawImageElement,
	handleType: TransformHandleType,
	stateAtCropStart: NonDeleted<ExcalidrawElement>,
	pointerX: number,
	pointerY: number
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

	let maxWidth = element.widthAtCreation * element.rescaleX;

	if (handleType == 'w') {
		let rightSideCropAmount = element.rightSideCropAmount * element.rescaleX;
		let maxRightX = stateAtCropStart.x + stateAtCropStart.width;

		let availableSpaceToCropFurtherLeft = (maxWidth - rightSideCropAmount) - stateAtCropStart.width;
		let maxLeftX = stateAtCropStart.x - availableSpaceToCropFurtherLeft;
		if (pointerX < maxLeftX) {
			pointerX = maxLeftX;
		}
		
		if (pointerX > maxRightX) {
			pointerX = maxRightX;
		}
	
		let horizontalMouseMovement = pointerX - stateAtCropStart.x;
		let newX = stateAtCropStart.x + horizontalMouseMovement;
		let newWidth = stateAtCropStart.width - horizontalMouseMovement;

		let preexistingLeftSideCropAmount = element.leftSideCropAmount * element.rescaleX;

		let cumulativeLeftSideCrop = horizontalMouseMovement + preexistingLeftSideCropAmount;
		let totalAvailableLeftSideCroppingSpace = maxWidth;
		let portionOfLeftSideCropped = cumulativeLeftSideCrop / totalAvailableLeftSideCroppingSpace;

		let xToPullFromImage = portionOfLeftSideCropped * element.underlyingImageWidth;
		let wToPullFromImage = (newWidth / maxWidth) * element.underlyingImageWidth;

		mutateElement(element, {
			x: newX,
			width: newWidth,
			xToPullFromImage: xToPullFromImage,
			wToPullFromImage: wToPullFromImage
		})
	} else if (handleType == 'e') {
		let rightBound = stateAtCropStart.x + (maxWidth - element.leftSideCropAmount);

		if (pointerX > rightBound) {
			pointerX = rightBound;
		}
		if (pointerX < stateAtCropStart.x) {
			pointerX = stateAtCropStart.x;
		}
		let newWidth = pointerX - stateAtCropStart.x;
		let wToPullFromImage = (newWidth / maxWidth) * element.underlyingImageWidth;

		const [newBoundsX1, newBoundsY1, newBoundsX2, newBoundsY2] =
    getResizedElementAbsoluteCoords(
      stateAtCropStart,
      newWidth,
      element.height,
      true,
    );
		const newBoundsWidth = newBoundsX2 - newBoundsX1;
		const newBoundsHeight = newBoundsY2 - newBoundsY1;

		// Calculate new topLeft based on fixed corner during resize
		let newTopLeft = [...startTopLeft] as [number, number];

		// const transformHandleDirection = handleType;
		// if (["n", "w", "nw"].includes(transformHandleDirection)) {
		// 	newTopLeft = [
		// 		startBottomRight[0] - Math.abs(newBoundsWidth),
		// 		startBottomRight[1] - Math.abs(newBoundsHeight),
		// 	];
		// }
		// if (transformHandleDirection === "ne") {
		// 	const bottomLeft = [startTopLeft[0], startBottomRight[1]];
		// 	newTopLeft = [bottomLeft[0], bottomLeft[1] - Math.abs(newBoundsHeight)];
		// }
		// if (transformHandleDirection === "sw") {
		// 	const topRight = [startBottomRight[0], startTopLeft[1]];
		// 	newTopLeft = [topRight[0] - Math.abs(newBoundsWidth), topRight[1]];
		// }

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

		mutateElement(element, {
			x: newOrigin[0],
			y: newOrigin[1],
			width: newWidth,
			wToPullFromImage: wToPullFromImage
		})
	}

	// updateBoundElements(element, {
	// 	newSize: { width: element.width, height: element.height },
	// });

	return;
}

export function onElementCropped(
	element: ExcalidrawImageElement,
	handleType: TransformHandleType,
	stateAtCropStart: NonDeleted<ExcalidrawElement>
) {
	if (handleType == 'w') {
		let unscaledWidth = element.width / element.rescaleX;
		let leftSideCropAmount = element.widthAtCreation - unscaledWidth - element.rightSideCropAmount;
	
		mutateElement(element, {
			leftSideCropAmount: leftSideCropAmount
		})
	} else if (handleType == 'e') {
		let unscaledWidth = element.width / element.rescaleX;
		let rightSideCropAmount = element.widthAtCreation - unscaledWidth - element.leftSideCropAmount;
	
		mutateElement(element, {
			rightSideCropAmount: rightSideCropAmount
		})
	}


}