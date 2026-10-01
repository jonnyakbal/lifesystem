"use client";
import { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Group } from "three";
import { Ring, Tag } from "./orbital-parts";
import type { Destination } from "./stellar-data";

function CelestialBody({
  node,
  selected,
  onSelect,
  animate,
  showLabels,
}: {
  node: Destination;
  selected: boolean;
  onSelect: () => void;
  animate: boolean;
  showLabels: boolean;
}) {
  const body = useRef<Group>(null);
  useFrame((_, dt) => {
    if (body.current && animate)
      body.current.rotation.y += Math.min(dt, 0.05) * 0.09;
  });
  const stop = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  };
  const isPlanet = node.kind === "project";
  return (
    <group
      position={node.position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={stop}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <group ref={body}>
        {isPlanet ? (
          <>
            <mesh>
              <sphereGeometry args={[1.18, 32, 24]} />
              <meshStandardMaterial
                color={node.color}
                roughness={0.88}
                metalness={0.12}
                emissive={node.color}
                emissiveIntensity={selected ? 0.25 : 0.035}
              />
            </mesh>
            <mesh scale={1.05}>
              <sphereGeometry args={[1.18, 20, 12]} />
              <meshBasicMaterial
                color={node.color}
                wireframe
                transparent
                opacity={0.1}
              />
            </mesh>
            <Ring
              radius={1.7}
              tube={0.035}
              color={node.color}
              rotation={[1.15, 0.2, 0.25]}
              glow={0.6}
            />
            <Ring
              radius={1.83}
              tube={0.009}
              color={node.color}
              rotation={[1.15, 0.2, 0.25]}
              glow={0.3}
            />
            <mesh position={[1.9, 0.35, 0.5]}>
              <sphereGeometry args={[0.16, 12, 8]} />
              <meshStandardMaterial color="#bbc9d1" />
            </mesh>
          </>
        ) : node.kind === "pillar" ? (
          <>
            <Line
              points={[
                [-1.3, 0, 0],
                [-0.5, 0.9, 0.1],
                [0.4, 0.15, -0.3],
                [1.35, 1, 0.2],
                [1, 0.1, 0.6],
                [-1.3, 0, 0],
              ]}
              color={node.color}
              lineWidth={1}
              transparent
              opacity={0.6}
            />
            {[
              [-1.3, 0, 0],
              [-0.5, 0.9, 0.1],
              [0.4, 0.15, -0.3],
              [1.35, 1, 0.2],
              [1, 0.1, 0.6],
            ].map((p, i) => (
              <mesh key={i} position={p as [number, number, number]}>
                <sphereGeometry args={[i === 2 ? 0.25 : 0.12, 12, 8]} />
                <meshBasicMaterial color={node.color} />
              </mesh>
            ))}
          </>
        ) : (
          <>
            <mesh>
              <octahedronGeometry args={[0.65, 0]} />
              <meshStandardMaterial
                color="#ccd5d5"
                metalness={0.7}
                roughness={0.3}
              />
            </mesh>
            {[-1, 1].map((v) => (
              <group key={v} position={[v * 1.1, 0, 0]}>
                <mesh>
                  <boxGeometry args={[1.1, 0.055, 0.7]} />
                  <meshStandardMaterial
                    color="#254963"
                    metalness={0.65}
                    roughness={0.38}
                  />
                </mesh>
                {[-0.3, 0, 0.3].map((x) => (
                  <mesh key={x} position={[x, 0.035, 0]}>
                    <boxGeometry args={[0.02, 0.01, 0.69]} />
                    <meshBasicMaterial color={node.color} />
                  </mesh>
                ))}
              </group>
            ))}
            <Ring
              radius={0.85}
              color={node.color}
              rotation={[0, 0, 0]}
              tube={0.02}
            />
          </>
        )}
      </group>
      {selected && (
        <Ring
          radius={2.2}
          color="#e3ecec"
          tube={0.025}
          position={[0, -0.6, 0]}
        />
      )}
      {(showLabels || selected) && (
        <Tag
          text={
            node.name.length > 23 ? node.name.slice(0, 21) + "…" : node.name
          }
          sub={
            isPlanet
              ? "PROJETO"
              : node.kind === "pillar"
                ? "PILAR"
                : "FERRAMENTA"
          }
          color={node.color}
          width={selected ? 4.2 : 7}
          position={[0, 2.5, 0]}
        />
      )}
      {/* A larger invisible hit area makes small satellites usable with touch. */}
      <mesh visible={false}>
        <sphereGeometry args={[2.1, 8, 6]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

export function StellarWorld({
  nodes,
  selected,
  onSelect,
  animate,
  showLabels = true,
}: {
  nodes: Destination[];
  selected: string | null;
  onSelect: (node: Destination) => void;
  animate: boolean;
  showLabels?: boolean;
}) {
  return (
    <group>
      {[18, 28, 38].map((r, i) => (
        <Ring
          key={r}
          radius={r}
          color={i === 0 ? "#66969d" : "#3b5467"}
          glow={0.25}
          tube={0.014}
          position={[0, -1.9, 0]}
        />
      ))}
      <mesh position={[0, -2.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[5.5, 64]} />
        <meshBasicMaterial color="#0f2433" transparent opacity={0.65} />
      </mesh>
      {showLabels && (
        <Tag
          text="ESTAÇÃO JONNY"
          sub="SEU CENTRO DE OPERAÇÕES"
          color="#afc8d0"
          width={4.5}
          position={[0, 3, 0]}
        />
      )}
      {nodes.map((n) => (
        <CelestialBody
          key={n.id}
          node={n}
          selected={selected === n.id}
          onSelect={() => onSelect(n)}
          animate={animate}
          showLabels={showLabels}
        />
      ))}
    </group>
  );
}
