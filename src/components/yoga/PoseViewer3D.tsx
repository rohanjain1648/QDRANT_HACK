import { useRef, useState, Suspense, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { motion } from "framer-motion";
import { RotateCcw, Eye, Bone, Dumbbell, Loader2, Play, Pause, SkipForward, SkipBack } from "lucide-react";
import { cn } from "@/lib/utils";

interface MuscleGroup {
  name: string;
  active: boolean;
  intensity: "primary" | "secondary" | "stretched";
}

interface PoseViewer3DProps {
  poseName: string;
  poseId: string;
  muscleGroups?: MuscleGroup[];
  enableFlowMode?: boolean;
  flowSequence?: string[];
  onPoseChange?: (poseId: string, index: number) => void;
}

// Pose configurations with positions and rotations
type BodyPartConfig = {
  position: [number, number, number];
  rotation: [number, number, number];
};

type PoseConfig = {
  torso: BodyPartConfig;
  head: BodyPartConfig;
  leftArm: BodyPartConfig;
  rightArm: BodyPartConfig;
  leftLeg: BodyPartConfig;
  rightLeg: BodyPartConfig;
};

const poseConfigurations: { [poseId: string]: PoseConfig } = {
  mountain: {
    torso: { position: [0, 0.9, 0], rotation: [0, 0, 0] },
    head: { position: [0, 1.55, 0], rotation: [0, 0, 0] },
    leftArm: { position: [-0.35, 0.7, 0], rotation: [0, 0, 0.1] },
    rightArm: { position: [0.35, 0.7, 0], rotation: [0, 0, -0.1] },
    leftLeg: { position: [-0.15, -0.1, 0], rotation: [0, 0, 0] },
    rightLeg: { position: [0.15, -0.1, 0], rotation: [0, 0, 0] },
  },
  warrior2: {
    torso: { position: [0, 0.6, 0], rotation: [0, 0, 0] },
    head: { position: [0.1, 1.25, 0], rotation: [0, -0.5, 0] },
    leftArm: { position: [-0.6, 0.95, 0], rotation: [0, 0, Math.PI / 2] },
    rightArm: { position: [0.6, 0.95, 0], rotation: [0, 0, -Math.PI / 2] },
    leftLeg: { position: [-0.4, -0.2, 0], rotation: [0, 0, 0.3] },
    rightLeg: { position: [0.35, -0.15, 0.15], rotation: [-0.8, 0, -0.2] },
  },
  warrior1: {
    torso: { position: [0, 0.65, 0], rotation: [0, 0.2, 0] },
    head: { position: [0, 1.3, 0], rotation: [-0.1, 0, 0] },
    leftArm: { position: [-0.15, 1.5, 0], rotation: [-2.8, 0, 0.15] },
    rightArm: { position: [0.15, 1.5, 0], rotation: [-2.8, 0, -0.15] },
    leftLeg: { position: [-0.15, -0.1, -0.3], rotation: [0.3, 0, 0] },
    rightLeg: { position: [0.2, -0.1, 0.25], rotation: [-0.9, 0, 0] },
  },
  tree: {
    torso: { position: [0, 0.9, 0], rotation: [0, 0, 0] },
    head: { position: [0, 1.55, 0], rotation: [0, 0, 0] },
    leftArm: { position: [-0.1, 1.4, 0.1], rotation: [-0.3, 0, 0.2] },
    rightArm: { position: [0.1, 1.4, 0.1], rotation: [-0.3, 0, -0.2] },
    leftLeg: { position: [-0.15, -0.1, 0], rotation: [0, 0, 0] },
    rightLeg: { position: [0.08, 0.2, 0.15], rotation: [0, 0.8, -1.2] },
  },
  triangle: {
    torso: { position: [0, 0.7, 0], rotation: [0, 0, 0.8] },
    head: { position: [-0.4, 1.1, 0], rotation: [0, 0, 0.6] },
    leftArm: { position: [-0.6, 0.3, 0], rotation: [0, 0, 1.2] },
    rightArm: { position: [0.4, 1.4, 0], rotation: [0, 0, -0.5] },
    leftLeg: { position: [-0.35, -0.2, 0], rotation: [0, 0, 0.2] },
    rightLeg: { position: [0.35, -0.2, 0], rotation: [0, 0, -0.1] },
  },
  child: {
    torso: { position: [0, 0.15, 0.2], rotation: [1.2, 0, 0] },
    head: { position: [0, 0.05, 0.6], rotation: [1.4, 0, 0] },
    leftArm: { position: [-0.25, 0.02, 0.7], rotation: [0.1, 0, 0] },
    rightArm: { position: [0.25, 0.02, 0.7], rotation: [0.1, 0, 0] },
    leftLeg: { position: [-0.15, 0.1, -0.3], rotation: [-2.2, 0, 0] },
    rightLeg: { position: [0.15, 0.1, -0.3], rotation: [-2.2, 0, 0] },
  },
  downdog: {
    torso: { position: [0, 0.7, 0], rotation: [1.0, 0, 0] },
    head: { position: [0, 0.4, 0.45], rotation: [0.5, 0, 0] },
    leftArm: { position: [-0.2, 0.1, 0.7], rotation: [0.3, 0, 0.1] },
    rightArm: { position: [0.2, 0.1, 0.7], rotation: [0.3, 0, -0.1] },
    leftLeg: { position: [-0.15, 0.2, -0.5], rotation: [-0.7, 0, 0] },
    rightLeg: { position: [0.15, 0.2, -0.5], rotation: [-0.7, 0, 0] },
  },
  cobra: {
    torso: { position: [0, 0.25, 0], rotation: [-0.6, 0, 0] },
    head: { position: [0, 0.65, 0.2], rotation: [-0.4, 0, 0] },
    leftArm: { position: [-0.3, 0.1, 0.1], rotation: [-0.8, 0, 0.4] },
    rightArm: { position: [0.3, 0.1, 0.1], rotation: [-0.8, 0, -0.4] },
    leftLeg: { position: [-0.15, -0.05, -0.4], rotation: [0.1, 0, 0] },
    rightLeg: { position: [0.15, -0.05, -0.4], rotation: [0.1, 0, 0] },
  },
  bridge: {
    torso: { position: [0, 0.4, 0], rotation: [-0.3, 0, 0] },
    head: { position: [0, 0.05, 0.4], rotation: [0.2, 0, 0] },
    leftArm: { position: [-0.35, 0.05, 0.1], rotation: [0.1, 0, 0.3] },
    rightArm: { position: [0.35, 0.05, 0.1], rotation: [0.1, 0, -0.3] },
    leftLeg: { position: [-0.2, 0.15, -0.35], rotation: [-1.2, 0, 0] },
    rightLeg: { position: [0.2, 0.15, -0.35], rotation: [-1.2, 0, 0] },
  },
  seatedforward: {
    torso: { position: [0, 0.25, 0.15], rotation: [1.0, 0, 0] },
    head: { position: [0, 0.15, 0.55], rotation: [1.2, 0, 0] },
    leftArm: { position: [-0.15, 0.08, 0.7], rotation: [0.2, 0, 0] },
    rightArm: { position: [0.15, 0.08, 0.7], rotation: [0.2, 0, 0] },
    leftLeg: { position: [-0.15, 0.02, 0.1], rotation: [0.2, 0, 0] },
    rightLeg: { position: [0.15, 0.02, 0.1], rotation: [0.2, 0, 0] },
  },
  cat: {
    torso: { position: [0, 0.5, 0], rotation: [0.3, 0, 0] },
    head: { position: [0, 0.35, 0.35], rotation: [0.8, 0, 0] },
    leftArm: { position: [-0.2, 0.02, 0.3], rotation: [0.1, 0, 0.1] },
    rightArm: { position: [0.2, 0.02, 0.3], rotation: [0.1, 0, -0.1] },
    leftLeg: { position: [-0.15, 0.1, -0.35], rotation: [-1.5, 0, 0] },
    rightLeg: { position: [0.15, 0.1, -0.35], rotation: [-1.5, 0, 0] },
  },
  cow: {
    torso: { position: [0, 0.45, 0], rotation: [-0.2, 0, 0] },
    head: { position: [0, 0.65, 0.3], rotation: [-0.5, 0, 0] },
    leftArm: { position: [-0.2, 0.02, 0.3], rotation: [0.1, 0, 0.1] },
    rightArm: { position: [0.2, 0.02, 0.3], rotation: [0.1, 0, -0.1] },
    leftLeg: { position: [-0.15, 0.1, -0.35], rotation: [-1.5, 0, 0] },
    rightLeg: { position: [0.15, 0.1, -0.35], rotation: [-1.5, 0, 0] },
  },
  plank: {
    torso: { position: [0, 0.35, 0], rotation: [0.1, 0, 0] },
    head: { position: [0, 0.45, 0.35], rotation: [0.2, 0, 0] },
    leftArm: { position: [-0.25, 0.02, 0.35], rotation: [0.05, 0, 0.1] },
    rightArm: { position: [0.25, 0.02, 0.35], rotation: [0.05, 0, -0.1] },
    leftLeg: { position: [-0.15, 0.2, -0.6], rotation: [0.1, 0, 0] },
    rightLeg: { position: [0.15, 0.2, -0.6], rotation: [0.1, 0, 0] },
  },
  boat: {
    torso: { position: [0, 0.25, 0], rotation: [-0.6, 0, 0] },
    head: { position: [0, 0.65, 0.15], rotation: [-0.3, 0, 0] },
    leftArm: { position: [-0.25, 0.35, 0.3], rotation: [-0.8, 0, 0.2] },
    rightArm: { position: [0.25, 0.35, 0.3], rotation: [-0.8, 0, -0.2] },
    leftLeg: { position: [-0.15, 0.35, 0.4], rotation: [-0.9, 0, 0] },
    rightLeg: { position: [0.15, 0.35, 0.4], rotation: [-0.9, 0, 0] },
  },
};

const defaultPose: PoseConfig = poseConfigurations.mountain;

// Lerp helper for smooth transitions
const lerpValue = (start: number, end: number, t: number): number => {
  return start + (end - start) * t;
};

const lerpArray = (start: [number, number, number], end: [number, number, number], t: number): [number, number, number] => {
  return [
    lerpValue(start[0], end[0], t),
    lerpValue(start[1], end[1], t),
    lerpValue(start[2], end[2], t),
  ];
};

// Animated body part component
const AnimatedBodyPart = ({
  targetPosition,
  targetRotation,
  children,
  transitionSpeed = 3,
}: {
  targetPosition: [number, number, number];
  targetRotation: [number, number, number];
  children: React.ReactNode;
  transitionSpeed?: number;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const currentPos = useRef<[number, number, number]>([...targetPosition]);
  const currentRot = useRef<[number, number, number]>([...targetRotation]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const t = Math.min(1, delta * transitionSpeed);
    
    currentPos.current = lerpArray(currentPos.current, targetPosition, t);
    currentRot.current = lerpArray(currentRot.current, targetRotation, t);

    groupRef.current.position.set(...currentPos.current);
    groupRef.current.rotation.set(...currentRot.current);
  });

  return (
    <group ref={groupRef} position={targetPosition} rotation={targetRotation}>
      {children}
    </group>
  );
};

// Human Figure with smooth animated transitions
const HumanFigure = ({ 
  showSkeleton, 
  muscleGroups,
  highlightMuscles,
  poseId,
  transitionSpeed = 3,
}: { 
  showSkeleton: boolean;
  muscleGroups: MuscleGroup[];
  highlightMuscles: boolean;
  poseId: string;
  transitionSpeed?: number;
}) => {
  const poseConfig = poseConfigurations[poseId] || defaultPose;
  
  const getMuscleColor = (intensity: "primary" | "secondary" | "stretched") => {
    switch (intensity) {
      case "primary": return "#ef4444";
      case "secondary": return "#f59e0b";
      case "stretched": return "#3b82f6";
      default: return "#94a3b8";
    }
  };

  const getPartColor = (muscleName: string) => {
    if (!highlightMuscles) return "#d4a574";
    
    const muscleGroup = muscleGroups.find(
      m => m.active && m.name.toLowerCase().includes(muscleName.toLowerCase())
    );
    
    if (muscleGroup) {
      return getMuscleColor(muscleGroup.intensity);
    }
    
    return "#d4a574";
  };

  const materialProps = {
    transparent: true,
    opacity: showSkeleton ? 0.3 : 0.95,
    roughness: 0.6,
    metalness: 0.1,
  };

  return (
    <group position={[0, 0.5, 0]}>
      {/* Torso */}
      <AnimatedBodyPart 
        targetPosition={poseConfig.torso.position} 
        targetRotation={poseConfig.torso.rotation}
        transitionSpeed={transitionSpeed}
      >
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[0.45, 0.35, 0.22]} />
          <meshStandardMaterial color={getPartColor("chest")} {...materialProps} />
        </mesh>
        <mesh position={[0, -0.1, 0]}>
          <boxGeometry args={[0.4, 0.3, 0.2]} />
          <meshStandardMaterial color={getPartColor("core")} {...materialProps} />
        </mesh>
        <mesh position={[0, -0.35, 0]}>
          <boxGeometry args={[0.45, 0.2, 0.22]} />
          <meshStandardMaterial color={getPartColor("hips")} {...materialProps} />
        </mesh>
      </AnimatedBodyPart>

      {/* Head */}
      <AnimatedBodyPart 
        targetPosition={poseConfig.head.position} 
        targetRotation={poseConfig.head.rotation}
        transitionSpeed={transitionSpeed}
      >
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.06, 0.08, 0.12, 16]} />
          <meshStandardMaterial color={getPartColor("neck")} {...materialProps} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.14, 32, 32]} />
          <meshStandardMaterial color={getPartColor("head")} {...materialProps} />
        </mesh>
      </AnimatedBodyPart>

      {/* Left Arm */}
      <AnimatedBodyPart 
        targetPosition={poseConfig.leftArm.position} 
        targetRotation={poseConfig.leftArm.rotation}
        transitionSpeed={transitionSpeed}
      >
        <mesh position={[0, 0.35, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color={getPartColor("shoulders")} {...materialProps} />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <capsuleGeometry args={[0.05, 0.25, 8, 16]} />
          <meshStandardMaterial color={getPartColor("biceps")} {...materialProps} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshStandardMaterial color={getPartColor("biceps")} {...materialProps} />
        </mesh>
        <mesh position={[0, -0.22, 0]}>
          <capsuleGeometry args={[0.04, 0.22, 8, 16]} />
          <meshStandardMaterial color={getPartColor("forearms")} {...materialProps} />
        </mesh>
        <mesh position={[0, -0.42, 0]}>
          <boxGeometry args={[0.06, 0.1, 0.03]} />
          <meshStandardMaterial color={getPartColor("hands")} {...materialProps} />
        </mesh>
      </AnimatedBodyPart>

      {/* Right Arm */}
      <AnimatedBodyPart 
        targetPosition={poseConfig.rightArm.position} 
        targetRotation={poseConfig.rightArm.rotation}
        transitionSpeed={transitionSpeed}
      >
        <mesh position={[0, 0.35, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color={getPartColor("shoulders")} {...materialProps} />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <capsuleGeometry args={[0.05, 0.25, 8, 16]} />
          <meshStandardMaterial color={getPartColor("biceps")} {...materialProps} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshStandardMaterial color={getPartColor("biceps")} {...materialProps} />
        </mesh>
        <mesh position={[0, -0.22, 0]}>
          <capsuleGeometry args={[0.04, 0.22, 8, 16]} />
          <meshStandardMaterial color={getPartColor("forearms")} {...materialProps} />
        </mesh>
        <mesh position={[0, -0.42, 0]}>
          <boxGeometry args={[0.06, 0.1, 0.03]} />
          <meshStandardMaterial color={getPartColor("hands")} {...materialProps} />
        </mesh>
      </AnimatedBodyPart>

      {/* Left Leg */}
      <AnimatedBodyPart 
        targetPosition={poseConfig.leftLeg.position} 
        targetRotation={poseConfig.leftLeg.rotation}
        transitionSpeed={transitionSpeed}
      >
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color={getPartColor("hips")} {...materialProps} />
        </mesh>
        <mesh position={[0, -0.2, 0]}>
          <capsuleGeometry args={[0.07, 0.35, 8, 16]} />
          <meshStandardMaterial color={getPartColor("quadriceps")} {...materialProps} />
        </mesh>
        <mesh position={[0, -0.45, 0]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color={getPartColor("quadriceps")} {...materialProps} />
        </mesh>
        <mesh position={[0, -0.7, 0]}>
          <capsuleGeometry args={[0.05, 0.35, 8, 16]} />
          <meshStandardMaterial color={getPartColor("calves")} {...materialProps} />
        </mesh>
        <mesh position={[0, -0.95, 0.05]}>
          <boxGeometry args={[0.08, 0.06, 0.18]} />
          <meshStandardMaterial color={getPartColor("feet")} {...materialProps} />
        </mesh>
      </AnimatedBodyPart>

      {/* Right Leg */}
      <AnimatedBodyPart 
        targetPosition={poseConfig.rightLeg.position} 
        targetRotation={poseConfig.rightLeg.rotation}
        transitionSpeed={transitionSpeed}
      >
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color={getPartColor("hips")} {...materialProps} />
        </mesh>
        <mesh position={[0, -0.2, 0]}>
          <capsuleGeometry args={[0.07, 0.35, 8, 16]} />
          <meshStandardMaterial color={getPartColor("quadriceps")} {...materialProps} />
        </mesh>
        <mesh position={[0, -0.45, 0]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color={getPartColor("quadriceps")} {...materialProps} />
        </mesh>
        <mesh position={[0, -0.7, 0]}>
          <capsuleGeometry args={[0.05, 0.35, 8, 16]} />
          <meshStandardMaterial color={getPartColor("calves")} {...materialProps} />
        </mesh>
        <mesh position={[0, -0.95, 0.05]}>
          <boxGeometry args={[0.08, 0.06, 0.18]} />
          <meshStandardMaterial color={getPartColor("feet")} {...materialProps} />
        </mesh>
      </AnimatedBodyPart>

      {/* Yoga mat */}
      <mesh position={[0, -0.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.8, 0.6]} />
        <meshStandardMaterial color="#7c9885" opacity={0.8} transparent />
      </mesh>
    </group>
  );
};

// Auto-rotating platform
const RotatingPlatform = ({ children, autoRotate }: { children: React.ReactNode; autoRotate: boolean }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });
  
  return <group ref={groupRef}>{children}</group>;
};

// Main component
export const PoseViewer3D = ({ 
  poseName, 
  poseId, 
  muscleGroups = [],
  enableFlowMode = false,
  flowSequence = [],
  onPoseChange,
}: PoseViewer3DProps) => {
  const [viewMode, setViewMode] = useState<"normal" | "skeleton" | "muscles">("normal");
  const [autoRotate, setAutoRotate] = useState(true);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transitionSpeed, setTransitionSpeed] = useState(3);
  
  const actualPoseId = enableFlowMode && flowSequence.length > 0 
    ? flowSequence[currentPoseIndex] 
    : poseId;

  // Auto-advance in flow mode
  useEffect(() => {
    if (!enableFlowMode || !isPlaying || flowSequence.length === 0) return;

    const interval = setInterval(() => {
      setCurrentPoseIndex((prev) => {
        const next = (prev + 1) % flowSequence.length;
        onPoseChange?.(flowSequence[next], next);
        return next;
      });
    }, 4000); // 4 seconds per pose

    return () => clearInterval(interval);
  }, [enableFlowMode, isPlaying, flowSequence, onPoseChange]);

  const handlePrevPose = () => {
    if (flowSequence.length === 0) return;
    setCurrentPoseIndex((prev) => {
      const next = prev === 0 ? flowSequence.length - 1 : prev - 1;
      onPoseChange?.(flowSequence[next], next);
      return next;
    });
  };

  const handleNextPose = () => {
    if (flowSequence.length === 0) return;
    setCurrentPoseIndex((prev) => {
      const next = (prev + 1) % flowSequence.length;
      onPoseChange?.(flowSequence[next], next);
      return next;
    });
  };
  
  const defaultMuscleGroups: MuscleGroup[] = muscleGroups.length > 0 ? muscleGroups : [
    { name: "Core", active: true, intensity: "primary" },
    { name: "Quadriceps", active: true, intensity: "secondary" },
    { name: "Shoulders", active: true, intensity: "secondary" },
    { name: "Calves", active: true, intensity: "stretched" },
  ];

  const viewModes = [
    { id: "normal", icon: Eye, label: "Normal" },
    { id: "skeleton", icon: Bone, label: "Skeleton" },
    { id: "muscles", icon: Dumbbell, label: "Muscles" },
  ] as const;

  const LoadingFallback = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-wellness-sage/30 to-wellness-mint/20">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading 3D Model...</span>
      </div>
    </div>
  );

  return (
    <div className="relative w-full h-full min-h-[300px]">
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{ position: [2, 1.5, 2], fov: 50 }}
          shadows
          style={{ background: "linear-gradient(135deg, rgba(139, 195, 179, 0.3), rgba(180, 216, 197, 0.2))" }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={1} castShadow shadow-mapSize={1024} />
          <directionalLight position={[-5, 3, -5]} intensity={0.4} />
          <pointLight position={[0, 3, 0]} intensity={0.3} />
          
          <RotatingPlatform autoRotate={autoRotate && !isPlaying}>
            <HumanFigure
              showSkeleton={viewMode === "skeleton"}
              muscleGroups={defaultMuscleGroups}
              highlightMuscles={viewMode === "muscles"}
              poseId={actualPoseId}
              transitionSpeed={transitionSpeed}
            />
          </RotatingPlatform>
          
          <ContactShadows position={[0, -0.02, 0]} opacity={0.5} scale={3} blur={2} />
          
          <OrbitControls
            enablePan={false}
            minDistance={1.5}
            maxDistance={5}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 1.5}
            onStart={() => setAutoRotate(false)}
          />
          
          <Environment preset="studio" />
        </Canvas>
      </Suspense>

      {/* Flow mode controls */}
      {enableFlowMode && flowSequence.length > 0 && (
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex items-center justify-between px-2 pointer-events-none">
          <button
            onClick={handlePrevPose}
            className="p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-background pointer-events-auto transition-colors"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            onClick={handleNextPose}
            className="p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-background pointer-events-auto transition-colors"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Controls overlay */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-lg bg-background/80 backdrop-blur-sm border border-border/50">
          {viewModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === mode.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              <mode.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{mode.label}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {enableFlowMode && flowSequence.length > 0 && (
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span className="hidden sm:inline">{isPlaying ? "Pause" : "Play"}</span>
            </button>
          )}
          
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              "bg-background/80 backdrop-blur-sm border border-border/50",
              autoRotate ? "text-primary" : "text-muted-foreground"
            )}
          >
            <RotateCcw className={cn("w-4 h-4", autoRotate && "animate-spin")} style={{ animationDuration: "3s" }} />
            <span className="hidden sm:inline">Rotate</span>
          </button>
        </div>
      </div>

      {/* Muscle legend */}
      {viewMode === "muscles" && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-4 right-4 p-3 rounded-lg bg-background/90 backdrop-blur-sm border border-border/50"
        >
          <p className="text-xs font-medium mb-2">Muscle Activation</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              Primary
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-orange-500" />
              Secondary
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              Stretched
            </div>
          </div>
        </motion.div>
      )}

      {/* Pose info */}
      <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur-sm border border-border/50 text-xs text-muted-foreground">
        {enableFlowMode && flowSequence.length > 0 ? (
          <span>{currentPoseIndex + 1}/{flowSequence.length} • {actualPoseId}</span>
        ) : (
          <span>{poseName} • Drag to rotate</span>
        )}
      </div>
    </div>
  );
};
