"use client";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group, MathUtils } from "three";
import type { AgentPresence } from "@/lib/office/view";
import { crew, robotPose, stationPoint } from "./orbital-model";
import { Panel, Ring, Orb, Tag } from "./orbital-parts";
import type { AgentActivity } from "./missions";
export function OrbitalRobot({
  index,
  selected,
  onSelect,
  animate,
  meeting,
  greeting,
  presence,
  activity,
}: {
  index: number;
  selected: boolean;
  onSelect: () => void;
  animate: boolean;
  meeting: boolean;
  greeting: number;
  presence: AgentPresence;
  activity?: AgentActivity;
}) {
  const spec = crew[index],
    color = spec.accent;
  const root = useRef<Group>(null),
    head = useRef<Group>(null),
    left = useRef<Group>(null),
    right = useRef<Group>(null),
    legs = useRef<Group>(null);
  const time = useRef(0),
    lastGreeting = useRef(greeting),
    waveUntil = useRef(0);
  // Office missions count as work too, so the crew visibly acts on real requests.
  const working = presence.state === "working" || Boolean(activity?.working);
  const deciding = (activity?.decisions || 0) > 0;
  const beacon = useRef<Group>(null);
  useFrame((_, dt) => {
    if (!root.current) return;
    const step = Math.min(dt, 0.05);
    if (animate) time.current += step;
    const t = time.current;
    if (lastGreeting.current !== greeting) {
      lastGreeting.current = greeting;
      if (selected) waveUntil.current = t + 3.8;
    }
    const pose = robotPose(index, t, meeting, working);
    const explaining = pose.visiting && Math.floor(t / 3) % 6 === index;
    const ease = animate ? 1 - Math.exp(-step * 2) : 1;
    const moving =
      Math.hypot(
        root.current.position.x - pose.x,
        root.current.position.z - pose.z,
      ) > 0.08;
    root.current.position.x = MathUtils.lerp(
      root.current.position.x,
      pose.x,
      ease,
    );
    root.current.position.z = MathUtils.lerp(
      root.current.position.z,
      pose.z,
      ease,
    );
    root.current.rotation.y = pose.angle;
    root.current.position.y = animate
      ? moving
        ? Math.abs(Math.sin(t * 9)) * 0.045
        : Math.sin(t * 1.7 + index) * 0.015
      : 0;
    if (head.current) {
      head.current.rotation.y = animate
        ? Math.sin(t * (index === 4 ? 0.5 : 1) + index) * 0.23
        : 0;
      head.current.rotation.x = animate
        ? Math.sin(t * (explaining ? 3 : 1) + index) *
          (explaining ? 0.09 : 0.025)
        : 0;
    }
    if (left.current)
      left.current.rotation.x = animate
        ? working
          ? -1.1 + Math.sin(t * 5) * 0.13
          : moving
            ? Math.sin(t * 9) * 0.4
            : explaining
              ? -0.65 + Math.sin(t * 3) * 0.22
              : index === 1
                ? -0.7 + Math.sin(t) * 0.06
                : index === 5
                  ? -0.4 + Math.sin(t * 1.7) * 0.3
                  : Math.sin(t * 1.5 + index) * 0.1
        : 0;
    if (right.current) {
      right.current.rotation.x = animate
        ? working
          ? -1 + Math.cos(t * 5) * 0.13
          : moving
            ? -Math.sin(t * 9) * 0.4
            : explaining
              ? -0.5 + Math.cos(t * 3) * 0.25
              : index === 3
                ? Math.sin(t * 0.65) * 0.2
                : 0
        : 0;
      right.current.rotation.z =
        animate && t < waveUntil.current ? -2 + Math.sin(t * 10) * 0.3 : -0.1;
    }
    if (beacon.current) {
      beacon.current.position.y = (index === 0 ? 2.85 : 2.65) + (animate ? Math.sin(t * 3 + index) * 0.07 : 0);
      beacon.current.rotation.y = animate ? t * 1.6 : 0;
      const pulse = animate ? 1 + Math.sin(t * 5) * 0.12 : 1;
      beacon.current.scale.setScalar(pulse);
    }
    if (legs.current)
      legs.current.rotation.z = animate && moving ? Math.sin(t * 9) * 0.06 : 0;
  });
  return (
    <group
      ref={root}
      position={stationPoint(index, 4.65)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <Ring
        radius={selected ? 0.7 : 0.5}
        position={[0, 0.035, 0]}
        color={selected ? color : "#273c46"}
        glow={selected ? 1.6 : 0.1}
      />
      {/* Individual chassis: tracked analysts, mobile operators and floating optical instruments. */}
      <group ref={legs}>
        {index === 1
          ? [-1, 1].map((s) => (
              <Panel
                key={s}
                position={[s * 0.33, 0.24, 0]}
                size={[0.24, 0.36, 0.65]}
                color="#1c2734"
                rounded
              />
            ))
          : [-1, 1].map((s) => (
              <group key={s}>
                <Panel
                  position={[s * 0.21, 0.24, 0]}
                  size={[index === 3 ? 0.25 : 0.18, 0.38, 0.2]}
                  color="#485a64"
                  rounded
                />
                <Panel
                  position={[s * 0.21, 0.08, 0.1]}
                  size={[0.26, 0.15, 0.4]}
                  color="#9cabae"
                  rounded
                />
              </group>
            ))}
      </group>
      <Panel
        position={[0, 0.76, 0]}
        size={index === 3 ? [0.83, 0.67, 0.55] : [0.62, 0.65, 0.46]}
        color={index === 0 ? "#d4dddc" : "#afbcbf"}
        rounded
      />
      <Panel
        position={[0, 0.8, 0.255]}
        size={[0.43, 0.32, 0.04]}
        color="#152632"
        rounded
      />
      <Panel
        position={[0, 0.83, 0.282]}
        size={[0.26, 0.025, 0.025]}
        color={color}
        glow={2}
      />
      <Panel
        position={[0, 0.71, 0.282]}
        size={[0.16, 0.025, 0.025]}
        color={color}
        glow={1}
      />
      <Panel
        position={[0, 0.57, 0.27]}
        size={[0.15, 0.055, 0.025]}
        color={color}
      />
      <group ref={head} position={[0, 1.42, 0]}>
        {index === 4 ? (
          <>
            <Orb radius={0.33} color="#aeb6c0" glow={0} />
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.28]}>
              <cylinderGeometry args={[0.18, 0.21, 0.35, 16]} />
              <meshStandardMaterial
                color="#273b4c"
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
            <Orb
              position={[0, 0, 0.48]}
              radius={0.13}
              color={color}
              glow={1.5}
            />
            <Ring radius={0.4} rotation={[0, 0, 0]} color={color} glow={0.3} />
          </>
        ) : (
          <>
            <Panel
              size={index === 2 ? [0.54, 0.38, 0.48] : [0.72, 0.45, 0.51]}
              color={index === 0 ? "#dde3dc" : "#9cacae"}
              rounded
            />
            <Panel
              position={[0, 0.005, 0.263]}
              size={[0.58, 0.22, 0.035]}
              color="#061823"
              rounded
            />
            {index === 1 ? (
              <Panel
                position={[0, 0.018, 0.291]}
                size={[0.43, 0.04, 0.03]}
                color={color}
                glow={2.5}
              />
            ) : (
              [-1, 1].map((s) => (
                <Panel
                  key={s}
                  position={[s * 0.15, 0.02, 0.294]}
                  size={[index === 3 ? 0.11 : 0.065, 0.06, 0.02]}
                  color={color}
                  glow={2.5}
                />
              ))
            )}
          </>
        )}
        {index === 0 && (
          <>
            <Ring
              radius={0.31}
              position={[0, 0.37, 0]}
              color={color}
              glow={0.7}
            />
            <Orb position={[0, 0.36, 0]} radius={0.055} color={color} />
          </>
        )}
        {index === 2 && (
          <>
            <Panel
              position={[0.31, 0.24, 0]}
              size={[0.035, 0.39, 0.035]}
              color="#afc0c3"
            />
            <Orb position={[0.31, 0.44, 0]} radius={0.05} color={color} />
          </>
        )}
        {index === 5 &&
          [-1, 1].map((s) => (
            <group key={s}>
              <Panel
                position={[s * 0.42, 0, 0]}
                size={[0.13, 0.31, 0.33]}
                color={color}
                rounded
              />
              <Ring
                radius={0.13}
                position={[s * 0.5, 0, 0]}
                rotation={[0, Math.PI / 2, 0]}
                color={color}
              />
            </group>
          ))}
      </group>
      {[-1, 1].map((s) => (
        <group
          key={s}
          ref={s === -1 ? left : right}
          position={[s * (index === 3 ? 0.54 : 0.43), 1.01, 0]}
        >
          <Orb radius={0.115} color="#546875" glow={0} />
          <Panel
            position={[0, -0.22, 0]}
            size={[0.14, 0.35, 0.15]}
            color={color}
            rounded
          />
          <Panel
            position={[0, -0.43, 0.04]}
            size={[0.17, 0.13, 0.2]}
            color="#c8d1d1"
            rounded
          />
          {index === 5 && (
            <Panel
              position={[0, -0.57, 0.06]}
              size={[0.025, 0.25, 0.025]}
              color="#e9cba9"
              glow={0.7}
            />
          )}
        </group>
      ))}
      {index === 3 && (
        <>
          <Panel
            position={[0, 0.83, -0.38]}
            size={[0.55, 0.55, 0.25]}
            color="#7a9281"
            rounded
          />
          <Panel
            position={[0.48, 0.69, 0.32]}
            size={[0.18, 0.24, 0.07]}
            color={color}
          />
          <Panel
            position={[0.48, 0.69, 0.363]}
            size={[0.12, 0.035, 0.01]}
            color="#e7f8e3"
          />
          <Panel
            position={[0.48, 0.69, 0.365]}
            size={[0.035, 0.13, 0.01]}
            color="#e7f8e3"
          />
        </>
      )}
      {index === 1 && (
        <Panel
          position={[0, 0.89, -0.31]}
          size={[0.58, 0.52, 0.2]}
          color="#766b4e"
          rounded
        />
      )}
      {(deciding || working || (activity?.active || 0) > 0) && (
        <group ref={beacon} position={[0, index === 0 ? 2.85 : 2.65, 0]}>
          <Orb
            radius={deciding ? 0.24 : 0.17}
            color={deciding ? "#e1b450" : working ? "#7fd8c8" : "#5f8fa3"}
            glow={deciding ? 2.4 : 1.4}
          />
        </group>
      )}
      <Tag
        text={spec.name}
        sub={
          deciding
            ? "! DECISÃO PENDENTE"
            : working
              ? "● EM MISSÃO"
              : activity?.active
                ? "○ MISSÃO NA FILA"
                : selected
                  ? spec.specialty
                  : spec.code
        }
        color={color}
        position={[0, index === 0 ? 2.3 : 2.12, 0]}
        width={selected ? 1.85 : 1.55}
      />
    </group>
  );
}
