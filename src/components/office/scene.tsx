"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useEffect } from "react";
import { Vector3 } from "three";
import type { OrbitControls as Controls } from "three-stdlib";
import type { AgentId } from "@/lib/office/schema";
import type { AgentPresence } from "@/lib/office/view";
import { crew, stationPoint } from "./orbital-model";
import { OrbitalWorld, Space } from "./orbital-world";
import { OrbitalRobot } from "./orbital-robot";
import { StellarWorld } from "./stellar-world";
import type { Destination } from "./stellar-data";
function ContextGuard({ onFailure }: { onFailure: () => void }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("webglcontextlost", onFailure);
    return () => canvas.removeEventListener("webglcontextlost", onFailure);
  }, [gl, onFailure]);
  return null;
}
function CameraRig({
  selected,
  focus,
  meeting,
  animate,
  tour,
  reset,
  mapMode,
  destinationNode,
}: {
  selected: AgentId;
  focus: number;
  meeting: boolean;
  animate: boolean;
  tour: boolean;
  reset: number;
  mapMode: boolean;
  destinationNode?: Destination;
}) {
  const controls = useRef<Controls>(null),
    flight = useRef(true);
  const { camera, invalidate, size } = useThree();
  const target = useRef(new Vector3()),
    destination = useRef(new Vector3(15, 16, 20));
  useEffect(() => {
    const narrow = size.width < 650;
    if (destinationNode) {
      const [x, y, z] = destinationNode.position;
      target.current.set(x, y, z);
      destination.current.set(x + 8, y + 11, z + 17);
    } else if (focus > 0) {
      const p = stationPoint(
        crew.findIndex((c) => c.id === selected),
        meeting ? 2.3 : 4.65,
      );
      target.current.set(p[0], 1, p[2]);
      destination.current.set(p[0] + 5, 5.5, p[2] + 7);
    } else if (mapMode) {
      target.current.set(0, 0, 0);
      destination.current.set(
        narrow ? 58 : 34,
        narrow ? 85 : 62,
        narrow ? 85 : 65,
      );
    } else {
      target.current.set(0, 0, 0);
      destination.current.set(
        narrow ? 19 : 15,
        narrow ? 21 : 16,
        narrow ? 25 : 20,
      );
    }
    flight.current = true;
    invalidate();
  }, [
    selected,
    focus,
    meeting,
    size.width,
    invalidate,
    reset,
    mapMode,
    destinationNode,
  ]);
  useFrame((_, dt) => {
    if (!controls.current) return;
    if (flight.current) {
      const e = animate ? 1 - Math.exp(-Math.min(dt, 0.05) * 3) : 1;
      camera.position.lerp(destination.current, e);
      controls.current.target.lerp(target.current, e);
      controls.current.update();
      if (camera.position.distanceTo(destination.current) < 0.03)
        flight.current = false;
      else invalidate();
    }
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan
      minDistance={4}
      maxDistance={150}
      minPolarAngle={0.15}
      maxPolarAngle={1.45}
      enableDamping={animate}
      dampingFactor={0.08}
      autoRotate={tour && animate}
      autoRotateSpeed={1.4}
      onStart={() => {
        flight.current = false;
      }}
    />
  );
}
export default function Scene({
  agents,
  selected,
  onSelect,
  animate,
  onFailure,
  meeting,
  greeting,
  focus,
  tour,
  alternate,
  onOrbit,
  reset,
  mapMode = false,
  destinations = [],
  selectedDestination = null,
  onSelectDestination = () => {},
}: {
  agents: AgentPresence[];
  selected: AgentId;
  onSelect: (id: AgentId) => void;
  animate: boolean;
  onFailure: () => void;
  meeting: boolean;
  greeting: number;
  focus: number;
  tour: boolean;
  alternate: boolean;
  onOrbit: () => void;
  reset: number;
  mapMode?: boolean;
  destinations?: Destination[];
  selectedDestination?: string | null;
  onSelectDestination?: (node: Destination) => void;
}) {
  useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [15, 16, 20], fov: 43, near: 0.1, far: 240 }}
      frameloop={animate ? "always" : "demand"}
      fallback={<div>3D indisponível. Use a lista de agentes abaixo.</div>}
    >
      <ContextGuard onFailure={onFailure} />
      <color attach="background" args={["#060e18"]} />
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#bddef1", "#354b5a", 1.4]} />
      <directionalLight position={[5, 14, 8]} color="#e9f0e9" intensity={3.4} />
      <directionalLight position={[-9, 6, -9]} color="#779fcd" intensity={3} />
      <pointLight
        position={[0, 3, 0]}
        color="#7db8cb"
        intensity={6}
        distance={9}
      />
      <Space animate={animate} alternate={alternate} showPlanet={false} />
      <group>
        <OrbitalWorld
          animate={animate}
          meeting={meeting}
          onOrbit={onOrbit}
          onSelect={(i) => onSelect(crew[i].id)}
        />
        {crew.map((c, i) => (
          <OrbitalRobot
            key={c.id}
            index={i}
            selected={selected === c.id}
            onSelect={() => onSelect(c.id)}
            animate={animate}
            meeting={meeting}
            greeting={greeting}
            presence={agents.find((a) => a.id === c.id)!}
          />
        ))}
      </group>
      {destinations.length > 0 && (
        <StellarWorld
          nodes={destinations}
          selected={selectedDestination}
          onSelect={onSelectDestination}
          animate={animate}
          showLabels={mapMode && focus === 0 && !selectedDestination}
        />
      )}
      <CameraRig
        reset={reset}
        selected={selected}
        focus={focus}
        meeting={meeting}
        animate={animate}
        tour={tour}
        mapMode={mapMode}
        destinationNode={destinations.find((n) => n.id === selectedDestination)}
      />
    </Canvas>
  );
}
