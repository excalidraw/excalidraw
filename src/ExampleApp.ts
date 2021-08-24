/* eslint-disable prettier/prettier */
import { useEffect, useState } from "react";
import ExcalidrawApp from "./excalidraw-app";

const ExampleApp = () => {
  const [data, setData] = useState({});
  const [excalidrawState, setExcalidrawState] = useState({});

  const handleExcalidrawStateData = (excalidrawStateData) => {
    console.error("Excalidraw State Data: ", excalidrawStateData);
    setExcalidrawState(excalidrawState);
  };

  useEffect(() => {
    const name = prompt("Enter name: ");
    setData({
      roomId: "accdabcdabcdabcdabcd",
      ExcalidrawEncryptionKey: "Abcdabcdabcdabcdabcdcd",
      userName: name,
      enableCustomProps: true,
    });
  }, []);

  return (
    <ExcalidrawApp
      data={data}
      handleExcalidrawStateData={handleExcalidrawStateData}
    />
  );
};

export default ExampleApp;
