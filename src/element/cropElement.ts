import { mutateElement } from "./mutateElement";
import { MaybeTransformHandleType, TransformHandleType } from "./transformHandles";
import { ExcalidrawElement, ExcalidrawImageElement, NonDeleted } from "./types";


export function cropElement(    
	element: ExcalidrawImageElement,
	handleType: TransformHandleType,
	stateAtCropStart: NonDeleted<ExcalidrawElement>,
	pointerX: number,
	pointerY: number
) {
	// properties that are used in more than one case
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

		mutateElement(element, {
			width: newWidth,
			wToPullFromImage: wToPullFromImage
		})
	}

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