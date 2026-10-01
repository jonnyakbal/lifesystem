"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group } from "three";
import { crew, stationPoint } from "./orbital-model";
import { Panel, Ring, Orb, Tag } from "./orbital-parts";
export function Space({
  animate,
  alternate,
  showPlanet = true,
}: {
  animate: boolean;
  alternate: boolean;
  showPlanet?: boolean;
}) {
  const planet = useRef<Group>(null);
  const stars = useMemo(() => {
    const data = new Float32Array(1800);
    for (let i = 0; i < 600; i++) {
      const a = i * 2.39996,
        b = Math.acos(1 - (2 * (i + 0.5)) / 600),
        r = 65 + 12 * Math.sin(i * 13);
      data[i * 3] = r * Math.sin(b) * Math.cos(a);
      data[i * 3 + 1] = r * Math.cos(b);
      data[i * 3 + 2] = r * Math.sin(b) * Math.sin(a);
    }
    return data;
  }, []);
  useFrame((_, dt) => {
    if (animate && planet.current)
      planet.current.rotation.z += Math.min(dt, 0.05) * 0.009;
  });
  return (
    <>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.11}
          color="#bdcddc"
          transparent
          opacity={0.72}
          sizeAttenuation
        />
      </points>
      <group position={[-13, 8, -24]} rotation={[0.2, 0, 0.4]} ref={planet} visible={showPlanet}>
        <mesh>
          <sphereGeometry args={[7, 48, 32]} />
          <meshStandardMaterial
            color={alternate ? "#b18962" : "#668c97"}
            roughness={0.87}
          />
        </mesh>
        <mesh scale={1.018}>
          <sphereGeometry args={[7, 32, 24]} />
          <meshBasicMaterial
            color={alternate ? "#bf9d80" : "#8dd9e3"}
            transparent
            opacity={0.08}
            wireframe
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[8.6, 12.5, 96]} />
          <meshBasicMaterial
            color={alternate ? "#b49d7d" : "#74888e"}
            transparent
            opacity={0.2}
            side={2}
            depthWrite={false}
          />
        </mesh>
        {[8.9, 9.3, 10.2, 11.4, 12].map((r) => (
          <Ring key={r} radius={r} tube={0.014} color="#93a9ad" glow={0.2} />
        ))}
      </group>
    </>
  );
}
function Console({ index, onSelect }: { index: number; onSelect: () => void }) {
  const spec = crew[index];
  return (
    <group
      position={stationPoint(index)}
      rotation={[0, (index * Math.PI) / 3 + Math.PI / 6, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[1.2, 1.35, 0.15, 6]} />
        <meshStandardMaterial color="#263a49" metalness={0.7} roughness={0.5} />
      </mesh>
      <Ring
        radius={1.25}
        color={spec.accent}
        position={[0, 0.13, 0]}
        glow={0.3}
      />
      <Panel
        position={[0, 0.58, 0.45]}
        size={[1.3, 1.05, 0.45]}
        color="#263742"
        rounded
      />
      <Panel
        position={[0, 1.14, 0.45]}
        size={[1.85, 0.16, 0.95]}
        color="#c3c9c8"
        rotation={[0.14, 0, 0]}
        rounded
      />
      <Panel
        position={[0, 1.26, 0.55]}
        size={[1.55, 0.02, 0.54]}
        color="#112631"
        rotation={[0.14, 0, 0]}
      />
      {[-1, 0, 1].map((i) => (
        <Panel
          key={i}
          position={[i * 0.43, 1.29, 0.51]}
          size={[0.28, 0.018, 0.3]}
          color={spec.accent}
          rotation={[0.14, 0, 0]}
          glow={0.4}
        />
      ))}
      <Panel
        position={[0, 1.82, 0.75]}
        size={[1.35, 0.8, 0.065]}
        color="#101e2a"
        rotation={[-0.12, 0, 0]}
        rounded
      />
      <Panel
        position={[0, 1.84, 0.701]}
        size={[1.15, 0.58, 0.018]}
        color="#254653"
        rotation={[-0.12, 0, 0]}
        glow={0.2}
      />
      {[0, 1, 2, 3].map((i) => (
        <Panel
          key={i}
          position={[-0.34 + i * 0.23, 1.8, 0.65]}
          size={[0.08, 0.15 + (i % 3) * 0.08, 0.022]}
          color={spec.accent}
          glow={0.65}
        />
      ))}
      <Panel
        position={[0, 1.45, 0.76]}
        size={[0.1, 0.38, 0.12]}
        color="#899b9f"
      />
      <Tag
        text={spec.code}
        sub={spec.specialty}
        color={spec.accent}
        position={[0, 0.36, -0.71]}
        width={1.45}
      />
      {index === 4 && (
        <group position={[1, 0.7, 0.65]} rotation={[-0.55, 0, -0.3]}>
          <mesh>
            <cylinderGeometry args={[0.14, 0.2, 1, 16]} />
            <meshStandardMaterial color="#c7ced2" metalness={0.7} />
          </mesh>
          <Orb position={[0, 0.53, 0]} radius={0.14} color={spec.accent} />
        </group>
      )}
      {index === 3 &&
        [0, 1, 2].map((i) => (
          <group key={i} position={[-0.75 + i * 0.32, 1.48, 0.77]}>
            <mesh>
              <cylinderGeometry args={[0.09, 0.09, 0.5, 12]} />
              <meshStandardMaterial
                color="#94b892"
                transparent
                opacity={0.45}
              />
            </mesh>
            <Orb radius={0.055} color="#a6ce94" />
          </group>
        ))}
    </group>
  );
}
function Orrery({
  animate,
  meeting,
  onOrbit,
}: {
  animate: boolean;
  meeting: boolean;
  onOrbit: () => void;
}) {
  const hub = useRef<Group>(null),
    packets = useRef<Group>(null),
    time = useRef(0);
  useFrame((_, dt) => {
    if (!animate) return;
    time.current += Math.min(dt, 0.05);
    if (hub.current) hub.current.rotation.y = time.current * 0.2;
    if (packets.current)
      packets.current.children.forEach((child, i) => {
        const a = (i * Math.PI) / 3 + Math.PI / 6,
          r = 1.4 + ((time.current * 0.45 + i * 0.19) % 1) * 3.6;
        child.position.set(Math.sin(a) * r, 0.2, Math.cos(a) * r);
      });
  });
  return (
    <>
      <group
        onClick={(e) => {
          e.stopPropagation();
          onOrbit();
        }}
      >
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[1.35, 1.55, 0.6, 48]} />
          <meshStandardMaterial
            color="#344c5a"
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
        <Ring radius={1.33} position={[0, 0.61, 0]} color="#9bc9d4" />
        <mesh position={[0, 0.61, 0]}>
          <cylinderGeometry args={[1.24, 1.24, 0.03, 48]} />
          <meshStandardMaterial
            color="#122b3b"
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
        <group position={[0, 1.6, 0]} ref={hub}>
          <mesh>
            <icosahedronGeometry args={[0.58, 1]} />
            <meshStandardMaterial
              color="#7495a6"
              wireframe
              emissive="#517e98"
              emissiveIntensity={1.1}
            />
          </mesh>
          <Orb radius={0.15} color="#c4e4e8" />
          <Ring radius={0.85} rotation={[1.1, 0, 0.3]} color="#85b6c3" />
          <Ring
            radius={0.74}
            rotation={[0.2, 0.6, 1.2]}
            color="#afbece"
            glow={0.6}
          />
          <Orb position={[0.82, 0, 0]} radius={0.045} color="#d9b576" />
        </group>
        <mesh position={[0, 1.17, 0]}>
          <cylinderGeometry args={[0.75, 0.22, 1.05, 32, 1, true]} />
          <meshBasicMaterial
            color="#7bafba"
            transparent
            opacity={0.035}
            depthWrite={false}
            side={2}
          />
        </mesh>
      </group>
      <group ref={packets} visible={meeting}>
        {crew.map((c) => (
          <Orb key={c.id} radius={0.055} color={c.accent} />
        ))}
      </group>
    </>
  );
}
export function OrbitalWorld({
  animate,
  meeting,
  onOrbit,
  onSelect,
}: {
  animate: boolean;
  meeting: boolean;
  onOrbit: () => void;
  onSelect: (index: number) => void;
}) {
  return (
    <>
      <mesh position={[0, -0.32, 0]}>
        <cylinderGeometry args={[8.5, 8.15, 0.6, 12]} />
        <meshStandardMaterial color="#243746" metalness={0.7} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.035, 0]}>
        <cylinderGeometry args={[8.12, 8.12, 0.07, 12]} />
        <meshStandardMaterial
          color="#182a37"
          metalness={0.6}
          roughness={0.55}
        />
      </mesh>
      {[2.75, 3.1, 7.7, 8.2].map((r, i) => (
        <Ring
          key={r}
          radius={r}
          position={[0, 0.016, 0]}
          color={i === 3 ? "#82a4b1" : "#334f61"}
          glow={i === 3 ? 0.65 : 0.05}
          tube={i === 3 ? 0.035 : 0.012}
        />
      ))}
      {Array.from({ length: 24 }, (_, i) => (
        <group key={i} rotation={[0, (i * Math.PI) / 12, 0]}>
          <Panel
            position={[0, 0.027, 7.75]}
            size={[0.055, 0.02, 0.35]}
            color={i % 2 ? "#506875" : "#d2c08e"}
            glow={0.15}
          />
        </group>
      ))}
      {crew.map((c, i) => (
        <group key={c.id} rotation={[0, (i * Math.PI) / 3 + Math.PI / 6, 0]}>
          <Panel
            position={[0, 0.017, 4.5]}
            size={[0.017, 0.012, 5.25]}
            color="#537c8e"
            glow={0.12}
          />
          <Panel
            position={[1.1, 0.017, 5.25]}
            size={[0.016, 0.012, 3.4]}
            color="#314a59"
          />
        </group>
      ))}
      {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI) / 12, 0]}>
          <Panel
            position={[0, 0.63, -8.05]}
            size={[2.02, 1.3, 0.15]}
            color="#3e5261"
            rounded
          />
          <Panel
            position={[0, 0.71, -7.958]}
            size={[1.6, 0.69, 0.025]}
            color="#607b86"
          />
          <Panel
            position={[0, 1.29, -8.02]}
            size={[2, 0.04, 0.1]}
            color="#a8c4c8"
            glow={0.4}
          />
        </group>
      ))}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 8.45, -0.34, 0]}>
          <Panel
            position={[s * 1.5, 0, 0]}
            size={[3.5, 0.1, 3]}
            color="#172734"
          />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Panel
              key={i}
              position={[s * (0.2 + i * 0.53), 0.065, 0]}
              size={[0.47, 0.035, 2.85]}
              color="#304c63"
            />
          ))}
          <Panel
            position={[0, -0.1, 0]}
            size={[0.1, 0.15, 3.5]}
            color="#7c8b96"
          />
        </group>
      ))}
      {crew.map((c, i) => (
        <Console key={c.id} index={i} onSelect={() => onSelect(i)} />
      ))}
      <Orrery animate={animate} meeting={meeting} onOrbit={onOrbit} />
    </>
  );
}
