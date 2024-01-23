import dynamic from "next/dynamic";

// Since client components get prerenderd on server as well hence importing the excalidraw stuff dynamically
// with ssr false
const ExcalidrawWithClientOnly = dynamic(
  async () => (await import("./excalidraw")).default,
  {
    ssr: false,
  },
);

export default function Page() {
  return (
    <>
      {/* @ts-expect-error - https://github.com/vercel/next.js/issues/42292 */}
      <ExcalidrawWithClientOnly />
    </>
  );
}
