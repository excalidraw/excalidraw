import React from "react";

import "./LoadigMessage.scss";

export const LoadingMessage = () => {
  // !! KEEP THIS IN SYNC WITH index.html !!
  return (
    <div className="LoadingMessage">
      <span>{"Loading scene..."}</span>
    </div>
  );
};
