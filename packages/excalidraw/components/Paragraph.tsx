export const Paragraph = (props: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => {
  return (
    <p className="excalidraw__paragraph" style={props.style}>
      {props.children}
    </p>
  );
};
