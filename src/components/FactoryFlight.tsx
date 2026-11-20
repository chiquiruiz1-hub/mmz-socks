import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ArrowRight } from 'lucide-react';

const PAL = ['#F2C14E', '#E36F73', '#2A9DB8', '#FFF6E0', '#4CAF7A', '#7CB5C9'];
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const win = (p: number, a: number, b: number, c: number, d: number) => clamp(Math.min((p - a) / (b - a), (d - p) / (d - c)));

/** Vuelo con el scroll: hilos → máquina de tejer → calcetín 3D. Todo función del scroll (p de 0 a 1). */
export const FactoryFlight: React.FC = () => {
  const sec = useRef<HTMLElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const t1 = useRef<HTMLDivElement>(null);
  const t2 = useRef<HTMLDivElement>(null);
  const t3 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = cv.current, section = sec.current;
    if (!canvas || !section) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.innerWidth < 768;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0A1A23');
    scene.fog = new THREE.FogExp2(0x0a1a23, 0.016);
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 200);

    // --- Hilos del túnel (con giro helicoidal, se estrechan hacia la máquina)
    const strands = mobile ? 90 : 170;
    const tunnel = new THREE.Group(); scene.add(tunnel);
    const Z0 = 30, Z1 = -62;
    for (let i = 0; i < strands; i++) {
      const pts: number[] = [], cols: number[] = [];
      const a0 = Math.random() * Math.PI * 2, r0 = 0.6 + Math.random() * 3.2, tw = (Math.random() - 0.5) * 0.12;
      const c = new THREE.Color(PAL[i % PAL.length]);
      for (let k = 0; k <= 90; k++) {
        const z = Z0 + (Z1 - Z0) * (k / 90);
        const funnel = 1 - 0.78 * Math.exp(-Math.pow((z + 38) / 14, 2)); // se cierra en la máquina
        const r = r0 * funnel;
        const a = a0 + z * tw;
        pts.push(Math.cos(a) * r, Math.sin(a) * r, z);
        cols.push(c.r, c.g, c.b);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      tunnel.add(new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })));
    }
    // fibras sueltas
    const nP = mobile ? 500 : 1400, pp = new Float32Array(nP * 3);
    for (let i = 0; i < nP; i++) { const a = Math.random() * 6.28, r = 0.4 + Math.random() * 5; pp.set([Math.cos(a) * r, Math.sin(a) * r, Z0 - Math.random() * (Z0 - Z1)], i * 3); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    scene.add(new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.05, color: 0xfff1c8, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending })));

    // --- Máquina de tejer circular: corona de agujas + aros dorados
    const machine = new THREE.Group(); machine.position.z = -38; scene.add(machine);
    const gold = new THREE.MeshStandardMaterial({ color: '#F2C14E', metalness: 0.9, roughness: 0.25, emissive: '#6b4a08', emissiveIntensity: 0.6 });
    const steel = new THREE.MeshStandardMaterial({ color: '#9fb4bf', metalness: 0.95, roughness: 0.3 });
    for (const z of [-1.4, 1.4]) { const t = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.12, 12, 72), gold); t.position.z = z; machine.add(t); }
    const nN = 64, needles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6), steel, nN);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < nN; i++) {
      const a = (i / nN) * Math.PI * 2;
      e.set(Math.PI / 2, 0, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(Math.cos(a) * 1.7, Math.sin(a) * 1.7, 0), q, new THREE.Vector3(1, 1, 1));
      needles.setMatrixAt(i, m4);
    }
    machine.add(needles);
    const scan = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.035, 8, 96), new THREE.MeshBasicMaterial({ color: '#F2C14E' }));
    machine.add(scan);
    const glow = new THREE.PointLight('#F2C14E', 40, 18); machine.add(glow);

    // --- Luces + calcetín
    scene.add(new THREE.HemisphereLight('#bfe8f5', '#1a2a33', 1.1));
    const key = new THREE.DirectionalLight('#fff3d6', 2.2); key.position.set(3, 4, -48); scene.add(key);
    const rim = new THREE.PointLight('#2A9DB8', 60, 30); rim.position.set(-4, 1, -70); scene.add(rim);
    const sockPivot = new THREE.Group(); sockPivot.position.set(0, 1.2, -78); scene.add(sockPivot);
    let disposed = false;
    import('../assets/sockGlb').then(({ default: b64 }) => {
      if (disposed) return;
      const bin = atob(b64), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      new GLTFLoader().parse(buf.buffer, '', (gltf) => {
        if (disposed) return;
        const box = new THREE.Box3().setFromObject(gltf.scene), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
        const s = 8.5 / Math.max(size.x, size.y, size.z);
        gltf.scene.scale.setScalar(s); gltf.scene.position.sub(ctr.multiplyScalar(s));
        sockPivot.add(gltf.scene);
      }, () => {});
    });

    // --- Tamaño y bucle
    const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    let visible = true, raf = 0, shown = 0, target = 0, spin = 0, last = performance.now();
    const getP = () => {
      const r = section.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - window.innerHeight));
    };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      target = getP();
      shown = reduce ? 0.96 : shown + (target - shown) * Math.min(1, dt * 6);
      const p = shown;
      // cámara a lo largo del recorrido
      const z = THREE.MathUtils.lerp(26, -64, Math.pow(p, 0.92));
      cam.position.set(Math.sin(p * 9) * 0.35 * (1 - p), Math.cos(p * 7) * 0.25 * (1 - p), z);
      cam.rotation.z = Math.sin(p * 5) * 0.06 * (1 - p);
      cam.lookAt(cam.position.x * 0.5, cam.position.y * 0.5, z - 10);
      spin += dt;
      machine.rotation.z = spin * 0.6 + p * 4;
      scan.scale.setScalar(1 + Math.sin(spin * 3) * 0.03);
      sockPivot.rotation.y = spin * 0.7;
      const inS = clamp((p - 0.7) / 0.2);
      sockPivot.scale.setScalar(0.4 + 0.6 * inS); sockPivot.visible = inS > 0.01;
      tunnel.rotation.z = p * 1.2;
      renderer.render(scene, cam);
      // textos
      const set = (el: HTMLDivElement | null, v: number, dy: number) => { if (el) { el.style.opacity = `${v}`; el.style.transform = `translateY(${(1 - v) * dy}px)`; el.style.pointerEvents = v > 0.5 ? 'auto' : 'none'; } };
      set(t1.current, win(p, 0.0, 0.06, 0.2, 0.3), 30);
      set(t2.current, win(p, 0.3, 0.38, 0.52, 0.62), 30);
      set(t3.current, clamp((p - 0.8) / 0.12), 40);
      if (visible && !reduce) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } }, { rootMargin: '200px' });
    io.observe(section);
    raf = requestAnimationFrame(frame);
    if (reduce) setTimeout(() => requestAnimationFrame(frame), 800);

    return () => {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose()); });
      renderer.dispose();
    };
  }, []);

  const box = 'absolute inset-x-0 px-6 text-center text-white will-change-transform';
  return (
    <section ref={sec} id="fabrica-3d" aria-label="Recorrido por la fábrica: del hilo al calcetín" style={{ height: '480vh' }} className="relative bg-[#0A1A23]">
      <div className="sticky top-0 h-screen overflow-hidden">
        <canvas ref={cv} className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(10,26,35,.75)_100%)]" />
        <div ref={t1} className={`${box} top-[18%]`}>
          <p className="text-xs tracking-[.35em] uppercase text-yarn-mustard">01 · El hilo</p>
          <h2 className="font-display font-bold text-4xl sm:text-6xl mt-3">Todo empieza con un hilo</h2>
          <p className="mt-3 text-white/70 max-w-md mx-auto">Entra con nosotros en la fábrica de Pradoluengo.</p>
        </div>
        <div ref={t2} className={`${box} top-[14%]`} style={{ opacity: 0 }}>
          <p className="text-xs tracking-[.35em] uppercase text-yarn-mustard">02 · La máquina</p>
          <h2 className="font-display font-bold text-4xl sm:text-6xl mt-3">Cada aguja, una puntada</h2>
          <p className="mt-3 text-white/70 max-w-md mx-auto">Tejeduría circular: sin costuras, sin rozaduras.</p>
        </div>
        <div ref={t3} className={`${box} bottom-[9%]`} style={{ opacity: 0 }}>
          <p className="text-xs tracking-[.35em] uppercase text-yarn-mustard">03 · Tu calcetín</p>
          <h2 className="font-display font-bold text-4xl sm:text-6xl mt-3">Ahora, diseña el tuyo</h2>
          <a href="#configurador" className="mt-6 inline-flex items-center gap-2.5 px-7 py-4 font-bold text-petrol-900 bg-yarn-mustard hover:bg-white rounded-2xl shadow-[0_0_40px_rgba(242,193,78,.35)] transition">
            Diseña tu calcetín <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
};
