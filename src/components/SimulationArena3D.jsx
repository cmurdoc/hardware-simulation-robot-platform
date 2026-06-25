import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function SimulationArena3D({
  robotState,
  setRobotState,
  obstacles,
  setObstacles,
  roomWidth = 8,
  roomDepth = 6,
  isRunning,
  onSensorDistanceUpdate,
  onFrameCapture, // Callback to pass Base64 camera frames to parent (throttled)
  mentalMap
}) {
  const mountRef = useRef(null);
  const pipMountRef = useRef(null);
  const minimapCanvasRef = useRef(null);
  const sensorHitsRef = useRef([]);
  
  const robotGroupRef = useRef(null);
  const leftWheelMeshRef = useRef(null);
  const rightWheelMeshRef = useRef(null);
  const sensorBeamRef = useRef(null);
  const sensorDotRef = useRef(null);
  const robotCameraRef = useRef(null);
  const pipRendererRef = useRef(null);
  
  // Dragging obstacles state
  const dragPlaneRef = useRef(null);
  const obstacleMeshesRef = useRef([]);

  useEffect(() => {
    // 1. Setup Scene, Camera, Renderer
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 450;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Slate-900

    scene.fog = new THREE.FogExp2(0x0f172a, 0.08);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 6, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.bias = -0.001;
    container.appendChild(renderer.domElement);

    // 2. Setup Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 20;

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0x38bdf8, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xa855f7, 0.6, 10);
    pointLight.position.set(0, 4, 0);
    scene.add(pointLight);

    // 4. Floor Grid & Floor Board
    const floorGeo = new THREE.PlaneGeometry(roomWidth + 2, roomDepth + 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(Math.max(roomWidth, roomDepth) + 4, Math.max(roomWidth, roomDepth) + 4, 0x38bdf8, 0x334155);
    grid.position.y = 0.005;
    scene.add(grid);

    // 5. Room Walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.3,
      roughness: 0.9
    });
    const wallHeight = 2.0;

    const backWallGeo = new THREE.BoxGeometry(roomWidth, wallHeight, 0.1);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, wallHeight / 2, -roomDepth / 2);
    scene.add(backWall);

    const frontWall = new THREE.Mesh(backWallGeo, wallMat);
    frontWall.position.set(0, wallHeight / 2, roomDepth / 2);
    scene.add(frontWall);

    const sideWallGeo = new THREE.BoxGeometry(0.1, wallHeight, roomDepth);
    const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftWall.position.set(-roomWidth / 2, wallHeight / 2, 0);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
    rightWall.position.set(roomWidth / 2, wallHeight / 2, 0);
    scene.add(rightWall);

    // 6. Draw Robot Mesh Group
    const robotGroup = new THREE.Group();
    scene.add(robotGroup);
    robotGroupRef.current = robotGroup;

    // Chassis base
    const chassisGeo = new THREE.BoxGeometry(0.5, 0.1, 0.4);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.4,
      metalness: 0.7
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 0.1;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    robotGroup.add(chassis);

    // Mount Arduino & Pi visuals on top
    const arduinoBoardGeo = new THREE.BoxGeometry(0.12, 0.01, 0.1);
    const arduinoBoardMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
    const arduinoVisual = new THREE.Mesh(arduinoBoardGeo, arduinoBoardMat);
    arduinoVisual.position.set(-0.1, 0.16, 0);
    robotGroup.add(arduinoVisual);

    const piBoardGeo = new THREE.BoxGeometry(0.14, 0.01, 0.1);
    const piBoardMat = new THREE.MeshStandardMaterial({ color: 0x16a34a });
    const piVisual = new THREE.Mesh(piBoardGeo, piBoardMat);
    piVisual.position.set(0.08, 0.16, 0);
    robotGroup.add(piVisual);

    // Left Wheel
    const wheelGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 32);
    wheelGeo.rotateX(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    
    const treadGeo = new THREE.BoxGeometry(0.01, 0.17, 0.045);
    const treadMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    
    const leftWheel = new THREE.Group();
    const lwMesh = new THREE.Mesh(wheelGeo, wheelMat);
    lwMesh.castShadow = true;
    leftWheel.add(lwMesh);
    const lwTread = new THREE.Mesh(treadGeo, treadMat);
    leftWheel.add(lwTread);
    leftWheel.position.set(0, 0.08, -0.21);
    robotGroup.add(leftWheel);
    leftWheelMeshRef.current = leftWheel;

    // Right Wheel
    const rightWheel = new THREE.Group();
    const rwMesh = new THREE.Mesh(wheelGeo, wheelMat);
    rwMesh.castShadow = true;
    rightWheel.add(rwMesh);
    const rwTread = new THREE.Mesh(treadGeo, treadMat);
    rightWheel.add(rwTread);
    rightWheel.position.set(0, 0.08, 0.21);
    robotGroup.add(rightWheel);
    rightWheelMeshRef.current = rightWheel;

    // Caster
    const casterGeo = new THREE.SphereGeometry(0.04, 16, 16);
    const caster = new THREE.Mesh(casterGeo, wheelMat);
    caster.position.set(-0.2, 0.04, 0);
    robotGroup.add(caster);

    // Sensor Group
    const sensorGroup = new THREE.Group();
    sensorGroup.position.set(0.22, 0.15, 0);
    const eyeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.04, 16);
    eyeGeo.rotateZ(Math.PI / 2);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.z = -0.04;
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.z = 0.04;
    
    sensorGroup.add(eyeL);
    sensorGroup.add(eyeR);
    robotGroup.add(sensorGroup);

    // -------------------------------------------------------------
    // ADD FRONT-FACING CAMERA ON THE ROBOT CHASSIS
    // -------------------------------------------------------------
    const robotCamera = new THREE.PerspectiveCamera(60, 4 / 3, 0.1, 15);
    // Position camera on top-front of the chassis looking forward (+X direction)
    robotCamera.position.set(0.22, 0.22, 0);
    robotCamera.rotation.y = -Math.PI / 2; // looks forward (+X direction)
    robotGroup.add(robotCamera);
    robotCameraRef.current = robotCamera;

    // 7. Sensor Ray beam
    const beamMat = new THREE.LineBasicMaterial({ color: 0x22c55e, linewidth: 2 });
    const beamGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0)
    ]);
    const beam = new THREE.Line(beamGeo, beamMat);
    scene.add(beam);
    sensorBeamRef.current = beam;

    // Sensor Hit Dot
    const dotGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const sensorDot = new THREE.Mesh(dotGeo, dotMat);
    scene.add(sensorDot);
    sensorDotRef.current = sensorDot;

    // Invisible plane for dragging raycasts
    const dragPlaneGeo = new THREE.PlaneGeometry(100, 100);
    const dragPlane = new THREE.Mesh(dragPlaneGeo, new THREE.MeshBasicMaterial({ visible: false }));
    dragPlane.rotation.x = -Math.PI / 2;
    scene.add(dragPlane);
    dragPlaneRef.current = dragPlane;

    // 8. Setup PiP WebGL Renderer for Robot Camera View
    const pipContainer = pipMountRef.current;
    const pipRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    pipRenderer.setSize(160, 120);
    pipContainer.appendChild(pipRenderer.domElement);
    pipRendererRef.current = pipRenderer;

    // 9. Obstacles meshes
    const meshes = [];
    const buildObstacleMeshes = () => {
      meshes.forEach(m => scene.remove(m));
      meshes.length = 0;

      obstacles.forEach((obs) => {
        let mesh;
        if (obs.type === 'cylinder' || obs.type === 'toy') {
          const radius = obs.radius || 0.3;
          const height = obs.height || 0.6;
          const geo = new THREE.CylinderGeometry(radius, radius, height, 32);
          const mat = new THREE.MeshStandardMaterial({
            color: obs.color || 0xa855f7,
            roughness: 0.2,
            metalness: 0.1,
            transparent: true,
            opacity: 0.8
          });
          mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(obs.x, height / 2, obs.z);
        } else {
          const w = obs.width || 0.6;
          const h = obs.height || 0.8;
          const d = obs.depth || 0.6;
          const geo = new THREE.BoxGeometry(w, h, d);
          const mat = new THREE.MeshStandardMaterial({
            color: obs.color || 0x3b82f6,
            roughness: 0.5,
            metalness: 0.1,
            transparent: true,
            opacity: 0.8
          });
          mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(obs.x, h / 2, obs.z);
        }
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { id: obs.id };
        scene.add(mesh);
        meshes.push(mesh);
      });
      obstacleMeshesRef.current = meshes;
    };

    buildObstacleMeshes();

    // --- Drag-and-Drop Obstacles Handler ---
    let selectedObject = null;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const dragOffset = new THREE.Vector3();

    const onPointerMove = (event) => {
      if (!selectedObject) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersectionPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(floorPlane, intersectionPoint)) {
        const newPos = intersectionPoint.add(dragOffset);

        // Clamp the coordinates to keep the obstacle inside the room boundaries
        const borderMargin = 0.4;
        const clampedX = Math.max(-roomWidth / 2 + borderMargin, Math.min(roomWidth / 2 - borderMargin, newPos.x));
        const clampedZ = Math.max(-roomDepth / 2 + borderMargin, Math.min(roomDepth / 2 - borderMargin, newPos.z));

        // Direct position update to Three.js mesh for instant 60FPS visual updates
        selectedObject.position.x = clampedX;
        selectedObject.position.z = clampedZ;

        // Propagate updates to parent component state using functional setter
        const obstacleId = selectedObject.userData.id;
        setObstacles((prev) =>
          prev.map((obs) => (obs.id === obstacleId ? { ...obs, x: clampedX, z: clampedZ } : obs))
        );
      }
    };

    const onPointerUp = () => {
      if (selectedObject) {
        controls.enabled = true; // Re-enable OrbitControls
        selectedObject = null;
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    const onPointerDown = (event) => {
      // Left click dragging
      if (event.button !== 0) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(obstacleMeshesRef.current);
      if (intersects.length > 0) {
        selectedObject = intersects[0].object;
        controls.enabled = false; // Disable camera orbiting during drag

        const intersectionPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(floorPlane, intersectionPoint)) {
          dragOffset.copy(selectedObject.position).sub(intersectionPoint);
          dragOffset.y = 0;
        }

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);

    // Resize handler
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight || 450;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 10. Animation Loop
    let animationFrameId;
    let lastCaptureTime = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      // Update Orbit controls for main scene camera
      controls.update();
      
      // Render main screen
      renderer.render(scene, camera);

      // Render robot camera to the PiP overlay
      if (pipRendererRef.current && robotCameraRef.current) {
        pipRendererRef.current.render(scene, robotCameraRef.current);
        
        // Throttled Vision Frame capture: capture once every 400ms to maintain performance
        const now = performance.now();
        if (now - lastCaptureTime > 400 && isRunning) {
          lastCaptureTime = now;
          try {
            // Get base64 frame from PiP WebGL canvas buffer
            const imageBase64 = pipRendererRef.current.domElement.toDataURL('image/jpeg', 0.55);
            if (onFrameCapture) {
              onFrameCapture(imageBase64);
            }
          } catch (err) {
            console.error('Frame capture failed:', err);
          }
        }
      }
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      
      container.removeChild(renderer.domElement);
      renderer.dispose();

      if (pipContainer.contains(pipRenderer.domElement)) {
        pipContainer.removeChild(pipRenderer.domElement);
      }
      pipRenderer.dispose();
    };
  }, [roomWidth, roomDepth, isRunning]);

  // Update Robot Mesh Position, Rotation & Sensor line in 3D
  useEffect(() => {
    if (!robotGroupRef.current) return;

    const r = robotGroupRef.current;
    r.position.set(robotState.x, 0, robotState.z);
    r.rotation.y = -robotState.angle;

    // Spin wheels
    if (leftWheelMeshRef.current) {
      leftWheelMeshRef.current.rotation.z = -(robotState.leftWheelRotation || 0);
    }
    if (rightWheelMeshRef.current) {
      rightWheelMeshRef.current.rotation.z = -(robotState.rightWheelRotation || 0);
    }

    // Update Sensor Line Ray in 3D scene
    const sensorX = robotState.sensorX;
    const sensorZ = robotState.sensorZ;
    const dist = robotState.sensorDistance / 100;
    
    const hitX = sensorX + dist * Math.cos(robotState.angle);
    const hitZ = sensorZ + dist * Math.sin(robotState.angle);

    // Accumulate sensor hit points for real-time SLAM / Birds-Eye mapping
    if (robotState.x === 0 && robotState.z === 0 && robotState.angle === 0) {
      sensorHitsRef.current = [];
    } else if (robotState.sensorDistance > 0 && robotState.sensorDistance < 400 && isRunning) {
      const hits = sensorHitsRef.current;
      const last = hits[hits.length - 1];
      if (!last || Math.hypot(last.x - hitX, last.z - hitZ) > 0.05) {
        hits.push({ x: hitX, z: hitZ });
        if (hits.length > 800) {
          hits.shift();
        }
      }
    }

    if (sensorBeamRef.current) {
      const positions = new Float32Array([
        sensorX, 0.15, sensorZ,
        hitX, 0.15, hitZ
      ]);
      sensorBeamRef.current.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      sensorBeamRef.current.geometry.computeBoundingSphere();
      
      if (robotState.sensorDistance < 30 || robotState.collided) {
        sensorBeamRef.current.material.color.setHex(0xef4444);
      } else {
        sensorBeamRef.current.material.color.setHex(0x22c55e);
      }
    }

    if (sensorDotRef.current) {
      sensorDotRef.current.position.set(hitX, 0.15, hitZ);
    }
    
    if (onSensorDistanceUpdate) {
      onSensorDistanceUpdate(robotState.sensorDistance);
    }
  }, [robotState, isRunning]);

  // Sync Obstacles mesh positions
  useEffect(() => {
    const meshes = obstacleMeshesRef.current;
    obstacles.forEach(obs => {
      const mesh = meshes.find(m => m.userData.id === obs.id);
      if (mesh) {
        mesh.position.x = obs.x;
        mesh.position.z = obs.z;
      }
    });
  }, [obstacles]);

  // Render AI Mental Map Birds-Eye View
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    // Background slate-950
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    // Draw grid lines
    ctx.strokeStyle = '#0f172a'; // slate-900
    ctx.lineWidth = 0.5;
    for (let x = 10; x < w; x += 15) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 10; y < h; y += 15) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Scale mapping: room is roomWidth (8m) wide, roomDepth (6m) deep.
    // Canvas is 160x120 (4:3 aspect ratio matching 8:6).
    // Leave a small border margin
    const margin = 6;
    const drawW = w - 2 * margin;
    const drawH = h - 2 * margin;

    // Draw room boundary
    ctx.strokeStyle = '#1e293b'; // slate-800
    ctx.lineWidth = 1.0;
    ctx.strokeRect(margin, margin, drawW, drawH);

    // Coordinate conversion function: X in [-roomWidth/2, roomWidth/2] -> pixels
    const toCanvasX = (x) => {
      return margin + ((x + roomWidth / 2) / roomWidth) * drawW;
    };
    const toCanvasY = (z) => {
      return margin + ((z + roomDepth / 2) / roomDepth) * drawH;
    };

    // 1. Draw Accumulated Sensor Hit Points (Lidar SLAM mapping)
    ctx.fillStyle = 'rgba(245, 158, 11, 0.5)'; // Glowing Amber
    sensorHitsRef.current.forEach(pt => {
      const px = toCanvasX(pt.x);
      const py = toCanvasY(pt.z);
      if (px >= 0 && px <= w && py >= 0 && py <= h) {
        ctx.beginPath();
        ctx.arc(px, py, 1.2, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // 2. Draw Real Robot Position (Cyan marker)
    const rx = toCanvasX(robotState.x);
    const ry = toCanvasY(robotState.z);

    // Robot dot
    ctx.fillStyle = '#22d3ee'; // cyan-400
    ctx.beginPath();
    ctx.arc(rx, ry, 3.5, 0, 2 * Math.PI);
    ctx.fill();

    // Robot heading line
    const headLen = 8;
    const hx = rx + headLen * Math.cos(robotState.angle);
    const hy = ry + headLen * Math.sin(robotState.angle);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    // 2. Parse and Draw Mental Map Points
    let parsedPoints = [];
    const seenPoints = new Set();
    const addPoint = (x, z) => {
      if (x >= -roomWidth / 2 - 1.5 && x <= roomWidth / 2 + 1.5 &&
          z >= -roomDepth / 2 - 1.5 && z <= roomDepth / 2 + 1.5) {
        const key = `${x.toFixed(2)},${z.toFixed(2)}`;
        if (!seenPoints.has(key)) {
          seenPoints.add(key);
          parsedPoints.push({ x, z });
        }
      }
    };

    if (mentalMap) {
      // Clean up markdown code blocks if embedded
      let cleanText = mentalMap.trim();
      if (cleanText.includes('```') || cleanText.includes('{')) {
        const startIdx = cleanText.indexOf('{');
        const endIdx = cleanText.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          cleanText = cleanText.substring(startIdx, endIdx + 1);
        }
      }

      // Try parsing as JSON first
      try {
        const parsed = JSON.parse(cleanText);
        // Look for items array or obstacles array
        const obsList = parsed.obstacles || parsed.objects || parsed.obstacles_perceived || [];
        if (Array.isArray(obsList)) {
          obsList.forEach(obs => {
            const px = obs.x !== undefined ? obs.x : obs.pos_x;
            const pz = obs.z !== undefined ? obs.z : (obs.y !== undefined ? obs.y : obs.pos_z);
            if (px !== undefined && pz !== undefined) {
              addPoint(Number(px), Number(pz));
            }
          });
        }
      } catch (e) {
        // Not valid JSON, process text directly
      }

      // Also parse using regex to find coordinate mentions anywhere in text or JSON fields
      // Pattern A: Match labelled coordinates like x: 1.2, z: -2.3 or x=1.2, y=-2.3 (case insensitive)
      const labelRegex = /\b[Xx]\s*[:=]?\s*(-?\d+(?:\.\d+)?)\b[\s,;]*\b[ZzYy]\s*[:=]?\s*(-?\d+(?:\.\d+)?)\b/g;
      let match;
      while ((match = labelRegex.exec(mentalMap)) !== null) {
        addPoint(parseFloat(match[1]), parseFloat(match[2]));
      }

      // Pattern B: Match standard coordinates inside parentheses or square brackets like (-1.2, 0.4) or [2, -1]
      const parenRegex = /[\[({]\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*[\])}]/g;
      while ((match = parenRegex.exec(mentalMap)) !== null) {
        addPoint(parseFloat(match[1]), parseFloat(match[2]));
      }

      // Pattern C: Match raw comma separated number pairs like "1.2, -0.4"
      const rawRegex = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g;
      while ((match = rawRegex.exec(mentalMap)) !== null) {
        addPoint(parseFloat(match[1]), parseFloat(match[2]));
      }
    }

    // Draw AI Perceived points (Magenta stars/dots)
    parsedPoints.forEach(pt => {
      const px = toCanvasX(pt.x);
      const py = toCanvasY(pt.z);

      if (px >= 0 && px <= w && py >= 0 && py <= h) {
        ctx.fillStyle = '#ec4899'; // pink-500
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(px - 3, py);
        ctx.lineTo(px + 3, py);
        ctx.moveTo(px, py - 3);
        ctx.lineTo(px, py + 3);
        ctx.stroke();
      }
    });

  }, [mentalMap, robotState, roomWidth, roomDepth]);

  return (
    <div className="relative w-full h-full min-h-[400px] flex flex-col bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* 3D Viewport mount point */}
      <div ref={mountRef} className="w-full flex-grow relative cursor-grab active:cursor-grabbing" />

      {/* Top overlay container: stacks or wraps when screen width is small */}
      <div className="absolute top-4 left-4 right-4 pointer-events-none flex flex-wrap justify-between items-start gap-4 z-20">
        {/* Top left HUD telemetry */}
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          <div className="px-3 py-1.5 bg-slate-950/80 border border-slate-700/40 backdrop-blur-md rounded-lg text-xs font-mono text-cyan-400 shadow-md">
            ROBOT POS: X: {robotState.x.toFixed(2)}m | Z: {robotState.z.toFixed(2)}m | Dir: {((robotState.angle * 180) / Math.PI).toFixed(0)}°
          </div>
          <div className="px-3 py-1.5 bg-slate-950/80 border border-slate-700/40 backdrop-blur-md rounded-lg text-xs font-mono text-cyan-400 shadow-md">
            SENSOR: <span className={robotState.sensorDistance < 30 ? "text-red-400 font-bold" : "text-green-400"}>{robotState.sensorDistance.toFixed(0)} cm</span>
          </div>
          {robotState.collided && (
            <div className="px-3 py-1.5 bg-red-950/90 border border-red-500/50 backdrop-blur-md rounded-lg text-xs font-mono text-red-300 font-bold uppercase animate-pulse shadow-md">
              ⚠️ Collision Detected
            </div>
          )}
        </div>

        {/* PICTURE IN PICTURE Viewport (Robot First Person POV) */}
        <div className="flex flex-col bg-slate-950/90 border border-slate-700/60 rounded-lg overflow-hidden shadow-xl shadow-black/40 pointer-events-auto">
          {/* Cam header bar */}
          <div className="flex items-center justify-between px-2 py-1 bg-slate-900 border-b border-slate-800 text-[8px] font-mono text-slate-400">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse inline-block" />
              <span className="font-bold text-red-400">REC</span>
              <span>PI_CAM_5</span>
            </div>
            <span>FOV 60°</span>
          </div>
          
          {/* Render mount */}
          <div ref={pipMountRef} className="w-[160px] h-[120px] bg-black relative">
            {/* HUD Crosshair overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center border-t border-b border-white/5">
              <div className="w-[6px] h-[6px] rounded-full border border-emerald-500/40" />
              <div className="absolute w-[20px] h-[1px] bg-emerald-500/20" />
              <div className="absolute h-[20px] w-[1px] bg-emerald-500/20" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom overlay container: wraps when screen width is small */}
      <div className="absolute bottom-4 left-4 right-4 pointer-events-none flex flex-wrap justify-between items-end gap-2 z-20">
        {/* Floating Instructions */}
        <div className="text-[10px] font-mono text-slate-500 bg-slate-950/40 px-2 py-1 rounded select-none pointer-events-auto">
          Camera: Left Click + Drag | Move Object: Click + Drag
        </div>

        {/* AI Mental Map Birds-Eye View & Arena configuration widgets */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          {/* AI Mental Map Birds-Eye View */}
          <div className="flex flex-col bg-slate-950/90 border border-slate-700/60 rounded-lg overflow-hidden shadow-xl shadow-black/40">
            {/* Map Header Bar */}
            <div className="flex items-center justify-between px-2 py-1 bg-slate-900 border-b border-slate-800 text-[8px] font-mono text-slate-400 w-[160px]">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse inline-block" />
                <span className="font-bold text-pink-400">MAP</span>
                <span>PI_MENTAL_GRID</span>
              </div>
              <span>SCALE 1:50</span>
            </div>
            
            {/* Canvas Mount */}
            <div className="relative p-1 bg-black">
              <canvas
                ref={minimapCanvasRef}
                width={160}
                height={120}
                className="block border border-slate-800 rounded bg-slate-950"
              />
              
              {/* Legend overlay */}
              <div className="absolute bottom-2 left-2 flex flex-col gap-0.5 text-[6px] font-mono text-slate-400 bg-slate-950/80 p-1 rounded border border-slate-800 pointer-events-none">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Real Robot</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Sensor Map</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                  <span>AI Perceived</span>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setRobotState(robotPhysics.getInitialState(0, 0, 0));
              }}
              className="px-3 py-1.5 bg-slate-950/80 border border-slate-700/50 hover:bg-slate-800 hover:border-slate-500 hover:text-white rounded-lg text-xs font-mono text-slate-300 transition-all shadow-lg hover:scale-105 active:scale-95"
            >
              Reset Robot
            </button>
            <button
              onClick={() => {
                const scattered = obstacles.map((obs) => ({
                  ...obs,
                  x: (Math.random() - 0.5) * (roomWidth - 1),
                  z: (Math.random() - 0.5) * (roomDepth - 1),
                }));
                setObstacles(scattered);
              }}
              className="px-3 py-1.5 bg-slate-950/80 border border-slate-700/50 hover:bg-slate-800 hover:border-slate-500 hover:text-white rounded-lg text-xs font-mono text-slate-300 transition-all shadow-lg hover:scale-105 active:scale-95"
            >
              Rearrange Obstacles
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
