import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/dist/excalidraw/types";
import type * as TExcalidraw from "@excalidraw/excalidraw";
import CustomFooter from "./CustomFooter";

const MobileFooter = ({
  excalidrawAPI,
  excalidrawLib,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
  excalidrawLib: typeof TExcalidraw;
}) => {
  const { useDevice, Footer } = excalidrawLib;

  const device = useDevice();
  if (device.editor.isMobile) {
    return (
      <Footer>
        <CustomFooter
          excalidrawAPI={excalidrawAPI}
          excalidrawLib={excalidrawLib}
        />
      </Footer>
    );
  }
  return null;
};
export default MobileFooter;
