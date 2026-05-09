"use client";

import { Canvas } from "@react-three/fiber";
import { Float, OrbitControls } from "@react-three/drei";

function Plant() {
  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <mesh>
        <cylinderGeometry args={[0.25, 0.4, 2.5]} />
        <meshStandardMaterial color="#14b8a6" />
      </mesh>

      <mesh position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshStandardMaterial color="#fbbf24" emissive="#14b8a6" />
      </mesh>
    </Float>
  );
}

export default function Plant3D() {
  return (
    <Canvas className="h-[260px]">
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 2, 2]} intensity={1.2} />
      <Plant />
      <OrbitControls enableZoom={false} />
    </Canvas>
  );
}