let pdfWorker = null;

async function getPdfWorker() {
	if (!pdfWorker) {
		pdfWorker = new pdfjsLib.PDFWorker();
	}
	return pdfWorker;
}

window.extractPDFDocumentPages = async function(pdfData, outputScale) {
	let worker = null;
	let doc = null;

	try {
		worker = await getPdfWorker();
		const loadingTask = pdfjsLib.getDocument({
			data: pdfData,
			verbosity: 0,
			worker: worker
		});

		doc = await loadingTask.promise;
		const result = [];

		for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
			const pageResult = await renderPdfPage(doc, pageNum, outputScale);
			result.push(pageResult);

			if (pageNum % 5 === 0) {
				await new Promise(resolve => setTimeout(resolve, 0));
			}
		}

		return result;
	} finally {
		if (doc) {
			await doc.destroy();
		}
	}
}

async function renderPdfPage(doc, pageNum, outputScale) {
	const page = await doc.getPage(pageNum);

	try {
		const viewport = page.getViewport({ scale: 1 });
		const width = Math.floor(viewport.width);
		const height = Math.floor(viewport.height);

		const MAX_DIMENSION = 4096;
		const scale = Math.min(
			outputScale,
			MAX_DIMENSION / width,
			MAX_DIMENSION / height
		);

		const scaledWidth = Math.floor(width * scale);
		const scaledHeight = Math.floor(height * scale);

		const canvas = new OffscreenCanvas(scaledWidth, scaledHeight);
		const context = canvas.getContext('2d');

		const renderContext = {
			canvasContext: context,
			viewport: page.getViewport({ scale }),
			intent: 'print',
		};

		await page.render(renderContext).promise;

		const blob = await canvas.convertToBlob({
			quality: 0.85,
			type: 'image/jpeg'
		});

		const bytes = new Uint8Array(await blob.arrayBuffer());

		return {
			Bytes: bytes,
			Width: scaledWidth,
			Height: scaledHeight,
		};
	} finally {
		await page.cleanup();
	}
}




