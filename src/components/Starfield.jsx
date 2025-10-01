import { useEffect, useRef, useState } from "react";
import { COLORS } from "../config/colors.js";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import InfoPanel from "./InfoPanel.jsx";
import Sidebar from "./Sidebar.jsx";
import { Text } from "troika-three-text";

const createHighlightTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  // Outer ring
  context.beginPath();
  context.arc(64, 64, 40, 0, 2 * Math.PI);
  context.lineWidth = 8;
  context.strokeStyle = COLORS.highlightOuter;
  context.stroke();

  // Inner glow
  context.beginPath();
  context.arc(64, 64, 48, 0, 2 * Math.PI);
  context.lineWidth = 4;
  context.strokeStyle = COLORS.highlightInner;
  context.stroke();

  return new THREE.CanvasTexture(canvas);
};

// Helper function to convert RA string to radians
const raToRadians = (ra) => {
  // RA format example: "14h29m43s"
  const raRegex = /(\d+)h(\d+)m([\d.]+)s/;
  const match = ra.match(raRegex);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseFloat(match[3]);
  const totalHours = hours + minutes / 60 + seconds / 3600;
  // Convert hours to degrees (360 degrees / 24 hours = 15 degrees per hour)
  const degrees = totalHours * 15;
  return (degrees * Math.PI) / 180; // radians
};

// Helper function to convert Dec string to radians
const decToRadians = (dec) => {
  // Dec format example: "−62°40′46″" or "-62°40′46″"
  // Normalize minus sign
  const decNormalized = dec.replace("−", "-");
  const decRegex = /(-?\d+)°(\d+)′(\d+)″/;
  const match = decNormalized.match(decRegex);
  if (!match) return 0;
  const degrees = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const totalDegrees =
    Math.abs(degrees) + minutes / 60 + seconds / 3600;
  const sign = degrees < 0 ? -1 : 1;
  const decDegreesSigned = sign * totalDegrees;
  return (decDegreesSigned * Math.PI) / 180; // radians
};

// Convert RA, Dec, Distance to Cartesian coordinates
const raDecToXYZ = (ra, dec, distance) => {
  const raRad = raToRadians(ra);
  const decRad = decToRadians(dec);
  const scaledDistance = distance * 0.5; // scale factor to keep map in view
  const x = scaledDistance * Math.cos(decRad) * Math.cos(raRad);
  const y = scaledDistance * Math.sin(decRad);
  const z = scaledDistance * Math.cos(decRad) * Math.sin(raRad);
  return new THREE.Vector3(x, y, z);
};

// 🌈 Spectral type → colour mapping
const spectralToColor = (spectralType) => {
  if (!spectralType) return 0xffffff;
  const s = spectralType.trim()[0].toUpperCase();
  switch (s) {
    case "O": return 0x3399ff; // bright blue
    case "B": return 0x66ccff; // bright white-blue
    case "A": return 0xffffff; // pure white
    case "F": return 0xffff99; // light yellow
    case "G": return 0xffff33; // bright yellow
    case "K": return 0xff9900; // strong orange
    case "M": return 0xff3300; // vivid red
    case "L": return 0x996633; // warm brown
    case "T": return 0x9933cc; // purple
    case "Y": return 0x330033; // dark dark purple
    default: return 0xffffff;
  }
};

