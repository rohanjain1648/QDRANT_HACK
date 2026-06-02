import { useRef, useState, useCallback, useEffect } from 'react';

export type Keypoint = {
  x: number;
  y: number;
  score?: number;
  name?: string;
};

export type PoseFeedback = {
  isCorrect: boolean;
  accuracy: number;
  suggestions: string[];
  jointFeedback: { [key: string]: { status: 'correct' | 'adjust' | 'wrong'; message: string } };
};

// Target poses with expected keypoint relationships
const targetPoseAngles: { [poseId: string]: { [key: string]: { min: number; max: number; tip: string } } } = {
  mountain: {
    leftElbow: { min: 160, max: 180, tip: "Keep your arms straight by your sides" },
    rightElbow: { min: 160, max: 180, tip: "Keep your arms straight by your sides" },
    leftKnee: { min: 165, max: 180, tip: "Keep your legs straight" },
    rightKnee: { min: 165, max: 180, tip: "Keep your legs straight" },
    spine: { min: 165, max: 180, tip: "Stand tall with a straight spine" },
  },
  warrior2: {
    leftElbow: { min: 160, max: 180, tip: "Extend your left arm fully" },
    rightElbow: { min: 160, max: 180, tip: "Extend your right arm fully" },
    rightKnee: { min: 80, max: 110, tip: "Bend your front knee to 90 degrees" },
    leftKnee: { min: 160, max: 180, tip: "Keep your back leg straight" },
    shoulders: { min: 170, max: 190, tip: "Keep arms parallel to the ground" },
  },
  warrior1: {
    leftElbow: { min: 160, max: 180, tip: "Raise your arms overhead" },
    rightElbow: { min: 160, max: 180, tip: "Raise your arms overhead" },
    rightKnee: { min: 80, max: 110, tip: "Bend your front knee to 90 degrees" },
    leftKnee: { min: 155, max: 180, tip: "Keep your back leg straight" },
  },
  tree: {
    leftKnee: { min: 165, max: 180, tip: "Keep your standing leg straight" },
    rightKnee: { min: 20, max: 100, tip: "Bend your raised knee outward" },
    spine: { min: 165, max: 180, tip: "Keep your spine straight and tall" },
  },
  child: {
    spine: { min: 30, max: 90, tip: "Fold forward completely" },
    leftKnee: { min: 20, max: 60, tip: "Sit back on your heels" },
    rightKnee: { min: 20, max: 60, tip: "Sit back on your heels" },
  },
  downdog: {
    leftElbow: { min: 160, max: 180, tip: "Straighten your arms" },
    rightElbow: { min: 160, max: 180, tip: "Straighten your arms" },
    leftKnee: { min: 150, max: 180, tip: "Straighten your legs if possible" },
    rightKnee: { min: 150, max: 180, tip: "Straighten your legs if possible" },
    hip: { min: 50, max: 100, tip: "Push your hips up and back" },
  },
  cobra: {
    spine: { min: 120, max: 160, tip: "Arch your back gently" },
    leftElbow: { min: 100, max: 160, tip: "Keep elbows slightly bent" },
    rightElbow: { min: 100, max: 160, tip: "Keep elbows slightly bent" },
  },
  triangle: {
    leftKnee: { min: 160, max: 180, tip: "Keep both legs straight" },
    rightKnee: { min: 160, max: 180, tip: "Keep both legs straight" },
    spine: { min: 60, max: 100, tip: "Bend to the side from your hips" },
  },
  plank: {
    leftElbow: { min: 160, max: 180, tip: "Keep your arms straight" },
    rightElbow: { min: 160, max: 180, tip: "Keep your arms straight" },
    spine: { min: 165, max: 180, tip: "Keep your body in a straight line" },
    leftKnee: { min: 165, max: 180, tip: "Keep your legs straight" },
    rightKnee: { min: 165, max: 180, tip: "Keep your legs straight" },
  },
  boat: {
    leftKnee: { min: 140, max: 180, tip: "Extend your legs forward" },
    rightKnee: { min: 140, max: 180, tip: "Extend your legs forward" },
    hip: { min: 50, max: 90, tip: "Balance on your sitting bones" },
  },
};

// Calculate angle between three points
const calculateAngle = (a: Keypoint, b: Keypoint, c: Keypoint): number => {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
};

