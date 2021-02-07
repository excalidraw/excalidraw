const IMAGE_URL = `${process.env.REACT_APP_SOCKET_SERVER_URL}/test128.png`;
const IMAGE_SIZE_BYTES = 35747;

const calculateSpeed = (startTime: number, endTime: number) => {
  const duration = (endTime - startTime) / 1000;
  const imageSizeInBits = IMAGE_SIZE_BYTES * 8;
  let speed = imageSizeInBits / duration;
  const suffix = ["B/s", "kB/s", "MB/s", "GB/s"];
  let index = 0;
  while (speed > 1000) {
    index++;
    speed = speed / 1000;
  }
  return `${speed.toFixed(index > 1 ? 1 : 0)} ${suffix[index]}`;
};

const processImage = (): Promise<string> => {
  return new Promise((resolve) => {
    const image = new Image();
    let endTime: number;
    image.onload = () => {
      endTime = new Date().getTime();
      const speed = calculateSpeed(startTime, endTime);
      resolve(speed);
    };

    image.onerror = () => {
      resolve("-1");
    };

    const startTime = new Date().getTime();
    image.src = `${IMAGE_URL}?t=${startTime}`;
  });
};
export const getNetworkSpeed = async (): Promise<string> => {
  return await processImage();
};
