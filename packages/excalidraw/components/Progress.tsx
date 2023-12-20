import { FC, useEffect, useState } from "react";
import * as Progress from "@radix-ui/react-progress";
import "./Progress.scss";

const ProgressDemo: FC = () => {
  const [progress, setProgress] = useState(0);

  //   useEffect(() => {
  //     const timer = setTimeout(() => setProgress(66), 500);
  //     return () => clearTimeout(timer);
  //   }, []);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  const startProgress = () => {
    // 避免重复启动定时器
    if (!intervalId) {
      const timer = setInterval(() => {
        setProgress((prevProgress) =>
          prevProgress < 100 ? prevProgress + 1 : prevProgress,
        );
      }, 500);

      setIntervalId(timer);
    }
  };

  const stopProgress = () => {
    // 清除定时器
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
      setProgress(0)
    }
  };

  useEffect(() => {
    // 在组件卸载时清除定时器
    return () => {
      stopProgress();
    };
  }, [intervalId]);

  return (
    <div className="progress">
      <div className="btn" onClick={() => startProgress()}>
        Click!
      </div>
      <div className="btn" onClick={() => stopProgress()}>
        Reset!
      </div>
      <Progress.Root className="progressRoot" value={progress}>
        <Progress.Indicator
          className="progressIndicator"
          style={{ transform: `translateX(-${100 - progress}%)` }}
        />
      </Progress.Root>
    </div>
  );
};

export default ProgressDemo;
