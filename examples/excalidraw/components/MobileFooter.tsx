import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/dist/excalidraw/types";
import CustomFooter from "./CustomFooter";
import type * as TExcalidraw from "@excalidraw/excalidraw";

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
