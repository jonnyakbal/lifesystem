"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useMemo, useEffect } from "react";
import { CanvasTexture, LinearFilter, type Group } from "three";
import type { AgentId } from "@/lib/office/schema";
import type { AgentPresence } from "@/lib/office/view";
import { stateLabels } from "@/lib/office/view";
import { colors } from "./agent-sheet";
const stations: {
  id: AgentId;
  name: string;
  position: [number, number, number];
}[] = [
  { id: "vega", name: "Vega", position: [-3.5, 0, -2.2] },
  { id: "sirius", name: "Sirius", position: [0, 0, -2.2] },
  { id: "orion", name: "Órion", position: [3.5, 0, -2.2] },
  { id: "astro", name: "Astro", position: [-3.5, 0, 1.6] },
  { id: "hermes", name: "Hermes", position: [0, 0, 1.6] },
  { id: "cosmo", name: "Cosmo", position: [3.5, 0, 1.6] },
];
function Box({
  position,
  size,
  color,
  ...rest
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} {...rest} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.75} />
    </mesh>
  );
}
function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.23, 0.6, 12]} />
        <meshStandardMaterial color="#c7ad92" />
      </mesh>
      {[-1, 0, 1].map((i) => (
        <mesh
          key={i}
          position={[i * 0.15, 0.85 + Math.abs(i) * 0.08, 0]}
          rotation={[0, 0, -i * 0.4]}
          castShadow
        >
          <sphereGeometry args={[0.25, 8, 8]} />
          <meshStandardMaterial color={i === 0 ? "#567962" : "#739681"} />
        </mesh>
      ))}
    </group>
  );
}
function Label({
  name,
  status,
  selected,
}: {
  name: string;
  status: string;
  selected: boolean;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 112;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = selected ? "#345548" : "#faf7ef";
    ctx.beginPath();
    ctx.roundRect(2, 2, 380, 108, 18);
    ctx.fill();
    ctx.fillStyle = selected ? "#fff8e8" : "#283c37";
    ctx.font = "500 34px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(name, 192, 46);
    ctx.font = "22px sans-serif";
    ctx.fillText(status, 192, 84);
    const map = new CanvasTexture(canvas);
    map.minFilter = LinearFilter;
    return map;
  }, [name, status, selected]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={[0, 2.25, 0.4]} scale={[2.25, 0.66, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}
function Robot({
  color,
  active,
  motion,
}: {
  color: string;
  active: boolean;
  motion: boolean;
}) {
  const robot = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (robot.current && active && motion)
      robot.current.rotation.z = Math.sin(clock.elapsedTime * 3) * 0.025;
  });
  return (
    <group ref={robot} position={[0, 0, 1]}>
      <Box position={[0, 0.83, 0]} size={[0.55, 0.65, 0.4]} color={color} />
      <Box position={[0, 1.42, 0]} size={[0.78, 0.53, 0.55]} color={color} />
      <Box
        position={[0, 1.44, 0.284]}
        size={[0.57, 0.29, 0.02]}
        color="#253334"
      />
      {[-1, 1].map((i) => (
        <group key={i}>
          <Box
            position={[i * 0.14, 1.47, 0.305]}
            size={[0.075, 0.07, 0.03]}
            color={active ? "#baffd0" : "#f3e4c9"}
          />
          <Box
            position={[i * 0.17, 0.27, 0]}
            size={[0.17, 0.42, 0.2]}
            color="#465454"
          />
          <Box
            position={[i * 0.38, 0.8, 0.1]}
            size={[0.13, 0.45, 0.15]}
            color={color}
            rotation={[active ? -1 : 0, 0, i * 0.12]}
          />
        </group>
      ))}
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 0.8 : 0.05}
        />
      </mesh>
    </group>
  );
}
function Station({
  station,
  presence,
  selected,
  onSelect,
  motion,
}: {
  station: (typeof stations)[number];
  presence: AgentPresence;
  selected: boolean;
  onSelect: (id: AgentId) => void;
  motion: boolean;
}) {
  const color = colors[station.id];
  const active = presence.state === "working";
  return (
    <group
      position={station.position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(station.id);
      }}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0.4]}>
        <circleGeometry args={[1.38, 40]} />
        <meshStandardMaterial
          color={selected ? "#837659" : "#aaa291"}
          roughness={1}
        />
      </mesh>
      <Box position={[0, 0.95, 0]} size={[2.3, 0.14, 1.2]} color="#c7a982" />
      {[-1, 1].map((i) => (
        <Box
          key={i}
          position={[i * 0.9, 0.45, 0]}
          size={[0.09, 0.9, 0.7]}
          color="#515a51"
        />
      ))}
      <Box
        position={[0, 1.42, -0.22]}
        size={[0.95, 0.66, 0.08]}
        color="#354541"
      />
      <Box
        position={[0, 1.44, -0.172]}
        size={[0.81, 0.51, 0.015]}
        color={active ? color : "#566863"}
      />
      <Box
        position={[0, 1.13, -0.23]}
        size={[0.1, 0.25, 0.1]}
        color="#354541"
      />
      <Box
        position={[0.6, 1.045, 0.25]}
        size={[0.37, 0.02, 0.24]}
        color={color}
      />
      <mesh position={[-0.8, 1.14, 0.3]} castShadow>
        <cylinderGeometry args={[0.1, 0.09, 0.23, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Robot color={color} active={active} motion={motion} />
      {station.id === "astro" &&
        [0, 1, 2].map((i) => (
          <Box
            key={i}
            position={[-0.78, 1.05 + i * 0.075, -0.25]}
            size={[0.42, 0.07, 0.38]}
            color={i % 2 ? "#ccb992" : "#7f8a9a"}
          />
        ))}
      {station.id === "cosmo" && (
        <Box
          position={[0.78, 1.3, -0.22]}
          size={[0.33, 0.52, 0.04]}
          color="#ede2ca"
          rotation={[-0.15, 0, 0]}
        />
      )}
      <Label
        name={station.name}
        status={stateLabels[presence.state]}
        selected={selected}
      />
    </group>
  );
}
export default function Scene({
  agents,
  selected,
  onSelect,
  animate,
  onFailure,
}: {
  agents: AgentPresence[];
  selected: AgentId;
  onSelect: (id: AgentId) => void;
  animate: boolean;
  onFailure: () => void;
}) {
  return (
    <Canvas
      orthographic
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [13, 14, 17], zoom: 43, near: 0.1, far: 100 }}
      frameloop={
        animate && agents.some((a) => a.state === "working")
          ? "always"
          : "demand"
      }
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", onFailure, {
          once: true,
        });
      }}
      fallback={<div>3D indisponível. Use a lista de agentes abaixo.</div>}
    >
      <color attach="background" args={["#ded8c9"]} />
      <ambientLight intensity={1.5} />
      <directionalLight
        position={[5, 12, 8]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <group position={[0, -0.1, 0]}>
        <Box position={[0, -0.2, 0]} size={[13, 0.4, 10]} color="#c1b49e" />
        <Box position={[0, 0, 0]} size={[12.8, 0.06, 9.8]} color="#d5c6ae" />
        <Box
          position={[0, 1.25, -4.9]}
          size={[12.9, 2.5, 0.16]}
          color="#abb9ac"
        />
        <Box
          position={[-6.4, 1.25, 0]}
          size={[0.16, 2.5, 10]}
          color="#c1c9b9"
        />
        {[-4.2, -0.7, 2.8].map((x) => (
          <group key={x}>
            <Box
              position={[x, 1.65, -4.77]}
              size={[2.3, 1.25, 0.04]}
              color="#edf0dd"
            />
            <Box
              position={[x, 1.65, -4.73]}
              size={[0.06, 1.3, 0.06]}
              color="#7d998c"
            />
          </group>
        ))}
        <Plant position={[-5.6, 0, -3.6]} />
        <Plant position={[5.7, 0, -3.8]} />
        <Plant position={[-5.7, 0, 3.7]} />
        <Plant position={[5.7, 0, 3.7]} />
        <Box position={[-6, 1, 1]} size={[0.5, 1.9, 2.3]} color="#96846a" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Box
            key={i}
            position={[-5.69, 1.15, -0.02 + i * 0.37]}
            size={[0.13, 0.63, 0.18]}
            color={["#9487a2", "#dbc18f", "#8faaa0", "#cb9984", "#91aab7"][i]}
          />
        ))}
        {stations.map((station) => (
          <Station
            key={station.id}
            station={station}
            presence={agents.find((a) => a.id === station.id)!}
            selected={selected === station.id}
            onSelect={onSelect}
            motion={animate}
          />
        ))}
      </group>
      <OrbitControls
        makeDefault
        enablePan={false}
        minZoom={28}
        maxZoom={80}
        minPolarAngle={0.35}
        maxPolarAngle={1.2}
        target={[0, 0, 0]}
        enableDamping={false}
      />
    </Canvas>
  );
}
