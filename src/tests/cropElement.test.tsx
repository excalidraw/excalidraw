import { cropElementInternal, onElementCroppedInternal } from "../element/cropElement";
import { TransformHandleType } from "../element/transformHandles";
import { ExcalidrawElement } from "../element/types";
import { NonDeleted } from "../element/types";
import { ExcalidrawImageElement } from "../element/types";

let element: ExcalidrawImageElement = {
	id: "",
	strokeColor: "",
	backgroundColor: "",
	fillStyle: "solid",
	strokeWidth: 1,
	strokeStyle: "solid",
	roundness: null,
	roughness: 1,
	opacity: 1,
	seed: 0,
	version: 0,
	versionNonce: 0,
	isDeleted: false,
	groupIds: [],
	boundElements: null,
	updated: 0,
	link: null,
	locked: false,
	type: "image",
	fileId: null,
	status: "pending",
	scale: [1, 1],

	x: 0,
	y: 0,
	width: 500,
	height: 500,
	angle: 0,
	rescaleX: 1,
	rescaleY: 1,
	widthAtCreation: 500,
	heightAtCreation: 500,
	underlyingImageWidth: 1000,
	underlyingImageHeight: 1000,
	xToPullFromImage: 0,
	yToPullFromImage: 0,
	wToPullFromImage: 1000,
	hToPullFromImage: 1000,
	westCropAmount: 0,
	eastCropAmount: 0,
	northCropAmount: 0,
	southCropAmount: 0
};

let transformHandle: TransformHandleType;
let stateAtCropStart: NonDeleted<ExcalidrawElement> = { ...element };
let pointerX: number;
let pointerY: number;

beforeEach(() => {
	element = {
		id: "",
		strokeColor: "",
		backgroundColor: "",
		fillStyle: "solid",
		strokeWidth: 1,
		strokeStyle: "solid",
		roundness: null,
		roughness: 1,
		opacity: 1,
		seed: 0,
		version: 0,
		versionNonce: 0,
		isDeleted: false,
		groupIds: [],
		boundElements: null,
		updated: 0,
		link: null,
		locked: false,
		type: "image",
		fileId: null,
		status: "pending",
		scale: [1, 1],
	
		x: 0,
		y: 0,
		width: 500,
		height: 500,
		angle: 0,
		rescaleX: 1,
		rescaleY: 1,
		widthAtCreation: 500,
		heightAtCreation: 500,
		underlyingImageWidth: 1000,
		underlyingImageHeight: 1000,
		xToPullFromImage: 0,
		yToPullFromImage: 0,
		wToPullFromImage: 1000,
		hToPullFromImage: 1000,
		westCropAmount: 0,
		eastCropAmount: 0,
		northCropAmount: 0,
		southCropAmount: 0
	};
	
	stateAtCropStart = { ...element };
	pointerX = 0;
	pointerY = 0;
})

describe("should return a simple east -> west crop mutation", () => {
	transformHandle = 'e';
	pointerX = 400;

	let initialCropResult = cropElementInternal(
		element,
		transformHandle,
		stateAtCropStart,
		pointerX,
		pointerY
	)

	let newElement = {
		... element,
		... initialCropResult
	}

	let finalCropResult = onElementCroppedInternal(
		element,
		transformHandle,
		stateAtCropStart
	)

	let finalElement = {
		... element,
		... finalCropResult
	}

	expect(finalElement.width).toBe(400);

})