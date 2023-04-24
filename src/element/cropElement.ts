import { mutateElement } from "./mutateElement";
import { MaybeTransformHandleType } from "./transformHandles";
import { ExcalidrawElement, ExcalidrawImageElement, NonDeleted } from "./types";


export function cropElement(    
	element: ExcalidrawImageElement,
	handleType: MaybeTransformHandleType,
	stateAtCropStart: NonDeleted<ExcalidrawElement>,
	pointerX: number,
	pointerY: number
) {
	let newWidth = pointerX - stateAtCropStart.x;
	let wToPullFromImage = (newWidth / element.widthAtCreation) * element.underlyingImageWidth;

	mutateElement(element, {
		width: newWidth,
		wToPullFromImage: wToPullFromImage
	})
}

export function onElementCropped(
	element: ExcalidrawImageElement,
	handleType: MaybeTransformHandleType,
	stateAtCropStart: NonDeleted<ExcalidrawElement>
) {
	const rightSideCropAmount = element.widthAtCreation - element.width;
	
	mutateElement(element, {
		rightSideCropAmount: rightSideCropAmount
	})
}