// MediaPipe landmark indices
const POSE_LANDMARKS = {
  nose: 0,
  left_eye_inner: 1,
  left_eye: 2,
  left_eye_outer: 3,
  right_eye_inner: 4,
  right_eye: 5,
  right_eye_outer: 6,
  left_ear: 7,
  right_ear: 8,
  mouth_left: 9,
  mouth_right: 10,
  left_shoulder: 11,
  right_shoulder: 12,
  left_elbow: 13,
  right_elbow: 14,
  left_wrist: 15,
  right_wrist: 16,
  left_pinky: 17,
  right_pinky: 18,
  left_index: 19,
  right_index: 20,
  left_thumb: 21,
  right_thumb: 22,
  left_hip: 23,
  right_hip: 24,
  left_knee: 25,
  right_knee: 26,
  left_ankle: 27,
  right_ankle: 28,
  left_heel: 29,
  right_heel: 30,
  left_foot_index: 31,
  right_foot_index: 32,
};

export const usePoseDetection = (poseId: string) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<any>(null);
  const animationFrameRef = useRef<number>();

  const [isLoading, setIsLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPose, setCurrentPose] = useState<Keypoint[]>([]);
  const [feedback, setFeedback] = useState<PoseFeedback>({
    isCorrect: false,
    accuracy: 0,
    suggestions: [],
    jointFeedback: {},
  });

  // Get keypoint by name from detected pose
  const getKeypointByName = useCallback((keypoints: Keypoint[], name: string): Keypoint | undefined => {
    return keypoints.find(kp => kp.name === name);
  }, []);

  // Analyze pose and provide feedback
  const analyzePose = useCallback((keypoints: Keypoint[]): PoseFeedback => {
    const targetAngles = targetPoseAngles[poseId] || targetPoseAngles.mountain;
    const jointFeedback: PoseFeedback['jointFeedback'] = {};
    const suggestions: string[] = [];
    let correctJoints = 0;
    let totalJoints = 0;

    // Get keypoints for angle calculation
    const leftShoulder = getKeypointByName(keypoints, 'left_shoulder');
    const rightShoulder = getKeypointByName(keypoints, 'right_shoulder');
    const leftElbow = getKeypointByName(keypoints, 'left_elbow');
    const rightElbow = getKeypointByName(keypoints, 'right_elbow');
    const leftWrist = getKeypointByName(keypoints, 'left_wrist');
    const rightWrist = getKeypointByName(keypoints, 'right_wrist');
    const leftHip = getKeypointByName(keypoints, 'left_hip');
    const rightHip = getKeypointByName(keypoints, 'right_hip');
    const leftKnee = getKeypointByName(keypoints, 'left_knee');
    const rightKnee = getKeypointByName(keypoints, 'right_knee');
    const leftAnkle = getKeypointByName(keypoints, 'left_ankle');
    const rightAnkle = getKeypointByName(keypoints, 'right_ankle');
    const nose = getKeypointByName(keypoints, 'nose');

    // Check left elbow angle
    if (targetAngles.leftElbow && leftShoulder && leftElbow && leftWrist) {
      if (leftShoulder.score! > 0.5 && leftElbow.score! > 0.5 && leftWrist.score! > 0.5) {
        const angle = calculateAngle(leftShoulder, leftElbow, leftWrist);
        totalJoints++;
        
        if (angle >= targetAngles.leftElbow.min && angle <= targetAngles.leftElbow.max) {
          correctJoints++;
          jointFeedback.leftElbow = { status: 'correct', message: 'Left arm position is good' };
        } else {
          jointFeedback.leftElbow = { status: 'adjust', message: targetAngles.leftElbow.tip };
          suggestions.push(targetAngles.leftElbow.tip);
        }
      }
    }

    // Check right elbow angle
    if (targetAngles.rightElbow && rightShoulder && rightElbow && rightWrist) {
      if (rightShoulder.score! > 0.5 && rightElbow.score! > 0.5 && rightWrist.score! > 0.5) {
        const angle = calculateAngle(rightShoulder, rightElbow, rightWrist);
        totalJoints++;
        
        if (angle >= targetAngles.rightElbow.min && angle <= targetAngles.rightElbow.max) {
          correctJoints++;
          jointFeedback.rightElbow = { status: 'correct', message: 'Right arm position is good' };
        } else {
          jointFeedback.rightElbow = { status: 'adjust', message: targetAngles.rightElbow.tip };
          suggestions.push(targetAngles.rightElbow.tip);
        }
      }
    }

    // Check left knee angle
    if (targetAngles.leftKnee && leftHip && leftKnee && leftAnkle) {
      if (leftHip.score! > 0.5 && leftKnee.score! > 0.5 && leftAnkle.score! > 0.5) {
        const angle = calculateAngle(leftHip, leftKnee, leftAnkle);
        totalJoints++;
        
        if (angle >= targetAngles.leftKnee.min && angle <= targetAngles.leftKnee.max) {
          correctJoints++;
          jointFeedback.leftKnee = { status: 'correct', message: 'Left leg position is good' };
        } else {
          jointFeedback.leftKnee = { status: 'adjust', message: targetAngles.leftKnee.tip };
          suggestions.push(targetAngles.leftKnee.tip);
        }
      }
    }

    // Check right knee angle
    if (targetAngles.rightKnee && rightHip && rightKnee && rightAnkle) {
      if (rightHip.score! > 0.5 && rightKnee.score! > 0.5 && rightAnkle.score! > 0.5) {
        const angle = calculateAngle(rightHip, rightKnee, rightAnkle);
        totalJoints++;
        
        if (angle >= targetAngles.rightKnee.min && angle <= targetAngles.rightKnee.max) {
          correctJoints++;
          jointFeedback.rightKnee = { status: 'correct', message: 'Right leg position is good' };
        } else {
          jointFeedback.rightKnee = { status: 'adjust', message: targetAngles.rightKnee.tip };
          suggestions.push(targetAngles.rightKnee.tip);
        }
      }
    }

    // Check spine alignment (using nose, shoulder midpoint, hip midpoint)
    if (targetAngles.spine && nose && leftShoulder && rightShoulder && leftHip && rightHip) {
      if (nose.score! > 0.5 && leftShoulder.score! > 0.5 && rightShoulder.score! > 0.5) {
        const shoulderMid = { 
          x: (leftShoulder.x + rightShoulder.x) / 2, 
          y: (leftShoulder.y + rightShoulder.y) / 2,
          score: 1
        };
        const hipMid = { 
          x: (leftHip.x + rightHip.x) / 2, 
          y: (leftHip.y + rightHip.y) / 2,
          score: 1
        };
        const angle = calculateAngle(nose, shoulderMid as Keypoint, hipMid as Keypoint);
        totalJoints++;
        
        if (angle >= targetAngles.spine.min && angle <= targetAngles.spine.max) {
          correctJoints++;
          jointFeedback.spine = { status: 'correct', message: 'Spine alignment is good' };
        } else {
          jointFeedback.spine = { status: 'adjust', message: targetAngles.spine.tip };
          suggestions.push(targetAngles.spine.tip);
        }
      }
    }

    const accuracy = totalJoints > 0 ? (correctJoints / totalJoints) * 100 : 0;
    const isCorrect = accuracy >= 70;

    // Remove duplicate suggestions
    const uniqueSuggestions = [...new Set(suggestions)].slice(0, 3);

    return {
      isCorrect,
      accuracy,
      suggestions: uniqueSuggestions,
      jointFeedback,
    };
  }, [poseId, getKeypointByName]);

  // Draw pose on canvas
  const drawPose = useCallback((landmarks: any[], ctx: CanvasRenderingContext2D, width: number, height: number, feedback: PoseFeedback) => {
    const connections = [
      [11, 12], // shoulders
      [11, 13], [13, 15], // left arm
      [12, 14], [14, 16], // right arm
      [11, 23], [12, 24], // torso
      [23, 24], // hips
      [23, 25], [25, 27], // left leg
      [24, 26], [26, 28], // right leg
    ];

    // Draw connections
    ctx.lineWidth = 4;
    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start];
      const endPoint = landmarks[end];

      if (startPoint && endPoint && startPoint.visibility > 0.5 && endPoint.visibility > 0.5) {
        ctx.strokeStyle = feedback.isCorrect ? '#22c55e' : '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(startPoint.x * width, startPoint.y * height);
        ctx.lineTo(endPoint.x * width, endPoint.y * height);
        ctx.stroke();
      }
    });

    // Draw keypoints
    landmarks.forEach((landmark, index) => {
      if (landmark.visibility > 0.5) {
        ctx.fillStyle = feedback.isCorrect ? '#22c55e' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(landmark.x * width, landmark.y * height, 8, 0, 2 * Math.PI);
        ctx.fill();

        // Draw white center
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(landmark.x * width, landmark.y * height, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  }, []);

  // Convert MediaPipe landmarks to our Keypoint format
  const landmarksToKeypoints = useCallback((landmarks: any[], width: number, height: number): Keypoint[] => {
    const keypointNames = Object.keys(POSE_LANDMARKS) as Array<keyof typeof POSE_LANDMARKS>;
    return keypointNames.map(name => ({
      x: landmarks[POSE_LANDMARKS[name]]?.x * width || 0,
      y: landmarks[POSE_LANDMARKS[name]]?.y * height || 0,
      score: landmarks[POSE_LANDMARKS[name]]?.visibility || 0,
      name,
    }));
  }, []);

  // Load MediaPipe Pose via CDN
  const loadMediaPipe = useCallback(async () => {
    return new Promise<void>((resolve, reject) => {
      // Check if already loaded
      if ((window as any).Pose) {
        resolve();
        return;
      }

      // Load MediaPipe scripts
      const script1 = document.createElement('script');
      script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
      script1.crossOrigin = 'anonymous';
      
      const script2 = document.createElement('script');
      script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';
      script2.crossOrigin = 'anonymous';
      
      const script3 = document.createElement('script');
      script3.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
      script3.crossOrigin = 'anonymous';

      let loaded = 0;
      const onLoad = () => {
        loaded++;
        if (loaded === 3) {
          // Wait a bit for scripts to initialize
          setTimeout(resolve, 100);
        }
      };

      script1.onload = onLoad;
      script2.onload = onLoad;
      script3.onload = () => {
        onLoad();
      };

      script1.onerror = reject;
      script2.onerror = reject;
      script3.onerror = reject;

      document.head.appendChild(script1);
      document.head.appendChild(script2);
      document.head.appendChild(script3);
    });
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      if (!videoRef.current) return false;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      
      return true;
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please allow camera permissions.');
      return false;
    }
  }, []);

  // Detection loop
  const detectPose = useCallback(async () => {
    if (!poseRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectPose);
      return;
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw mirrored video
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    try {
      // Send frame to MediaPipe
      await poseRef.current.send({ image: video });
    } catch (err) {
      console.error('Error during pose detection:', err);
    }

    animationFrameRef.current = requestAnimationFrame(detectPose);
  }, []);

  // Handle pose results
  const onResults = useCallback((results: any) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (results.poseLandmarks) {
      // Convert to our keypoint format
      const keypoints = landmarksToKeypoints(results.poseLandmarks, canvas.width, canvas.height);
      setCurrentPose(keypoints);

      // Analyze and provide feedback
      const poseFeedback = analyzePose(keypoints);
      setFeedback(poseFeedback);

      // Draw pose overlay
      drawPose(results.poseLandmarks, ctx, canvas.width, canvas.height, poseFeedback);
    }
  }, [landmarksToKeypoints, analyzePose, drawPose]);

  // Initialize pose detector
  const initializeDetector = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      await loadMediaPipe();

      const Pose = (window as any).Pose;
      if (!Pose) {
        throw new Error('MediaPipe Pose not loaded');
      }

      const pose = new Pose({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      pose.onResults(onResults);

      poseRef.current = pose;
      setIsLoading(false);
    } catch (err) {
      console.error('Error initializing pose detector:', err);
      setError('Failed to initialize pose detection. Please refresh and try again.');
      setIsLoading(false);
    }
  }, [loadMediaPipe, onResults]);

  // Start detection
  const startDetection = useCallback(async () => {
    setIsLoading(true);
    
    try {
      await initializeDetector();
      
      const cameraStarted = await startCamera();
      if (!cameraStarted) {
        setIsLoading(false);
        return;
      }

      setIsDetecting(true);
      setIsLoading(false);
      detectPose();
    } catch (err) {
      console.error('Error starting detection:', err);
      setError('Failed to start pose detection');
      setIsLoading(false);
    }
  }, [initializeDetector, startCamera, detectPose]);

  // Stop detection
  const stopDetection = useCallback(() => {
    setIsDetecting(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
      if (poseRef.current) {
        poseRef.current.close?.();
      }
    };
  }, [stopDetection]);

  return {
    videoRef,
    canvasRef,
    isLoading,
    isDetecting,
    error,
    currentPose,
    feedback,
    startDetection,
    stopDetection,
  };
};
