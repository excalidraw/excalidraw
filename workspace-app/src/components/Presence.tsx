import type { PresenceUser } from "../editor/useCollab";
import type { CollabStatus } from "../editor/useCollab";

export const Presence = ({
  users,
  status,
}: {
  users: PresenceUser[];
  status: CollabStatus;
}) => (
  <div className="presence" aria-label="People in this scene">
    <span
      className={`live-dot ${status}`}
      title={`Live collaboration: ${status}`}
    />
    {users.slice(0, 5).map((u) => (
      <span
        key={u.id}
        className="presence-avatar"
        style={{ background: u.color }}
        title={`${u.name}${u.access === "VIEW" ? " (viewing)" : ""}`}
      >
        {u.avatarUrl ? (
          <img alt="" src={u.avatarUrl} referrerPolicy="no-referrer" />
        ) : (
          u.name.slice(0, 1).toUpperCase()
        )}
      </span>
    ))}
    {users.length > 5 && (
      <span className="presence-more">+{users.length - 5}</span>
    )}
  </div>
);
