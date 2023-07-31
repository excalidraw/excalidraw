import { UserToFollow } from "../../types";
import { CloseIcon } from "../icons";
import "./FollowMode.scss";

interface FollowModeProps {
  width: number;
  height: number;
  children: React.ReactNode;
  userToFollow?: UserToFollow | null;
  onDisconnect: () => void;
}

const FollowMode = ({
  children,
  height,
  width,
  userToFollow,
  onDisconnect,
}: FollowModeProps) => {
  if (!userToFollow) {
    return <>{children}</>;
  }

  return (
    <div style={{ position: "relative" }}>
      <div className="follow-mode" style={{ width, height }}>
        <div className="follow-mode__badge">
          <div className="follow-mode__badge__label">
            Following{" "}
            <span
              className="follow-mode__badge__username"
              title={userToFollow.username}
            >
              {userToFollow.username}
            </span>
          </div>
          <button
            onClick={onDisconnect}
            className="follow-mode__disconnect-btn"
          >
            {CloseIcon}
          </button>
        </div>
      </div>
      {children}
    </div>
  );
};

export default FollowMode;
