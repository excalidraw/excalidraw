import "./ExampleSidebar.scss";

const React = window.React;

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div id="mySidebar" className={`sidebar ${open ? "open" : ""}`}>
        <button className="closebtn" onClick={() => setOpen(false)}>
          x
        </button>
        <div className="sidebar-links">
          <button>Empty Home</button>
          <button>Empty About</button>
        </div>
      </div>
      <div className={`${open ? "sidebar-open" : ""}`}>
        <button
          className="openbtn"
          onClick={() => {
            setOpen(!open);
          }}
        >
          Open Sidebar
        </button>
        {children}
      </div>
    </>
  );
}
