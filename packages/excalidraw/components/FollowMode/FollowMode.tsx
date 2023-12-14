import { UserToFollow } from "../../types";
import { CloseIcon } from "../icons";
import "./FollowMode.scss";

interface FollowModeProps {
  width: number;
  height: number;
  userToFollow: UserToFollow;
  onDisconnect: () => void;
}

const FollowMode = ({
  height,
  width,
  userToFollow,
  onDisconnect,
}: FollowModeProps) => {
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
    </div>
  );
};

export default FollowMode;
