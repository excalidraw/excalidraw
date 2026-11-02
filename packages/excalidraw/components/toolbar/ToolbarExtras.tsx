// Lets the host app add its own tool buttons to the native toolbar, after the
// eraser and before the "more tools" menu — the same pattern as <Footer> and
// <MainMenu>: children are tunneled into the toolbar island.
import { useTunnels } from "../../context/tunnels";

export const ToolbarExtras = ({ children }: { children?: React.ReactNode }) => {
  const { ToolbarExtrasTunnel } = useTunnels();
  return <ToolbarExtrasTunnel.In>{children}</ToolbarExtrasTunnel.In>;
};
ToolbarExtras.displayName = "ToolbarExtras";
