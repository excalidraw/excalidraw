import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";

import {
  HERO_CHANGE_STYLES,
  HERO_EDGE_STROKE,
  HERO_INSPECTOR,
  HERO_SCENE_EDGES,
  HERO_SCENE_FRAMES,
  HERO_SCENE_NODES,
  HERO_SCENE_SATELLITE_LINKS,
  HERO_SCENE_VIEWBOX,
} from "./heroSceneLayout";

const TILT_MAX = 6;

const cardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: "easeOut" as const },
  },
};

const nodeVariants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (index: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: 0.15 + index * 0.06,
      duration: 0.4,
      ease: "easeOut" as const,
    },
  }),
};

const HeroInspector = () => (
  <div className="lp-hero-scene__inspector">
    <div className="lp-hero-scene__inspector-head">
      <span className="lp-hero-scene__inspector-type">
        {HERO_INSPECTOR.resourceType}
      </span>
      <span className="lp-hero-scene__inspector-badge">
        {HERO_INSPECTOR.action} · {HERO_INSPECTOR.changedCount} changed /{" "}
        {HERO_INSPECTOR.shownCount} shown
      </span>
    </div>
    <p className="lp-hero-scene__inspector-path">{HERO_INSPECTOR.nodePath}</p>
    <div className="lp-hero-scene__diff">
      <div className="lp-hero-scene__diff-head">
        <strong>{HERO_INSPECTOR.attribute}</strong>
        <span>after apply</span>
      </div>
      <div className="lp-hero-scene__diff-row">
        <span className="lp-hero-scene__diff-label">before</span>
        <code>{HERO_INSPECTOR.before}</code>
      </div>
      <div className="lp-hero-scene__diff-row lp-hero-scene__diff-row--after">
        <span className="lp-hero-scene__diff-label">after</span>
        <code>{HERO_INSPECTOR.after}</code>
      </div>
    </div>
  </div>
);

const HeroCanvas = ({ animateEdges }: { animateEdges: boolean }) => (
  <div className="lp-hero-scene__canvas">
    <svg
      className="lp-hero-scene__svg"
      viewBox={`0 0 ${HERO_SCENE_VIEWBOX.width} ${HERO_SCENE_VIEWBOX.height}`}
      role="presentation"
    >
      <defs>
        <pattern
          id="lp-hero-grid"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 16 0 L 0 0 0 16"
            fill="none"
            stroke="rgba(15, 23, 20, 0.06)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect
        width={HERO_SCENE_VIEWBOX.width}
        height={HERO_SCENE_VIEWBOX.height}
        fill="url(#lp-hero-grid)"
      />

      {HERO_SCENE_FRAMES.map((frame) => (
        <g key={frame.id}>
          <rect
            x={frame.x}
            y={frame.y}
            width={frame.width}
            height={frame.height}
            className={`lp-hero-scene__frame lp-hero-scene__frame--${frame.level}`}
          />
          <text
            x={frame.x + 8}
            y={frame.y - 6}
            className={`lp-hero-scene__frame-label lp-hero-scene__frame-label--${frame.level}`}
          >
            {frame.label}
          </text>
        </g>
      ))}

      {HERO_SCENE_SATELLITE_LINKS.map((link) => (
        <path
          key={link.id}
          d={link.path}
          className="lp-hero-scene__satellite-link"
          fill="none"
        />
      ))}

      {HERO_SCENE_EDGES.map((edge, index) => (
        <motion.path
          key={edge.id}
          d={edge.path}
          className="lp-hero-scene__edge"
          fill="none"
          stroke={HERO_EDGE_STROKE[edge.changeState]}
          initial={animateEdges ? { pathLength: 0, opacity: 0.4 } : false}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            pathLength: {
              delay: 0.35 + index * 0.08,
              duration: 0.55,
              ease: "easeOut",
            },
            opacity: { delay: 0.35 + index * 0.08, duration: 0.2 },
          }}
        />
      ))}

      {HERO_SCENE_NODES.map((node, index) => {
        const style = HERO_CHANGE_STYLES[node.changeState];
        const nodeHeight = node.satellite ? node.height : node.height;
        const iconR = node.satellite ? 2.5 : 3;
        const labelX = node.satellite ? node.x + 14 : node.x + 18;
        const iconCx = node.satellite ? node.x + 8 : node.x + 10;

        return (
          <motion.g
            key={node.id}
            custom={index}
            variants={nodeVariants}
            initial="hidden"
            animate="visible"
          >
            <rect
              x={node.x}
              y={node.y}
              width={node.width}
              height={nodeHeight}
              rx={node.satellite ? 4 : 6}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={node.selected ? 1.5 : 1}
              className={
                node.satellite
                  ? "lp-hero-scene__node lp-hero-scene__node--satellite"
                  : "lp-hero-scene__node"
              }
            />
            {node.selected ? (
              <motion.rect
                x={node.x - 2}
                y={node.y - 2}
                width={node.width + 4}
                height={node.height + 4}
                rx={8}
                className="lp-hero-scene__node-pulse"
                stroke={style.stroke}
                animate={
                  animateEdges
                    ? { opacity: [0.35, 0.85, 0.35] }
                    : { opacity: 0.6 }
                }
                transition={
                  animateEdges
                    ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
                    : undefined
                }
              />
            ) : null}
            <circle
              cx={iconCx}
              cy={node.y + node.height / 2}
              r={iconR}
              fill={style.stroke}
            />
            <text
              x={labelX}
              y={node.y + node.height / 2 + (node.satellite ? 3 : 4)}
              className={
                node.satellite
                  ? "lp-hero-scene__node-label lp-hero-scene__node-label--satellite"
                  : "lp-hero-scene__node-label"
              }
            >
              {node.shortLabel}
            </text>
          </motion.g>
        );
      })}
    </svg>
    <span className="lp-hero-scene__canvas-tag">semantic view</span>
  </div>
);

export const HeroTopologyScene = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [isActive, setIsActive] = useState(true);

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 140, damping: 18 });
  const springY = useSpring(rotateY, { stiffness: 140, damping: 18 });
  const transform = useMotionTemplate`rotateX(${springX}deg) rotateY(${springY}deg)`;

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (reduceMotion || !isActive) {
        return;
      }
      const el = containerRef.current;
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      rotateY.set(px * TILT_MAX * 2);
      rotateX.set(-py * TILT_MAX * 2);
    },
    [isActive, reduceMotion, rotateX, rotateY],
  );

  const handlePointerLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsActive(entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="lp-hero-scene-wrap"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <motion.div
        className="lp-hero-scene"
        style={
          reduceMotion
            ? undefined
            : { transform, transformStyle: "preserve-3d" }
        }
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <HeroInspector />
        <HeroCanvas animateEdges={!reduceMotion} />
      </motion.div>
    </div>
  );
};
