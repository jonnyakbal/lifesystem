"use client";
import { useEffect, useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import { CanvasTexture, LinearFilter } from "three";
export type Vec3 = [number, number, number];
export function Panel({
  position = [0, 0, 0],
  size,
  color = "#cbd1d1",
  rotation = [0, 0, 0],
  glow = 0,
  rounded = false,
}: {
  position?: Vec3;
  size: Vec3;
  color?: string;
  rotation?: Vec3;
  glow?: number;
  rounded?: boolean;
}) {
  const material = (
    <meshStandardMaterial
      color={color}
      metalness={glow ? 0.2 : 0.55}
      roughness={0.38}
      emissive={color}
      emissiveIntensity={glow}
    />
  );
  return rounded ? (
    <RoundedBox
      position={position}
      args={size}
      radius={Math.min(...size) * 0.2}
      smoothness={2}
      rotation={rotation}
    >
      {material}
    </RoundedBox>
  ) : (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      {material}
    </mesh>
  );
}
export function Ring({
  radius,
  color = "#689da8",
  position = [0, 0, 0],
  rotation = [-Math.PI / 2, 0, 0],
  tube = 0.015,
  glow = 1,
}: {
  radius: number;
  color?: string;
  position?: Vec3;
  rotation?: Vec3;
  tube?: number;
  glow?: number;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <torusGeometry args={[radius, tube, 6, 64]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={glow}
        metalness={0.5}
        roughness={0.3}
      />
    </mesh>
  );
}
export function Orb({
  position = [0, 0, 0],
  radius = 0.1,
  color = "#84dce6",
  glow = 1,
}: {
  position?: Vec3;
  radius?: number;
  color?: string;
  glow?: number;
}) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 16, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={glow}
        metalness={0.5}
        roughness={0.3}
      />
    </mesh>
  );
}
export function Tag({
  text,
  sub,
  color = "#8ac5ce",
  position = [0, 2.4, 0],
  width = 2.3,
}: {
  text: string;
  sub?: string;
  color?: string;
  position?: Vec3;
  width?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#09121deb";
    ctx.beginPath();
    ctx.roundRect(1, 1, 510, 126, 9);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 127);
    ctx.lineTo(512, 127);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#eef3f1";
    ctx.font = "500 38px monospace";
    ctx.fillText(text, 256, 54);
    ctx.fillStyle = color;
    ctx.font = "22px monospace";
    ctx.fillText(sub || "", 256, 97);
    const map = new CanvasTexture(canvas);
    map.minFilter = LinearFilter;
    return map;
  }, [text, sub, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[width, width / 4, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}
