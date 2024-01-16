import ExcalidrawWithClientOnly from "./excalidraw";

export default function Page() {
  return (
    <>
      <h1 style={{ textAlign: "center" }}>Excalidraw With Next JS</h1>
      {/* @ts-expect-error - https://github.com/vercel/next.js/issues/42292 */}
      <ExcalidrawWithClientOnly />
    </>
  );
}
