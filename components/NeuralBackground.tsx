import React, { useEffect, useRef, useState } from "react";
import { View, Dimensions, StyleSheet, Platform } from "react-native";
import { GLView } from "expo-gl";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
}

interface Props {
  color?: string;
  particleCount?: number;
  speed?: number;
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0, g: 1, b: 0.67 };
}

export function NeuralBackground({
  color = "#00ffaa",
  particleCount = 200,
  speed = 0.8,
}: Props) {
  const particlesRef = useRef<Particle[]>([]);
  const { width, height } = Dimensions.get("window");

  const initParticles = (count: number, w: number, h: number): Particle[] => {
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 0,
        vy: 0,
        age: Math.floor(Math.random() * 200),
        life: Math.random() * 200 + 100,
      });
    }
    return particles;
  };

  const onContextCreate = (gl: any) => {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const rgb = hexToRgb(color);

    particlesRef.current = initParticles(particleCount, w, h);

    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Simple vertex shader
    const vsSource = `
      attribute vec2 aPosition;
      attribute float aAlpha;
      uniform vec2 uResolution;
      varying float vAlpha;
      void main() {
        vec2 pos = (aPosition / uResolution) * 2.0 - 1.0;
        pos.y = -pos.y;
        gl_Position = vec4(pos, 0.0, 1.0);
        gl_PointSize = 2.0;
        vAlpha = aAlpha;
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(uColor, vAlpha);
      }
    `;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const aPosition = gl.getAttribLocation(program, "aPosition");
    const aAlpha = gl.getAttribLocation(program, "aAlpha");
    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uColor = gl.getUniformLocation(program, "uColor");

    gl.uniform2f(uResolution, w, h);
    gl.uniform3f(uColor, rgb.r, rgb.g, rgb.b);

    const posBuffer = gl.createBuffer();
    const alphaBuffer = gl.createBuffer();

    const render = () => {
      // Fade effect: draw semi-transparent black rect
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // Update particles
      const particles = particlesRef.current;
      const positions = new Float32Array(particles.length * 2);
      const alphas = new Float32Array(particles.length);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const angle =
          (Math.cos(p.x * 0.005) + Math.sin(p.y * 0.005)) * Math.PI;
        p.vx += Math.cos(angle) * 0.2 * speed;
        p.vy += Math.sin(angle) * 0.2 * speed;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.age++;

        if (p.age > p.life) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.vx = 0;
          p.vy = 0;
          p.age = 0;
          p.life = Math.random() * 200 + 100;
        }

        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        positions[i * 2] = p.x;
        positions[i * 2 + 1] = p.y;
        alphas[i] = 1 - Math.abs(p.age / p.life - 0.5) * 2;
      }

      // Clear with trail effect
      gl.clearColor(0, 0, 0, 0.08);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aPosition);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, alphas, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aAlpha);
      gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, particles.length);

      gl.flush();
      gl.endFrameEXP();

      requestAnimationFrame(render);
    };

    render();
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000000" }]} />
      <GLView
        style={StyleSheet.absoluteFill}
        onContextCreate={onContextCreate}
      />
    </View>
  );
}
