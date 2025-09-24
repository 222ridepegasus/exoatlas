import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import InfoPanel from "./InfoPanel.jsx";
import Sidebar from "./Sidebar.jsx";

export default function Starfield() {
  const mountRef = useRef(null);
  const [selectedStar, setSelectedStar] = useState(null);
  const starsRef = useRef([]);
  const gridHelperRef = useRef(null);
  const highlightRingRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    const starData = [
      { name: "Alpha-1", distance: 4.2, type: "G2V" },
      { name: "Beta-2", distance: 7.9, type: "K3V" },
      { name: "Gamma-3", distance: 12.5, type: "M1V" },
      { name: "Delta-4", distance: 22.1, type: "F5V" },
      { name: "Epsilon-5", distance: 30.0, type: "A0V" },
      { name: "Zeta-6", distance: 45.2, type: "M3V" },
      { name: "Eta-7", distance: 55.6, type: "G5V" },
      { name: "Theta-8", distance: 66.8, type: "K1V" },
      { name: "Iota-9", distance: 77.3, type: "F9V" },
      { name: "Kappa-10", distance: 89.0, type: "M5V" },
    ];

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

    const handleResize = () => {
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // Grid helper
    const gridHelper = new THREE.GridHelper(20, 10, 0x888888, 0x444444);
    gridHelper.visible = true;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // Stars
    starsRef.current = []; // reset

    const starGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let i = 0; i < starData.length; i++) {
      const star = new THREE.Mesh(starGeometry, starMaterial.clone());

      // initial random position
      star.position.set(
        (Math.random() - 0.5) * 10,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 10
      );

      star.userData = starData[i];
      scene.add(star);
      starsRef.current.push(star);
    }

    // Highlight ring
    const ringGeometry = new THREE.RingGeometry(0.15, 0.18, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      side: THREE.DoubleSide,
    });
    const highlightRing = new THREE.Mesh(ringGeometry, ringMaterial);
    highlightRing.rotation.x = Math.PI / 2;
    highlightRing.visible = false;
    scene.add(highlightRing);
    highlightRingRef.current = highlightRing;

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(starsRef.current);

      if (intersects.length > 0) {
        const star = intersects[0].object;
        highlightRing.position.copy(star.position);
        highlightRing.visible = true;
        setSelectedStar(star.userData);
      }
    };

    renderer.domElement.addEventListener("click", onClick);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      if (highlightRingRef.current) {
        highlightRingRef.current.lookAt(camera.position);
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", onClick);
      mountRef.current.removeChild(renderer.domElement);
    };
  }, []); // run only once on mount

  const randomizeStars = () => {
    starsRef.current.forEach((star) => {
      star.position.set(
        (Math.random() - 0.5) * 10,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 10
      );
    });
    // Hide highlight ring when stars are randomized
    if (highlightRingRef.current) {
      highlightRingRef.current.visible = false;
    }
    setSelectedStar(null);
  };

  const toggleGrid = () => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = !gridHelperRef.current.visible;
    }
  };

  return (
    <>
      <Sidebar
        onToggleGrid={toggleGrid}
        onRandomize={randomizeStars}
      />
      <div ref={mountRef} style={{ width: "100%", height: "100vh" }} />
      <InfoPanel star={selectedStar} onClose={() => setSelectedStar(null)} />
    </>
  );
}