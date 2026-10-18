/**
 * WorldQuant BRAIN Quantum Portal - Bioluminescent Canvas & Motion Graphics Engine
 * Recreates the Pelagos Systems dark oceanic bioluminescent visual identity:
 * 1. Fullscreen ambient deep-sea particle field
 * 2. Hero Interactive Bioluminescent Canvas with Cursor Interaction & 4 Topological Modes:
 *    - Mode 01: Stream Drift (Pelagic S-Curve River & Bathymetric Contours)
 *    - Mode 02: Vortex Gyre (Oceanic Mesoscale Eddy & Spiral Singularity)
 *    - Mode 03: Soliton Waves (Harmonic Wave Trains & Constructive Interference)
 *    - Mode 04: Factor Web (Neural Constellation Mesh & High-Speed Data Pulses)
 * 3. Polar radar / compass scanner (Live Overview Card)
 * 4. Micro wave sparklines (Current Intelligence & Recent Activity)
 * 5. 3D undulating ribbon mesh (Showcase Tile)
 */

(function () {
    'use strict';

    // Global Splash Screen Dismissal (Screenshot 2026-10-19 at 3.15.51 AM)
    window.dismissAlphaSplash = function () {
        const splash = document.getElementById('alpha-splash-screen');
        if (!splash || splash.classList.contains('fade-out')) return;
        splash.classList.add('fade-out');
        setTimeout(() => {
            splash.style.display = 'none';
        }, 850);
    };

    setTimeout(() => {
        if (window.dismissAlphaSplash) window.dismissAlphaSplash();
    }, 1350);

    window.addEventListener('keydown', () => {
        if (window.dismissAlphaSplash) window.dismissAlphaSplash();
    }, { once: true });

    // Global hook for 4 hero animation modes
    let currentHeroMode = 1;
    let setHeroModeInternal = null;

    window.setHeroAnimationMode = function (modeNum) {
        modeNum = parseInt(modeNum);
        if (modeNum < 1 || modeNum > 4) return;
        currentHeroMode = modeNum;

        // Update button states
        document.querySelectorAll('.step-btn').forEach(btn => {
            const step = parseInt(btn.getAttribute('data-step'));
            if (step === modeNum) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update hero canvas simulation
        if (typeof setHeroModeInternal === 'function') {
            setHeroModeInternal(modeNum);
        }
    };

    // Keyboard shortcuts (Keys 1, 2, 3, 4)
    window.addEventListener('keydown', (e) => {
        if (['1', '2', '3', '4'].includes(e.key)) {
            // Only trigger if user is not actively typing in an input/textarea
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
            window.setHeroAnimationMode(parseInt(e.key));
        }
    });

    // =========================================================================
    // 1. FULLSCREEN AMBIENT BIOLUMINESCENT PARTICLES
    // =========================================================================
    function initAmbientCanvas() {
        const canvas = document.getElementById('particle-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        const particles = [];
        const count = Math.min(Math.floor((width * height) / 18000), 75);
        const mouse = { x: null, y: null, radius: 150 };

        window.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });

        window.addEventListener('mouseout', () => {
            mouse.x = null;
            mouse.y = null;
        });

        class AmbientParticle {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * 0.45;
                this.vy = (Math.random() - 0.5) * 0.45;
                this.radius = Math.random() * 1.8 + 0.6;
                this.baseAlpha = Math.random() * 0.5 + 0.15;
                this.pulseSpeed = Math.random() * 0.02 + 0.01;
                this.pulseAngle = Math.random() * Math.PI * 2;
                // User luxury tech palette: Luscious Lime, Wet Sand, Whisper White, Bright White
                const hues = ['145, 166, 115', '174, 143, 96', '234, 226, 211', '246, 242, 241'];
                this.color = hues[Math.floor(Math.random() * hues.length)];
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.pulseAngle += this.pulseSpeed;

                if (this.x < 0) this.x = width;
                if (this.x > width) this.x = 0;
                if (this.y < 0) this.y = height;
                if (this.y > height) this.y = 0;

                if (mouse.x !== null && mouse.y !== null) {
                    const dx = mouse.x - this.x;
                    const dy = mouse.y - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < mouse.radius) {
                        const angle = Math.atan2(dy, dx);
                        const force = (mouse.radius - dist) / mouse.radius;
                        this.x -= Math.cos(angle) * force * 1.2;
                        this.y -= Math.sin(angle) * force * 1.2;
                    }
                }
            }

            draw() {
                const alpha = this.baseAlpha + Math.sin(this.pulseAngle) * 0.12;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${this.color}, ${Math.max(0.05, alpha)})`;
                ctx.shadowBlur = 8;
                ctx.shadowColor = `rgba(${this.color}, 0.6)`;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        for (let i = 0; i < count; i++) {
            particles.push(new AmbientParticle());
        }

        // Draw Sci-Fi HUD Telemetry & Ambient Diffuse Lighting (Screenshot 2026-10-19 at 3.18.41 AM)
        function drawHudTelemetry() {
            // 1. Warm Ambient Diffuse Lighting Auras
            const auraGrad = ctx.createRadialGradient(width * 0.18, height * 0.15, 20, width * 0.18, height * 0.15, Math.min(width, height) * 0.6);
            auraGrad.addColorStop(0, 'rgba(174, 143, 96, 0.08)');
            auraGrad.addColorStop(0.5, 'rgba(145, 166, 115, 0.03)');
            auraGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = auraGrad;
            ctx.fillRect(0, 0, width, height);

            // 2. Cursor Ambient Halo
            if (mouse.x !== null && mouse.y !== null) {
                const cursorHalo = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 220);
                cursorHalo.addColorStop(0, 'rgba(174, 143, 96, 0.06)');
                cursorHalo.addColorStop(0.6, 'rgba(145, 166, 115, 0.02)');
                cursorHalo.addColorStop(1, 'transparent');
                ctx.fillStyle = cursorHalo;
                ctx.fillRect(0, 0, width, height);
            }

            // 3. Technical Coordinate Crosshairs (+)
            ctx.save();
            ctx.strokeStyle = 'rgba(234, 226, 211, 0.10)';
            ctx.lineWidth = 1;
            const crosshairs = [
                { x: width * 0.15, y: height * 0.28 },
                { x: width * 0.88, y: height * 0.22 },
                { x: width * 0.12, y: height * 0.78 },
                { x: width * 0.82, y: height * 0.75 },
                { x: width * 0.50, y: height * 0.88 }
            ];
            crosshairs.forEach(pt => {
                ctx.beginPath();
                ctx.moveTo(pt.x - 7, pt.y);
                ctx.lineTo(pt.x + 7, pt.y);
                ctx.moveTo(pt.x, pt.y - 7);
                ctx.lineTo(pt.x, pt.y + 7);
                ctx.stroke();
            });

            // 4. Subtle Telemetry Corner Tags
            ctx.fillStyle = 'rgba(145, 166, 115, 0.35)';
            ctx.font = '9px monospace';
            ctx.fillText('SYS // LAT 40.7128° N  LON 74.0060° W', 115, height - 22);
            ctx.fillText('QUANTUM ALPHA // TELEMETRY LINK ACTIVE', width - 260, height - 22);
            ctx.restore();
        }

        function loop() {
            ctx.clearRect(0, 0, width, height);
            drawHudTelemetry();
            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();
            }
            requestAnimationFrame(loop);
        }
        loop();
    }

    // =========================================================================
    // 2. HERO INTERACTIVE BIOLUMINESCENT CANVAS WITH 4 TOPOLOGICAL MODES
    // =========================================================================
    function initHeroStreamCanvas() {
        const canvas = document.getElementById('hero-stream-canvas');
        const heroContainer = document.querySelector('.hero-right');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let dpr = window.devicePixelRatio || 1;
        let w = 700, h = 420;

        function resize() {
            const rect = canvas.getBoundingClientRect();
            w = rect.width || 700;
            h = rect.height || 420;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
        }
        resize();
        window.addEventListener('resize', resize);

        // ---------------------------------------------------------------------
        // Mouse Tracking & Cursor Interactions (Repulsion, Torch, Parallax 3D)
        // ---------------------------------------------------------------------
        const mouse = {
            x: null,
            y: null,
            active: false,
            vx: 0,
            vy: 0,
            prevX: null,
            prevY: null
        };

        const ripples = []; // Click shockwaves

        if (heroContainer) {
            heroContainer.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                const curX = e.clientX - rect.left;
                const curY = e.clientY - rect.top;

                if (mouse.prevX !== null) {
                    mouse.vx = curX - mouse.prevX;
                    mouse.vy = curY - mouse.prevY;
                }
                mouse.prevX = curX;
                mouse.prevY = curY;
                mouse.x = curX;
                mouse.y = curY;
                mouse.active = true;
            });

            heroContainer.addEventListener('mouseleave', () => {
                mouse.x = null;
                mouse.y = null;
                mouse.active = false;
                mouse.prevX = null;
                mouse.prevY = null;
            });

            // Click shockwave
            heroContainer.addEventListener('pointerdown', (e) => {
                const rect = canvas.getBoundingClientRect();
                ripples.push({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    radius: 4,
                    maxRadius: Math.max(w, h) * 0.65,
                    alpha: 0.9,
                    speed: 5.5
                });
            });
        }

        // ---------------------------------------------------------------------
        // Simulation Particles (480 bioluminescent points)
        // ---------------------------------------------------------------------
        const numParticles = 480;
        const particles = [];

        for (let i = 0; i < numParticles; i++) {
            particles.push({
                // Current position
                x: Math.random() * w,
                y: Math.random() * h,
                // Target coordinates interpolated per mode
                targetX: Math.random() * w,
                targetY: Math.random() * h,
                // Interactive cursor displacement offsets
                dispX: 0,
                dispY: 0,
                // Mode-specific progression params
                t: Math.random(),
                speed: 0.0006 + Math.random() * 0.0014,
                lateralOffset: (Math.random() - 0.5) * 55,
                angle: Math.random() * Math.PI * 2,
                orbitRadius: 20 + Math.random() * 160,
                radius: Math.random() * 2.0 + 0.6,
                baseAlpha: Math.random() * 0.7 + 0.25,
                alphaBoost: 0,
                glow: Math.random() > 0.35,
                // Wave index for Mode 3
                waveIdx: Math.floor(Math.random() * 5),
                // Constellation hub index for Mode 4
                hubIdx: Math.floor(Math.random() * 12)
            });
        }

        // Mode 4 Constellation Hubs (12 topological anchor nodes)
        const hubs = [
            { x: 0.22, y: 0.25 }, { x: 0.45, y: 0.18 }, { x: 0.72, y: 0.22 },
            { x: 0.32, y: 0.48 }, { x: 0.58, y: 0.44 }, { x: 0.85, y: 0.46 },
            { x: 0.18, y: 0.72 }, { x: 0.42, y: 0.78 }, { x: 0.68, y: 0.70 },
            { x: 0.88, y: 0.76 }, { x: 0.52, y: 0.62 }, { x: 0.75, y: 0.35 }
        ];

        // Mode 4 fast photon data pulses between hubs
        const pulses = [
            { from: 0, to: 1, prog: 0.1, speed: 0.012 },
            { from: 1, to: 4, prog: 0.4, speed: 0.015 },
            { from: 4, to: 5, prog: 0.7, speed: 0.010 },
            { from: 3, to: 10, prog: 0.2, speed: 0.014 },
            { from: 10, to: 8, prog: 0.6, speed: 0.011 },
            { from: 8, to: 9, prog: 0.3, speed: 0.016 },
            { from: 6, to: 7, prog: 0.8, speed: 0.013 }
        ];

        // Mode 1: River Trajectory S-Curve Spline
        function getRiverPoint(t) {
            const p0 = { x: 0.48, y: 0.08 };
            const p1 = { x: 0.82, y: 0.16 };
            const p2 = { x: 0.58, y: 0.38 };
            const p3 = { x: 0.28, y: 0.62 };
            const p4 = { x: 0.68, y: 0.72 };
            const p5 = { x: 0.90, y: 0.55 };

            let x, y;
            if (t < 0.25) {
                const u = t / 0.25;
                x = (1 - u) * p0.x + u * p1.x + Math.sin(u * Math.PI) * 0.06;
                y = (1 - u) * p0.y + u * p1.y;
            } else if (t < 0.5) {
                const u = (t - 0.25) / 0.25;
                x = (1 - u) * p1.x + u * p2.x - Math.sin(u * Math.PI) * 0.08;
                y = (1 - u) * p1.y + u * p2.y;
            } else if (t < 0.75) {
                const u = (t - 0.5) / 0.25;
                x = (1 - u) * p2.x + u * p3.x - Math.sin(u * Math.PI) * 0.1;
                y = (1 - u) * p2.y + u * p3.y;
            } else {
                const u = (t - 0.75) / 0.25;
                x = (1 - u) * p3.x + u * p5.x + Math.sin(u * Math.PI) * 0.08;
                y = (1 - u) * p3.y + u * p5.y;
            }
            return { x: x * w, y: y * h };
        }

        // Internal handler when mode switches
        let transitionBloom = 0;
        setHeroModeInternal = function (newMode) {
            transitionBloom = 1.0;
        };

        let tick = 0;

        // ---------------------------------------------------------------------
        // Main Animation Loop
        // ---------------------------------------------------------------------
        function render() {
            ctx.clearRect(0, 0, w, h);
            tick++;

            // Transition Flash Bloom on mode shift (organic radial bloom fading to transparent at edges)
            if (transitionBloom > 0.01) {
                transitionBloom *= 0.92;
                ctx.save();
                const bloomR = Math.min(w, h) * 0.6;
                const bloomGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, bloomR);
                bloomGrad.addColorStop(0, `rgba(56, 189, 248, ${transitionBloom * 0.16})`);
                bloomGrad.addColorStop(0.5, `rgba(56, 189, 248, ${transitionBloom * 0.05})`);
                bloomGrad.addColorStop(1, 'rgba(3, 7, 18, 0)');
                ctx.fillStyle = bloomGrad;
                ctx.beginPath();
                ctx.arc(w * 0.5, h * 0.5, bloomR, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // 1. Draw Ambient Cursor Torch Light Glow
            if (mouse.active && mouse.x !== null) {
                const torch = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 140);
                torch.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
                torch.addColorStop(0.5, 'rgba(14, 165, 233, 0.04)');
                torch.addColorStop(1, 'rgba(3, 7, 18, 0)');
                ctx.fillStyle = torch;
                ctx.beginPath();
                ctx.arc(mouse.x, mouse.y, 140, 0, Math.PI * 2);
                ctx.fill();
            }

            // 2. Draw & Update Click Shockwaves
            for (let i = ripples.length - 1; i >= 0; i--) {
                const r = ripples[i];
                r.radius += r.speed;
                r.alpha *= 0.95;

                ctx.save();
                ctx.beginPath();
                ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(56, 189, 248, ${r.alpha})`;
                ctx.lineWidth = 1.8;
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#38bdf8';
                ctx.stroke();
                ctx.restore();

                if (r.radius > r.maxRadius || r.alpha < 0.02) {
                    ripples.splice(i, 1);
                }
            }

            let waypointPos = { x: w * 0.88, y: h * 0.58 };

            // =================================================================
            // MODE 01: STREAM DRIFT (Pelagic S-Curve Meander & Contours)
            // =================================================================
            if (currentHeroMode === 1) {
                // Topological Contour Lines
                const contours = [
                    { cx: 0.58, cy: 0.48, rx: 140, ry: 75, angle: 0.25, segments: 48 },
                    { cx: 0.56, cy: 0.50, rx: 190, ry: 105, angle: 0.22, segments: 56 },
                    { cx: 0.54, cy: 0.52, rx: 250, ry: 135, angle: 0.20, segments: 64 },
                    { cx: 0.50, cy: 0.55, rx: 320, ry: 175, angle: 0.18, segments: 72 }
                ];

                ctx.save();
                contours.forEach((c, idx) => {
                    ctx.beginPath();
                    const center = { x: c.cx * w, y: c.cy * h };
                    for (let s = 0; s <= c.segments; s++) {
                        const theta = (s / c.segments) * Math.PI * 2;
                        const rOffset = Math.sin(theta * 4 + tick * 0.015 + idx) * 5;
                        const rx = c.rx + rOffset;
                        const ry = c.ry + rOffset * 0.6;
                        let px = center.x + Math.cos(theta) * rx * Math.cos(c.angle) - Math.sin(theta) * ry * Math.sin(c.angle);
                        let py = center.y + Math.cos(theta) * rx * Math.sin(c.angle) + Math.sin(theta) * ry * Math.cos(c.angle);

                        // Mouse warp on contours
                        if (mouse.active) {
                            const dx = px - mouse.x;
                            const dy = py - mouse.y;
                            const d = Math.sqrt(dx * dx + dy * dy);
                            if (d < 100) {
                                const warp = (100 - d) / 100 * 12;
                                px += (dx / d) * warp;
                                py += (dy / d) * warp;
                            }
                        }

                        if (s === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.strokeStyle = `rgba(56, 189, 248, ${0.05 + idx * 0.02})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                });
                ctx.restore();

                // Streamline guide filaments
                for (let offset = -20; offset <= 20; offset += 10) {
                    ctx.beginPath();
                    for (let step = 0; step <= 80; step++) {
                        const t = step / 80;
                        const pt = getRiverPoint(t);
                        const normalX = -Math.sin(t * Math.PI * 2) * offset;
                        const normalY = Math.cos(t * Math.PI * 2) * offset;
                        let px = pt.x + normalX;
                        let py = pt.y + normalY;

                        if (mouse.active) {
                            const dx = px - mouse.x;
                            const dy = py - mouse.y;
                            const d = Math.sqrt(dx * dx + dy * dy);
                            if (d < 90) {
                                px += (dx / d) * ((90 - d) / 90) * 15;
                                py += (dy / d) * ((90 - d) / 90) * 15;
                            }
                        }

                        if (step === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.strokeStyle = offset === 0 ? 'rgba(56, 189, 248, 0.22)' : 'rgba(14, 165, 233, 0.08)';
                    ctx.lineWidth = offset === 0 ? 1.5 : 1;
                    ctx.stroke();
                }

                // Update particles along river
                waypointPos = getRiverPoint(0.95);

                particles.forEach(p => {
                    p.t += p.speed;
                    if (p.t > 1) p.t = 0;
                    const basePt = getRiverPoint(p.t);
                    const lat = p.lateralOffset + Math.sin(p.t * 12 + tick * 0.02) * 8;
                    p.targetX = basePt.x + (Math.sin(p.t * Math.PI * 3)) * lat * 0.4;
                    p.targetY = basePt.y + (Math.cos(p.t * Math.PI * 3)) * lat * 0.4;
                });
            }

            // =================================================================
            // MODE 02: VORTEX GYRE (Mesoscale Eddy & Logarithmic Spiral)
            // =================================================================
            else if (currentHeroMode === 2) {
                const cx = w * 0.52;
                const cy = h * 0.50;

                // Pulsing Acoustic Gyre Rings
                for (let r = 50; r <= 240; r += 45) {
                    const waveR = r + Math.sin(tick * 0.04 - r * 0.03) * 8;
                    ctx.beginPath();
                    ctx.ellipse(cx, cy, waveR * 1.35, waveR * 0.75, 0.18, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(0, 240, 255, ${0.06 + Math.sin(tick * 0.03 + r) * 0.03})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

                // Spiral streamlines
                ctx.save();
                ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
                for (let arm = 0; arm < 4; arm++) {
                    ctx.beginPath();
                    const armOffset = (arm * Math.PI) / 2;
                    for (let s = 0; s <= 70; s++) {
                        const rad = 25 + s * 3.2;
                        const th = armOffset + s * 0.12 - tick * 0.02;
                        const sx = cx + Math.cos(th) * rad * 1.3;
                        const sy = cy + Math.sin(th) * rad * 0.75;
                        if (s === 0) ctx.moveTo(sx, sy);
                        else ctx.lineTo(sx, sy);
                    }
                    ctx.stroke();
                }
                ctx.restore();

                // Luminous Singularity Core
                ctx.beginPath();
                ctx.arc(cx, cy, 6 + Math.sin(tick * 0.08) * 2, 0, Math.PI * 2);
                ctx.fillStyle = '#00f0ff';
                ctx.shadowBlur = 18;
                ctx.shadowColor = '#00f0ff';
                ctx.fill();
                ctx.shadowBlur = 0;

                // High-speed Waypoint Orbit
                const wpAngle = tick * 0.022;
                const wpRadius = 145;
                waypointPos = {
                    x: cx + Math.cos(wpAngle) * wpRadius * 1.3,
                    y: cy + Math.sin(wpAngle) * wpRadius * 0.75
                };

                // Waypoint comet orbit trail
                ctx.beginPath();
                ctx.ellipse(cx, cy, wpRadius * 1.3, wpRadius * 0.75, 0, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
                ctx.setLineDash([6, 8]);
                ctx.stroke();
                ctx.setLineDash([]);

                particles.forEach((p, idx) => {
                    p.angle += 0.015 + (1 / (p.orbitRadius + 20)) * 2.2;
                    p.orbitRadius -= 0.15;
                    if (p.orbitRadius < 20) {
                        p.orbitRadius = 180 + Math.random() * 40;
                        p.angle = Math.random() * Math.PI * 2;
                    }
                    p.targetX = cx + Math.cos(p.angle) * p.orbitRadius * 1.3;
                    p.targetY = cy + Math.sin(p.angle) * p.orbitRadius * 0.75;
                });
            }

            // =================================================================
            // MODE 03: SOLITON WAVES (Harmonic Undulating Wave Trains)
            // =================================================================
            else if (currentHeroMode === 3) {
                // Draw multi-harmonic contour wave fronts
                const numWavefronts = 6;
                for (let k = 0; k < numWavefronts; k++) {
                    const waveBaseY = h * 0.2 + (k / (numWavefronts - 1)) * (h * 0.65);
                    ctx.beginPath();
                    for (let x = 0; x <= w; x += 6) {
                        const wave1 = Math.sin(x * 0.018 - tick * 0.035 + k * 0.8) * 22;
                        const wave2 = Math.cos(x * 0.009 + tick * 0.02) * 12;
                        const y = waveBaseY + wave1 + wave2;
                        if (x === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.strokeStyle = `rgba(45, 212, 191, ${0.12 + (k % 2) * 0.08})`;
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                }

                // Waypoint surfs on the primary wave crest
                const wpX = (w * 0.75 + Math.sin(tick * 0.01) * 60);
                const wpY = h * 0.55 + Math.sin(wpX * 0.018 - tick * 0.035) * 24;
                waypointPos = { x: wpX, y: wpY };

                particles.forEach((p, idx) => {
                    const normProg = (p.t + tick * 0.001) % 1;
                    const px = normProg * w;
                    const waveBandY = h * 0.2 + (p.waveIdx / 4) * (h * 0.6);
                    const wave1 = Math.sin(px * 0.018 - tick * 0.035 + p.waveIdx * 0.8) * 22;
                    const wave2 = Math.cos(px * 0.009 + tick * 0.02) * 12;
                    p.targetX = px;
                    p.targetY = waveBandY + wave1 + wave2 + p.lateralOffset * 0.3;
                });
            }

            // =================================================================
            // MODE 04: FACTOR WEB (Neural Constellation & Pulse Network)
            // =================================================================
            else if (currentHeroMode === 4) {
                // Draw constellation connection lines between hubs within proximity
                ctx.save();
                for (let a = 0; a < hubs.length; a++) {
                    const h1 = { x: hubs[a].x * w, y: hubs[a].y * h };
                    for (let b = a + 1; b < hubs.length; b++) {
                        const h2 = { x: hubs[b].x * w, y: hubs[b].y * h };
                        const dx = h2.x - h1.x;
                        const dy = h2.y - h1.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < 180) {
                            const alpha = (1 - dist / 180) * 0.28;
                            ctx.beginPath();
                            ctx.moveTo(h1.x, h1.y);
                            ctx.lineTo(h2.x, h2.y);
                            ctx.strokeStyle = `rgba(129, 140, 248, ${alpha})`;
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }
                    }
                }
                ctx.restore();

                // Draw high-speed photon pulses along lines
                pulses.forEach(pulse => {
                    pulse.prog += pulse.speed;
                    if (pulse.prog > 1) pulse.prog = 0;
                    const hA = hubs[pulse.from];
                    const hB = hubs[pulse.to];
                    const px = (1 - pulse.prog) * (hA.x * w) + pulse.prog * (hB.x * w);
                    const py = (1 - pulse.prog) * (hA.y * h) + pulse.prog * (hB.y * h);

                    ctx.beginPath();
                    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = '#818cf8';
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#818cf8';
                    ctx.fill();
                    ctx.shadowBlur = 0;
                });

                // Hub circular nodes
                hubs.forEach((hub, idx) => {
                    const hx = hub.x * w;
                    const hy = hub.y * h;
                    const ping = Math.sin(tick * 0.05 + idx) * 3;

                    ctx.beginPath();
                    ctx.arc(hx, hy, 4 + ping * 0.5, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(129, 140, 248, 0.8)';
                    ctx.fill();

                    // Outer orbit ring
                    ctx.beginPath();
                    ctx.arc(hx, hy, 12, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(129, 140, 248, 0.15)';
                    ctx.stroke();
                });

                // Waypoint rests at Apex Hub 5
                const apexHub = hubs[5];
                waypointPos = { x: apexHub.x * w, y: apexHub.y * h };

                // Sonar Radar ping from apex hub
                const sonarR = (tick * 2.5) % 180;
                ctx.beginPath();
                ctx.arc(waypointPos.x, waypointPos.y, sonarR, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(129, 140, 248, ${(1 - sonarR / 180) * 0.4})`;
                ctx.lineWidth = 1.2;
                ctx.stroke();

                particles.forEach((p, idx) => {
                    const hub = hubs[p.hubIdx];
                    const hubX = hub.x * w;
                    const hubY = hub.y * h;
                    const localAngle = tick * 0.02 + idx;
                    const orbitR = 8 + (idx % 24);
                    p.targetX = hubX + Math.cos(localAngle) * orbitR;
                    p.targetY = hubY + Math.sin(localAngle) * orbitR;
                });
            }

            // =================================================================
            // COMMON PARTICLE UPDATE & INTERACTIVE MOUSE REPULSION
            // =================================================================
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];

                // Smooth interpolation toward mode target
                p.x += (p.targetX - p.x) * 0.075;
                p.y += (p.targetY - p.y) * 0.075;

                // Mouse fluid interaction & vortex deflection
                if (mouse.active && mouse.x !== null) {
                    const dx = mouse.x - (p.x + p.dispX);
                    const dy = mouse.y - (p.y + p.dispY);
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const pushRadius = 130;

                    if (dist < pushRadius && dist > 1) {
                        const force = (pushRadius - dist) / pushRadius;
                        const angle = Math.atan2(dy, dx);
                        const tangential = angle + Math.PI / 2;

                        // Push away radially + swirl tangentially based on mouse velocity
                        const swirlForce = Math.min(Math.abs(mouse.vx) + Math.abs(mouse.vy), 8) * 0.35;
                        p.dispX -= Math.cos(angle) * force * 5.0 - Math.cos(tangential) * swirlForce;
                        p.dispY -= Math.sin(angle) * force * 5.0 - Math.sin(tangential) * swirlForce;

                        // Flare up particle brightness
                        p.alphaBoost = Math.min(1.0, p.alphaBoost + force * 0.3);
                    }
                }

                // Smooth dampening of displacement
                p.dispX *= 0.90;
                p.dispY *= 0.90;
                p.alphaBoost *= 0.94;

                const renderX = p.x + p.dispX;
                const renderY = p.y + p.dispY;

                // Draw Particle
                ctx.beginPath();
                ctx.arc(renderX, renderY, p.radius, 0, Math.PI * 2);

                const totalAlpha = Math.min(1.0, p.baseAlpha + p.alphaBoost);
                let colorBase = '56, 189, 248';
                if (currentHeroMode === 2) colorBase = '0, 240, 255';
                else if (currentHeroMode === 3) colorBase = '45, 212, 191';
                else if (currentHeroMode === 4) colorBase = '129, 140, 248';

                if (p.glow || p.alphaBoost > 0.2) {
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = `rgb(${colorBase})`;
                    ctx.fillStyle = `rgba(224, 242, 254, ${totalAlpha})`;
                } else {
                    ctx.fillStyle = `rgba(${colorBase}, ${totalAlpha * 0.8})`;
                }
                ctx.fill();
                ctx.shadowBlur = 0;
            }


            requestAnimationFrame(render);
        }

        render();
    }

    // =========================================================================
    // 3. POLAR RADAR / COMPASS SCANNER (Card 1: Live Overview)
    // =========================================================================
    function initRadarCanvas() {
        const canvas = document.getElementById('radar-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let dpr = window.devicePixelRatio || 1;
        let size = 115;

        function resize() {
            canvas.width = size * dpr;
            canvas.height = size * dpr;
            ctx.scale(dpr, dpr);
        }
        resize();

        let sweepAngle = 0;
        const targets = [
            { r_ratio: 0.72, theta: 0.9, size: 2.2, pulse: 0 },
            { r_ratio: 0.45, theta: 2.4, size: 1.8, pulse: 0 },
            { r_ratio: 0.88, theta: 4.1, size: 2.4, pulse: 0 },
            { r_ratio: 0.60, theta: 5.3, size: 2.0, pulse: 0 }
        ];

        function drawRadar() {
            ctx.clearRect(0, 0, size, size);
            const cx = size / 2;
            const cy = size / 2;
            const maxR = size / 2 - 12;

            // Concentric range rings
            [0.35, 0.65, 1.0].forEach((ratio) => {
                ctx.beginPath();
                ctx.arc(cx, cy, maxR * ratio, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
                ctx.lineWidth = 0.8;
                ctx.stroke();
            });

            // Cardinal Axes
            ctx.beginPath();
            ctx.moveTo(cx - maxR, cy);
            ctx.lineTo(cx + maxR, cy);
            ctx.moveTo(cx, cy - maxR);
            ctx.lineTo(cx, cy + maxR);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            // Cardinal letters (N, E, S, W)
            ctx.font = '7.5px Inter, -apple-system, sans-serif';
            ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('N', cx, cy - maxR - 6);
            ctx.fillText('S', cx, cy + maxR + 6);
            ctx.fillText('E', cx + maxR + 6, cy);
            ctx.fillText('W', cx - maxR - 6, cy);

            // Rotating Sweep Beam
            sweepAngle += 0.028;
            if (sweepAngle > Math.PI * 2) sweepAngle -= Math.PI * 2;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, maxR, sweepAngle - 0.5, sweepAngle);
            ctx.closePath();
            const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
            sweepGrad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
            sweepGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
            ctx.fillStyle = sweepGrad;
            ctx.fill();

            // Main Sweep Line
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(sweepAngle) * maxR, cy + Math.sin(sweepAngle) * maxR);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
            ctx.lineWidth = 1.2;
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#38bdf8';
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();

            // Target Vector
            const targetTheta = 0.88;
            const targetR = maxR * 0.72;
            const tx = cx + Math.cos(targetTheta) * targetR;
            const ty = cy + Math.sin(targetTheta) * targetR;

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(tx, ty);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Glowing Apex Blip
            ctx.beginPath();
            ctx.arc(tx, ty, 3.2, 0, Math.PI * 2);
            ctx.fillStyle = '#38bdf8';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#38bdf8';
            ctx.fill();
            ctx.shadowBlur = 0;

            // Target blips on scan hit
            targets.forEach(t => {
                const diff = Math.abs(sweepAngle - t.theta);
                if (diff < 0.1 || diff > Math.PI * 2 - 0.1) {
                    t.pulse = 1.0;
                } else {
                    t.pulse *= 0.94;
                }
                const bx = cx + Math.cos(t.theta) * (t.r_ratio * maxR);
                const by = cy + Math.sin(t.theta) * (t.r_ratio * maxR);

                ctx.beginPath();
                ctx.arc(bx, by, t.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(186, 230, 253, ${0.25 + t.pulse * 0.75})`;
                if (t.pulse > 0.3) {
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = '#38bdf8';
                }
                ctx.fill();
                ctx.shadowBlur = 0;
            });

            requestAnimationFrame(drawRadar);
        }
        drawRadar();
    }

    // =========================================================================
    // 4. MICRO WAVE SPARKLINES (Card 2 & Card 3)
    // =========================================================================
    function initSparklines() {
        const canvases = document.querySelectorAll('.sparkline-canvas');
        if (!canvases.length) return;

        canvases.forEach((c, index) => {
            const ctx = c.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            const w = c.clientWidth || 80;
            const h = c.clientHeight || 24;
            c.width = w * dpr;
            c.height = h * dpr;
            ctx.scale(dpr, dpr);

            const freq = 0.05 + (index % 3) * 0.02;
            const amp = 6 + (index % 2) * 2;
            let offset = index * 1.5;

            function animateSparkline() {
                ctx.clearRect(0, 0, w, h);
                offset += 0.04;

                ctx.beginPath();
                for (let x = 0; x <= w; x += 2) {
                    const y = (h / 2) + Math.sin(x * freq + offset) * amp * Math.cos(x * 0.02);
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 1.4;
                ctx.shadowBlur = 5;
                ctx.shadowColor = 'rgba(56, 189, 248, 0.7)';
                ctx.stroke();
                ctx.shadowBlur = 0;

                requestAnimationFrame(animateSparkline);
            }
            animateSparkline();
        });
    }

    // =========================================================================
    // 5. 3D UNDULATING RIBBON MESH CANVAS (Card 4: Showcase Tile)
    // =========================================================================
    function initRibbonMeshCanvas() {
        const canvas = document.getElementById('ribbon-mesh-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let dpr = window.devicePixelRatio || 1;
        let w, h;

        function resize() {
            const rect = canvas.getBoundingClientRect();
            w = rect.width || 320;
            h = rect.height || 160;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.scale(dpr, dpr);
        }
        resize();
        window.addEventListener('resize', resize);

        let t = 0;
        const numLines = 14;

        function drawMesh() {
            ctx.clearRect(0, 0, w, h);
            t += 0.022;

            for (let i = 0; i < numLines; i++) {
                ctx.beginPath();
                const lineRatio = i / numLines;
                const baseY = h * 0.35 + lineRatio * (h * 0.45);

                for (let x = 0; x <= w; x += 4) {
                    const normX = x / w;
                    const wave1 = Math.sin(normX * 5.2 - t + lineRatio * 1.4) * 16;
                    const wave2 = Math.cos(normX * 3.1 + t * 0.7) * 8;
                    const y = baseY + (wave1 + wave2) * (1 - Math.abs(normX - 0.5) * 0.4);

                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }

                const alpha = 0.15 + (1 - lineRatio) * 0.55;
                ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
                ctx.lineWidth = 1 + (1 - lineRatio) * 0.8;
                if (i === 0 || i === 1) {
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = '#38bdf8';
                }
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            requestAnimationFrame(drawMesh);
        }
        drawMesh();
    }

    // Initialize all canvas graphics once DOM is parsed
    document.addEventListener('DOMContentLoaded', () => {
        initAmbientCanvas();
        initHeroStreamCanvas();
        initRadarCanvas();
        initSparklines();
        initRibbonMeshCanvas();
    });
})();
