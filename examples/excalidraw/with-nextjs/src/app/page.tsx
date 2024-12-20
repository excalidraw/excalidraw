import dynamic from "next/dynamic";
import Script from "next/script";
import "../common.scss";

const ExcalidrawWithClientOnly = dynamic(
  async () => (await import("../excalidrawWrapper")).default,
  {
    ssr: false,
  },
);

export default function Page() {
  return (
    <>
      <h1 className="page-title">WELCOME</h1>
      <Script id="load-env-variables" strategy="beforeInteractive">
        {`window["EXCALIDRAW_ASSET_PATH"] = window.origin;`}
      </Script>
      {/* @ts-expect-error - https://github.com/vercel/next.js/issues/42292 */}
      <ExcalidrawWithClientOnly />
    </>
  );
}
