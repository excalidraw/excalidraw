import { env, pipeline, RawImage } from "@huggingface/transformers";

env.allowLocalModels = false;
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}

let recognizerPromise: Promise<any> | undefined;

const getRecognizer = () => {
  if (!recognizerPromise) {
    recognizerPromise = pipeline(
      "image-to-text",
      "Xenova/trocr-small-handwritten",
    );
  }
  return recognizerPromise;
};

self.onmessage = async (event: MessageEvent<ImageData>) => {
  try {
    const recognize = await getRecognizer();
    const { data, width, height } = event.data;
    const image = new RawImage(new Uint8ClampedArray(data), width, height, 4);
    const output = await recognize(image, {
      max_new_tokens: 64,
    });
    const first = Array.isArray(output) ? output[0] : output;
    const text =
      first && "generated_text" in first
        ? String(first.generated_text).trim()
        : "";
    self.postMessage({ text });
  } catch (error) {
    recognizerPromise = undefined;
    self.postMessage({ error: String(error) });
  }
};
