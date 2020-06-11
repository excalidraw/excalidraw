import "./UserList.css";

import React from "react";

type UserListProps = {
  children: React.ReactNode;
  className?: string;
};

export const UserList = ({ children, className }: UserListProps) => (
  <div className={`UserList ${className}`}>{children}</div>
);
