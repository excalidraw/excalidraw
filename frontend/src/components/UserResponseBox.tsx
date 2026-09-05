import type { Message } from "@/types";

interface UserResponseBoxProps {
  message: Message;
}

export function UserResponseBox({ message }: UserResponseBoxProps) {
  return (
    <article className="message message--user">
      {message.attachments && message.attachments.length > 0 && (
        <ul className="message__files">
          {message.attachments.map((file) => (
            <li key={file.id} className="message__file">
              <a href={file.url} target="_blank" rel="noreferrer">
                {file.name}
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="message__bubble">{message.content}</div>
    </article>
  );
}

export default UserResponseBox;
