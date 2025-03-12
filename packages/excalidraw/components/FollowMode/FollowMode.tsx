import { CloseIcon } from "../icons";

import "./FollowMode.scss";

import type { UserToFollow } from "../../types";

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
          type="button"
          onClick={onDisconnect}
          className="follow-mode__disconnect-btn"
        >
          {CloseIcon}
        </button>
      </div>
    </div>
  );
};

export default FollowMode;
