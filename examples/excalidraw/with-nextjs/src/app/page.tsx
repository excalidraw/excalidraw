import dynamic from "next/dynamic";
import "../common.scss";

// Since client components get prerenderd on server as well hence importing the excalidraw stuff dynamically
// with ssr false
const ExcalidrawWithClientOnly = dynamic(
  async () => (await import("../excalidrawWrapper")).default,
  {
    ssr: false,
  },
);

export default function Page() {
  return (
    <>
      <a href="/excalidraw-in-pages">Switch to Pages router</a>
      <h1 className="page-title">App Router</h1>

      {/* @ts-expect-error - https://github.com/vercel/next.js/issues/42292 */}
      <ExcalidrawWithClientOnly />
    </>
  );
}
