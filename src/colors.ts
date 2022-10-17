import oc from "open-color";

const shades = (index: number) => [
  oc.red[index],
  oc.pink[index],
  oc.grape[index],
  oc.violet[index],
  oc.indigo[index],
  oc.blue[index],
  oc.cyan[index],
  oc.teal[index],
  oc.green[index],
  oc.lime[index],
  oc.yellow[index],
  oc.orange[index],
];

const elementStrokeColors = [
  "#1F2123",
  "#3A3C40",
  "#55575D",
  "#70737A",
  "#8C8F96",
  "#00B3F5",
  "#0678CB",
  "#8155E3",
  "#FAD000",
  "#F59127",
  "#00BAA5",
  "#8CCA08",
  "#009E52",
  "#E60E5E",
  "#D21C09",
];

const elementBackgroundColors = [
  "transparent",
  "#FFFFFF",
  "#F4F4F5",
  "#E8E9EA",
  "#C1C3C7",
  "#ADE9FF",
  "#ADD8FF",
  "#C7ADFF",
  "#FFF2AD",
  "#FFD7AD",
  "#ADFFF6",
  "#E4FFAD",
  "#ADFFBD",
  "#FFADD9",
  "#FFB5AD",
];

export default {
  canvasBackground: [oc.white, oc.gray[0], oc.gray[1], ...shades(0)],
  elementBackground: [...elementBackgroundColors],
  elementStroke: [...elementStrokeColors],
};
