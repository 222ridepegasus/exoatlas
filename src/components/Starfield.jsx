import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import InfoPanel from "./InfoPanel.jsx";
import Sidebar from "./Sidebar.jsx";

const createHighlightTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  // Outer ring
  context.beginPath();
  context.arc(64, 64, 40, 0, 2 * Math.PI);
  context.lineWidth = 8;
  context.strokeStyle = "rgba(255, 255, 255, 1)";
  context.stroke();

  // Inner glow
  context.beginPath();
  context.arc(64, 64, 48, 0, 2 * Math.PI);
  context.lineWidth = 4;
  context.strokeStyle = "rgba(255, 255, 255, 0.5)";
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

export default function Starfield() {
  const mountRef = useRef(null);
  const [selectedStar, setSelectedStar] = useState(null);
  const selectedStarRef = useRef(null);
  const starsRef = useRef([]);
  const gridHelperRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const highlightRef = useRef(null);
  const isDragging = useRef(false);
  const clockRef = useRef(new THREE.Clock());

  useEffect(() => {
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0f1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 5, 12);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
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
    const gridHelper = new THREE.GridHelper(20, 10, 0x888888, 0x444444);
    gridHelper.visible = true;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // Load stars from JSON
    async function loadStars() {
      try {
        const response = await fetch("/data/stars.json");
        const data = await response.json();

        starsRef.current = []; // reset
        const starGeometry = new THREE.SphereGeometry(0.1, 16, 16);

        data.forEach((starInfo) => {
          const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
          const star = new THREE.Mesh(starGeometry, starMaterial);

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
          const stalkMaterial = new THREE.LineBasicMaterial({ color: 0x445577, linewidth: 1 });
          const stalkLine = new THREE.Line(stalkGeometry, stalkMaterial);
          scene.add(stalkLine);

          // Create small ellipse (circle) at base (y=0)
          const ellipseRadius = 0.05;
          const ellipseSegments = 16;
          const ellipseGeometry = new THREE.CircleGeometry(ellipseRadius, ellipseSegments);
          // Rotate to lie flat on XZ plane
          ellipseGeometry.rotateX(-Math.PI / 2);
          const ellipseMaterial = new THREE.MeshBasicMaterial({ color: 0x445577 });
          const ellipseMesh = new THREE.Mesh(ellipseGeometry, ellipseMaterial);
          ellipseMesh.position.set(pos.x, 0, pos.z);
          scene.add(ellipseMesh);
        });
      } catch (err) {
        console.error("Failed to load stars.json:", err);
      }
    }
    loadStars();

    // Resize handler
    const handleResize = () => {
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
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
      if (isDragging.current) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
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

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("mouseup", onMouseUp);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();

      if (highlight.visible) {
        const elapsedTime = clockRef.current.getElapsedTime();
        const pulse = (Math.sin(elapsedTime * Math.PI * 2) + 1) / 2;
        const scale = 0.5 + pulse * 0.1; // 0.5 → 0.6
        highlight.scale.set(scale, scale, 1);
      }

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("mouseup", onMouseUp);
      mountRef.current.removeChild(renderer.domElement);
    };
  }, []); // end useEffect

  // Sidebar controls
  const toggleGrid = () => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = !gridHelperRef.current.visible;
    }
  };

  return (
    <>
      <Sidebar onToggleGrid={toggleGrid} />
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