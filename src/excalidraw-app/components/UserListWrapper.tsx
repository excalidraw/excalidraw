import { useDevice, useExcalidrawAppState } from "../../components/App";
import { UserList } from "../../components/UserList";

const UserListWrapper = () => {
  const device = useDevice();
  const appState = useExcalidrawAppState();
  if (!device.isMobile || appState.collaborators.size === 0) {
    return null;
  }
  return <UserList collaborators={appState.collaborators} />;
};
export default UserListWrapper;
UserListWrapper.displayName = "UserListWrapper";
