import { CloseIcon } from "../icons";
import "./FollowMode.scss";

interface FollowModeProps {
  width: number;
  height: number;
  children: React.ReactNode;
}

const FollowMode = ({ children, height, width }: FollowModeProps) => {
  return (
    <div style={{ position: "relative" }}>
      <div className="follow-mode" style={{ width, height }}>
        <div className="follow-mode__badge">
          <span>Following Handsome Swan</span>
          <button className="follow-mode__disconnect-btn">{CloseIcon}</button>
        </div>
      </div>
      {children}
    </div>
  );
};

export default FollowMode;