export default function Starfield() {
  const mountRef = useRef(null);
  const [selectedStar, setSelectedStar] = useState(null);
  const selectedStarRef = useRef(null);
  const starsRef = useRef([]);
  const labelsRef = useRef([]);
  const gridHelperRef = useRef(null);
  const circularGridRef = useRef(null);
  const stalksRef = useRef([]);
  const connectionsRef = useRef([]);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const highlightRef = useRef(null);
  const isDragging = useRef(false);
  const clockRef = useRef(new THREE.Clock());
  const hoveredStarRef = useRef(null);
  // Refs for smooth camera focus
  const focusTargetRef = useRef(null);
  const focusProgressRef = useRef(0);
  const focusStartTimeRef = useRef(0);
  // Track grid mode: "square" or "circular"
  const [gridMode, setGridMode] = useState("circular");
  // State for visibility toggles
  const [showGrid, setShowGrid] = useState(true);
  // Remove showStalks state, replaced by connectionMode
  // const [showStalks, setShowStalks] = useState(true);
  // New state for connection mode: "stalks" or "connections"
  const [connectionMode, setConnectionMode] = useState("connections");

  const [showLabels, setShowLabels] = useState(true);

  // Helper to update visibility of stalks/connections based on connectionMode
  function updateConnectionsVisibility() {
    if (stalksRef.current && Array.isArray(stalksRef.current)) {
      stalksRef.current.forEach(obj => {
        if (obj && obj.visible !== undefined) {
          obj.visible = connectionMode === "stalks";
        }
      });
    }
    if (connectionsRef.current && Array.isArray(connectionsRef.current)) {
      connectionsRef.current.forEach(obj => {
        if (obj && obj.visible !== undefined) {
          obj.visible = connectionMode === "connections";
        }
      });
    }
  }

  useEffect(() => {
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.background);
    sceneRef.current = scene;

    const aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;

    const perspectiveCamera = new THREE.PerspectiveCamera(
      60,
      aspect,
      0.1,
      1000
    );
    perspectiveCamera.position.set(0, 5, 12);

    cameraRef.current = perspectiveCamera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(cameraRef.current, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Highlight Sprite
    const highlightTexture = createHighlightTexture();
    const highlightMaterial = new THREE.SpriteMaterial({
      map: highlightTexture,
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });
    const highlight = new THREE.Sprite(highlightMaterial);
    highlight.scale.set(0.5, 0.5, 1);
    highlight.visible = false;
    scene.add(highlight);
    highlightRef.current = highlight;

    // Grid helper
    const gridHelper = new THREE.GridHelper(20, 10, COLORS.gridSquare, COLORS.gridSquareMinor);
    gridHelper.visible = false;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // Circular grid (concentric rings)
    const circularGridGroup = new THREE.Group();
    // Radii in light years (scaled by 0.5)
    const ringDistances = [4, 8, 12, 16, 20];
    const segments = 128;
    ringDistances.forEach((ly) => {
      const radius = ly * 0.5;
      const ringGeometry = new THREE.BufferGeometry();
      const positions = [];
      for (let i = 0; i < segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        positions.push(radius * Math.cos(theta), 0, radius * Math.sin(theta));
      }
      ringGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3)
      );
      const ringMaterial = new THREE.LineBasicMaterial({
        color: COLORS.gridCircular,
        linewidth: 1,
        opacity: 0.7,
        transparent: true,
      });
      const ring = new THREE.LineLoop(ringGeometry, ringMaterial);
      circularGridGroup.add(ring);
    });
    // Add NESW radial cross lines
    const maxRadius = 20 * 0.5;
    const lineMaterial = new THREE.LineBasicMaterial({
      color: COLORS.gridCircular,
      linewidth: 1,
      opacity: 0.7,
      transparent: true,
    });
    // E-W line: from (-maxRadius, 0, 0) to (maxRadius, 0, 0)
    {
      const ewGeometry = new THREE.BufferGeometry();
      ewGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [-maxRadius, 0, 0, maxRadius, 0, 0],
          3
        )
      );
      const ewLine = new THREE.Line(ewGeometry, lineMaterial);
      circularGridGroup.add(ewLine);
    }
    // N-S line: from (0, 0, -maxRadius) to (0, 0, maxRadius)
    {
      const nsGeometry = new THREE.BufferGeometry();
      nsGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [0, 0, -maxRadius, 0, 0, maxRadius],
          3
        )
      );
      const nsLine = new THREE.Line(nsGeometry, lineMaterial);
      circularGridGroup.add(nsLine);
    }
    // NE-SW line: from (-maxRadius/Math.SQRT2, 0, -maxRadius/Math.SQRT2) to (maxRadius/Math.SQRT2, 0, maxRadius/Math.SQRT2)
    {
      const d = maxRadius / Math.SQRT2;
      const neswGeometry = new THREE.BufferGeometry();
      neswGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [-d, 0, -d, d, 0, d],
          3
        )
      );
      const neswLine = new THREE.Line(neswGeometry, lineMaterial);
      circularGridGroup.add(neswLine);
    }
    // NW-SE line: from (-maxRadius/Math.SQRT2, 0, maxRadius/Math.SQRT2) to (maxRadius/Math.SQRT2, 0, -maxRadius/Math.SQRT2)
    {
      const d = maxRadius / Math.SQRT2;
      const nwseGeometry = new THREE.BufferGeometry();
      nwseGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [-d, 0, d, d, 0, -d],
          3
        )
      );
      const nwseLine = new THREE.Line(nwseGeometry, lineMaterial);
      circularGridGroup.add(nwseLine);
    }
    circularGridGroup.visible = true;
    scene.add(circularGridGroup);
    circularGridRef.current = circularGridGroup;

    // Load stars from JSON
    async function loadStars() {
      try {
        const response = await fetch("/data/stars.json");
        const data = await response.json();

        starsRef.current = []; // reset
        labelsRef.current = []; // reset
        stalksRef.current = []; // reset
        connectionsRef.current = []; // reset
        const starGeometry = new THREE.SphereGeometry(0.1, 16, 16);

        // First, create all stars, stalks, ellipses, and labels
        data.forEach((starInfo) => {
          // Debug colours
          console.log(
            starInfo.name,
            starInfo.spectral_type,
            spectralToColor(starInfo.spectral_type)
          );

          const spectralType = starInfo.components?.[0]?.spectral_type;
          const baseColor = spectralToColor(spectralType);
          const starMaterial = new THREE.MeshBasicMaterial({ color: baseColor });
          const star = new THREE.Mesh(starGeometry, starMaterial);

          // Store original color
          star.userData.originalColor = baseColor;

          // Position using RA/Dec → XYZ conversion
          const pos = raDecToXYZ(
            starInfo.ra,
            starInfo.dec,
            starInfo.distance_ly
          );
          star.position.copy(pos);

          star.userData = starInfo;
          scene.add(star);
          starsRef.current.push(star);

          // Create stalk line from star down to y=0
          const points = [];
          points.push(new THREE.Vector3(pos.x, pos.y, pos.z));
          points.push(new THREE.Vector3(pos.x, 0, pos.z));
          const stalkGeometry = new THREE.BufferGeometry().setFromPoints(points);
          const stalkMaterial = new THREE.LineBasicMaterial({ color: COLORS.stalkLine, linewidth: 1 });
          const stalkLine = new THREE.Line(stalkGeometry, stalkMaterial);
          scene.add(stalkLine);
          stalkLine.visible = connectionMode === "stalks";
          stalksRef.current.push(stalkLine);

          // Create small ellipse (circle) at base (y=0)
          const ellipseRadius = 0.05;
          const ellipseSegments = 16;
          const ellipseGeometry = new THREE.CircleGeometry(ellipseRadius, ellipseSegments);
          // Rotate to lie flat on XZ plane
          ellipseGeometry.rotateX(-Math.PI / 2);
          const ellipseMaterial = new THREE.MeshBasicMaterial({ color: COLORS.stalkEllipse });
          const ellipseMesh = new THREE.Mesh(ellipseGeometry, ellipseMaterial);
          ellipseMesh.position.set(pos.x, 0, pos.z);
          scene.add(ellipseMesh);
          ellipseMesh.visible = connectionMode === "stalks";
          stalksRef.current.push(ellipseMesh);

          // Create label using troika-three-text
          const label = new Text();
          label.text = (starInfo.name || starInfo.components?.[0]?.name || "").toUpperCase();
          label.font = "/fonts/Orbitron-Regular.ttf";
          label.fontSize = 0.20;
          label.color = COLORS.labelText;

          // Keep label anchored at star’s world position
          label.position.copy(pos);

          // Anchor the text so it renders out to the right of the star
          label.anchorX = "left";     // push text right of anchor point
          label.anchorY = "middle";   // vertically center

          label.userData.starRef = star;
          label.userData.pad = 0.2;      // horizontal padding from star
          label.userData.vOffset = 0;

          label.sync();
          scene.add(label);
          labelsRef.current.push(label);
        });

        // Compute nearest-3 connections for each star
        // Only add if star index < neighbour index to avoid duplicates
        const stars = starsRef.current;
        for (let i = 0; i < stars.length; i++) {
          const star = stars[i];
          // Compute distances to all other stars
          const distances = [];
          for (let j = 0; j < stars.length; j++) {
            if (i === j) continue;
            const other = stars[j];
            const dist = star.position.distanceTo(other.position);
            distances.push({ index: j, dist });
          }
          // Sort by distance and pick 3 nearest
          distances.sort((a, b) => a.dist - b.dist);
          for (let k = 0; k < Math.min(3, distances.length); k++) {
            const neighbourIdx = distances[k].index;
            if (i < neighbourIdx) {
              // Create a line between star and neighbour
              const neighbour = stars[neighbourIdx];
              const lineGeom = new THREE.BufferGeometry().setFromPoints([
                star.position,
                neighbour.position
              ]);
              const lineMat = new THREE.LineBasicMaterial({
                color: COLORS.connectionLine,
                linewidth: 1,
                opacity: 0.7,
                transparent: true
              });
              const line = new THREE.Line(lineGeom, lineMat);
              line.visible = connectionMode === "connections";
              scene.add(line);
              connectionsRef.current.push(line);
            }
          }
        }
        // After all stalks and connections have been pushed, update their visibility
        updateConnectionsVisibility();
      } catch (err) {
        console.error("Failed to load stars.json:", err);
      }
    }
    loadStars();

    // Resize handler
    const handleResize = () => {
      const aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      cameraRef.current.aspect = aspect;
      cameraRef.current.updateProjectionMatrix();

      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let mouseDownPos = new THREE.Vector2();

    const onMouseDown = (event) => {
      isDragging.current = false;
      mouseDownPos.set(event.clientX, event.clientY);
    };

    const onMouseMove = (event) => {
      const deltaX = Math.abs(event.clientX - mouseDownPos.x);
      const deltaY = Math.abs(event.clientY - mouseDownPos.y);
      if (deltaX > 5 || deltaY > 5) {
        isDragging.current = true;
      }
    };

    const onMouseUp = (event) => {
      if (event.button !== 0) return; // only handle left mouse button
      if (isDragging.current) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(starsRef.current);

      if (intersects.length > 0) {
        const star = intersects[0].object;
        if (selectedStarRef.current === star) {
          // Deselect
          setSelectedStar(null);
          selectedStarRef.current = null;
          highlight.visible = false;
        } else {
          // Select
          setSelectedStar(star.userData);
          selectedStarRef.current = star;
          highlight.position.copy(star.position);
          highlight.visible = true;
        }
      } else {
        // Clicked empty space → deselect
        setSelectedStar(null);
        selectedStarRef.current = null;
        highlight.visible = false;
      }
    };

    const onPointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(starsRef.current);

      if (intersects.length > 0) {
        const star = intersects[0].object;
        if (hoveredStarRef.current !== star) {
          hoveredStarRef.current = star;
          highlight.position.copy(star.position);
          highlight.visible = true;
        }
      } else {
        if (!selectedStarRef.current) {
          highlight.visible = false;
        }
        hoveredStarRef.current = null;
      }
    };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("pointermove", onPointerMove);

    // Function to trigger smooth camera focus on a star
    const focusOnStar = (star) => {
      if (!star) return;
      focusTargetRef.current = star.position.clone();
      focusProgressRef.current = 0;
      focusStartTimeRef.current = performance.now(); // record start time
    };

    // Right mouse button (context menu) handler to smoothly focus on selected star and keep InfoPanel open
    const onRightClick = (event) => {
      event.preventDefault();
      if (selectedStarRef.current) {
        focusOnStar(selectedStarRef.current);
        setSelectedStar(selectedStarRef.current.userData); // keep InfoPanel open
      }
    };
    renderer.domElement.addEventListener("contextmenu", onRightClick);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      // Smooth camera focus lerp
      if (focusTargetRef.current) {
        // Use elapsed time for smooth, duration-based animation
        const elapsed = (performance.now() - focusStartTimeRef.current) / 1000; // seconds
        const duration = 2.0; // seconds for full focus
        const t = Math.min(elapsed / duration, 1);
        focusProgressRef.current = t;

        // Lerp OrbitControls target
        controlsRef.current.target.lerp(focusTargetRef.current, t);

        // Lerp camera spherical radius smoothly towards a closer distance
        const offset = cameraRef.current.position.clone().sub(controlsRef.current.target);
        const spherical = new THREE.Spherical().setFromVector3(offset);

        const desiredRadius = 5; // zoom distance
        spherical.radius = THREE.MathUtils.lerp(spherical.radius, desiredRadius, t);

        // Recalculate camera position from spherical
        const newPos = new THREE.Vector3().setFromSpherical(spherical).add(controlsRef.current.target);
        cameraRef.current.position.copy(newPos);

        controlsRef.current.update();

        if (t >= 1) {
          focusTargetRef.current = null; // stop lerping after finished
        }
      } else {
        controlsRef.current.update();
      }

      if (highlightRef.current.visible) {
        const elapsedTime = clockRef.current.getElapsedTime();
        const pulse = (Math.sin(elapsedTime * Math.PI * 2) + 1) / 2;
        const scale = 0.5 + pulse * 0.1; // 0.5 → 0.6
        highlightRef.current.scale.set(scale, scale, 1);
      }

      // Make labels face the camera and offset properly
      labelsRef.current.forEach(label => {
        const star = label.userData.starRef;
        if (!star) return;

        // Calculate right and up vectors from the camera
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        const cam = cameraRef.current;
        cam.getWorldDirection(right);
        right.cross(cam.up).normalize(); // camera right vector
        up.copy(cam.up).normalize();     // camera up vector

        // Position = star position + offset
        const basePos = star.position.clone();
        const offset = right.multiplyScalar(label.userData.pad || 0.3)
          .add(up.multiplyScalar(label.userData.vOffset || 0));
        label.position.copy(basePos.add(offset));

        // Keep facing camera
        label.quaternion.copy(cam.quaternion);
        label.sync();
      });

      renderer.render(scene, cameraRef.current);
    };
    animate();

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("contextmenu", onRightClick);
      mountRef.current.removeChild(renderer.domElement);
    };

  }, []); // end useEffect

  useEffect(() => {
    updateConnectionsVisibility();
  }, [connectionMode]);

  useEffect(() => {
    if (labelsRef.current) {
      labelsRef.current.forEach(label => {
        label.visible = showLabels;
      });
    }
  }, [showLabels]);

  // Sidebar controls
  // Toggle between grid modes: "square" and "circular"
  const toggleGridMode = () => {
    if (
      !gridHelperRef.current ||
      !circularGridRef.current
    ) {
      return;
    }
    if (gridMode === "square") {
      gridHelperRef.current.visible = false;
      circularGridRef.current.visible = true;
      setGridMode("circular");
    } else {
      gridHelperRef.current.visible = true;
      circularGridRef.current.visible = false;
      setGridMode("square");
    }
  };

  // Toggle grid visibility
  const toggleGridVisibility = () => {
    setShowGrid((prev) => {
      const newVal = !prev;
      if (gridHelperRef.current) gridHelperRef.current.visible = newVal && gridMode === "square";
      if (circularGridRef.current) circularGridRef.current.visible = newVal && gridMode === "circular";
      return newVal;
    });
  };

  // Remove toggleStalksVisibility, replaced by handleConnectionModeChange

  // Handle connection mode change ("stalks" or "connections")
  const handleConnectionModeChange = (mode) => {
    console.log("Connection mode changed to:", mode);
    setConnectionMode(mode);
  };

  const toggleLabelsVisibility = () => {
    setShowLabels(prev => !prev);
  };

  return (
    <>
      <Sidebar
        onToggleGridMode={toggleGridMode}
        onToggleGridVisibility={toggleGridVisibility}
        onChangeConnectionMode={handleConnectionModeChange}
        onToggleLabels={toggleLabelsVisibility}
      />
      <div ref={mountRef} style={{ width: "100%", height: "100vh" }} />
      <InfoPanel
        star={selectedStar}
        onClose={() => {
          setSelectedStar(null);
          selectedStarRef.current = null;
          if (highlightRef.current) highlightRef.current.visible = false;
        }}
      />
    </>
  );
}