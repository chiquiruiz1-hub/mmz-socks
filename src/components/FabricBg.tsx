import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes; uniform vec2 uMouse; uniform float uTime, uForce, uScroll, uCell;
float hash(float n){ return fract(sin(n*127.1)*43758.5453); }
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
void main(){
  float asp = uRes.x/uRes.y;
  vec2 st = vec2(vUv.x*asp, vUv.y);
  vec2 m = vec2(uMouse.x*asp, uMouse.y);
  vec2 d = st - m; float r = length(d);
  // la tela se estira y se arruga donde la tocas
  float bulge = exp(-r*r*14.)*uForce;
  st -= d*bulge*0.55;
  st += 0.010*vec2(sin(st.y*9.+uTime*.6+uScroll*6.), cos(st.x*7.-uTime*.5));
  st += 0.02*bulge*vec2(sin(r*60.-uTime*5.), cos(r*60.-uTime*5.));
  vec2 cell = vec2(st.x*uRes.y/(uCell*.8), st.y*uRes.y/uCell);
  vec2 id = floor(cell); vec2 p = fract(cell);
  float dl = seg(p, vec2(0.,1.05), vec2(.5,-.05));
  float dr = seg(p, vec2(1.,1.05), vec2(.5,-.05));
  float dd = min(dl, dr);
  float w = .27;
  float t = clamp(dd/w, 0., 1.);
  float h = sqrt(1.-t*t)*smoothstep(1.0,.82,t);
  vec3 n = normalize(vec3(-dFdx(h)*uCell*.9, -dFdy(h)*uCell*.9, 1.));
  vec3 L = normalize(vec3(m - vec2(vUv.x*asp, vUv.y), .32));
  float diff = clamp(dot(n, L), 0., 1.);
  float rowH = hash(id.y*1.7);
  vec3 base = vec3(.12,.30,.39);
  if (rowH > .86) base = vec3(.95,.76,.31);
  else if (rowH > .74) base = vec3(.89,.44,.45);
  else if (rowH > .64) base = vec3(.16,.62,.72);
  base *= .85 + .3*hash(id.x*3.1 + id.y*7.3);
  float lit = .22 + 1.15*diff*h + .35*exp(-r*r*10.)*h;
  vec3 col = base*lit*h + base*.06;
  col += vec3(1.,.9,.7)*pow(diff,18.)*h*.25*exp(-r*r*6.);
  col *= .55 + .45*smoothstep(1.2, .2, length(vUv-.5));
  gl_FragColor = vec4(col, 1.);
}`;

export const FabricBg: React.FC<{ className?: string }> = ({ className }) => {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = cv.current; if (!canvas) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.innerWidth < 768;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5));
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const U = { uRes: { value: new THREE.Vector2(1, 1) }, uMouse: { value: new THREE.Vector2(.7, .5) }, uTime: { value: 0 }, uForce: { value: 0.3 }, uScroll: { value: 0 }, uCell: { value: mobile ? 20 : 26 } };
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U })));

    const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); const pr = renderer.getPixelRatio(); U.uRes.value.set(w * pr, h * pr); U.uCell.value = (mobile ? 20 : 26) * pr; };
    resize(); const ro = new ResizeObserver(resize); ro.observe(canvas);

    const target = new THREE.Vector2(.7, .5), cur = new THREE.Vector2(.7, .5);
    let lastInput = -10, force = 0.3, raf = 0, visible = true, last = performance.now(), t = 0;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return;
      target.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
      lastInput = t;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });

    const frame = (now: number) => {
      const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
      if (t - lastInput > 2.5) target.set(.62 + Math.sin(t * .5) * .3, .5 + Math.cos(t * .37) * .25); // sin tocar: se mueve sola
      const px = cur.x, py = cur.y;
      cur.lerp(target, Math.min(1, dt * 7));
      const speed = Math.hypot(cur.x - px, cur.y - py) / Math.max(dt, .001);
      force += ((Math.min(1.3, .35 + speed * 1.6)) - force) * Math.min(1, dt * 5);
      U.uMouse.value.copy(cur); U.uForce.value = force; U.uTime.value = t;
      U.uScroll.value = Math.min(1.5, window.scrollY / 800);
      renderer.render(scene, cam);
      if (visible && !reduce) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } });
    io.observe(canvas);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerdown', onMove); renderer.dispose(); };
  }, []);
  return <canvas ref={cv} className={className} aria-hidden="true" />;
};
