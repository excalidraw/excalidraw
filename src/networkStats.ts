const IMAGE_URL =
  "https://user-images.githubusercontent.com/11256141/107128597-feb46700-68e4-11eb-80f7-1d259cc0151f.png";
const IMAGE_SIZE = 2666; // in bytes
const calculateSpeed = (startTime: number, endTime: number) => {
  const duration = (endTime - startTime) / 1000;
  const imageSizeInBits = IMAGE_SIZE * 8;
  let speed = imageSizeInBits / duration;
  const suffix = ["bps", "kbps", "mbps", "gbps"];
  let index = 0;
  while (speed > 1024) {
    index++;
    speed = speed / 1024;
  }
  return `${speed.toFixed(2)} ${suffix[index]}`;
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
    image.src = `${IMAGE_URL}?t=${startTime}`; // start time acts as a cache buster so everytime new url is requested
  });
};
export const getNetworkSpeed = async (): Promise<string> => {
  return await processImage();
};
