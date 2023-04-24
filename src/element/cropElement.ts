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


	// cropping left -> right
	let availableSpaceToCropFurtherLeft = maxWidth - stateAtCropStart.width;
	let maxLeftX = stateAtCropStart.x - availableSpaceToCropFurtherLeft;
	if (pointerX < maxLeftX) {
		pointerX = maxLeftX;
	}

	let leftSideCropAmount = element.leftSideCropAmount * element.rescaleX;

	let xOffset = pointerX - stateAtCropStart.x;
	let newX = stateAtCropStart.x + (xOffset);
	let newWidth = stateAtCropStart.width - (xOffset);

	let portionOfLeftSideCropped = (xOffset + leftSideCropAmount) / (stateAtCropStart.width + leftSideCropAmount);

	let xToPullFromImage = portionOfLeftSideCropped * element.underlyingImageWidth;
	let wToPullFromImage = (newWidth / maxWidth) * element.underlyingImageWidth;

	mutateElement(element, {
		x: newX,
		width: newWidth,
		xToPullFromImage: xToPullFromImage,
		wToPullFromImage: wToPullFromImage
	})

	return;
	// cropping right -> left
	// let rightBound = stateAtCropStart.x + maxWidth;

	// if (pointerX > rightBound) {
	// 	pointerX = rightBound;
	// }
	// let newWidth = pointerX - stateAtCropStart.x;

	// let wToPullFromImage = (newWidth / maxWidth) * element.underlyingImageWidth;

	// mutateElement(element, {
	// 	width: newWidth,
	// 	wToPullFromImage: wToPullFromImage
	// })
}

export function onElementCropped(
	element: ExcalidrawImageElement,
	handleType: MaybeTransformHandleType,
	stateAtCropStart: NonDeleted<ExcalidrawElement>
) {
	let unscaledWidth = element.width / element.rescaleX;
	let leftSideCropAmount = element.widthAtCreation - unscaledWidth;

	mutateElement(element, {
		leftSideCropAmount: leftSideCropAmount
	})
}