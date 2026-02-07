import { useEffect, useState } from "react";
import Spinner from "@excalidraw/excalidraw/components/Spinner";

interface QRCodeProps {
  value: string;
}

export const QRCode = ({ value }: QRCodeProps) => {
  const [svgData, setSvgData] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    import("./qrcode.chunk")
      .then(({ generateQRCodeSVG }) => {
        if (mounted) {
          try {
            setSvgData(generateQRCodeSVG(value));
          } catch {
            setError(true);
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setError(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [value]);

  if (error) {
    return null;
  }

  if (!svgData) {
    return (
      <div className="ShareDialog__active__qrcode ShareDialog__active__qrcode--loading">
        <Spinner />
      </div>
    );
  }

  return (
    <div
      className="ShareDialog__active__qrcode"
      role="img"
      aria-label="QR code for collaboration link"
      dangerouslySetInnerHTML={{ __html: svgData }}
    />
  );
};
