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

	mutateElement(element, {
		width: newWidth
	})
}