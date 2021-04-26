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

export default {
  canvasBackground: [oc.white, oc.gray[0], oc.gray[1], ...shades(0)],
  elementBackground: ["transparent", oc.gray[4], oc.gray[6], ...shades(6)],
  elementStroke: [oc.black, oc.gray[8], oc.gray[7], ...shades(9)],
};
