import { dictionaryLeafCurve } from './dictionaryLeafGeometry';

/** One hinged, flexible sheet. The resting pages never travel with the turning leaf. */
export function createDictionaryLeaf(canvas: HTMLCanvasElement, from: HTMLCanvasElement, to: HTMLCanvasElement, reverse: boolean, spread: boolean) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) return null;
  const shaders: WebGLShader[] = [], textures: WebGLTexture[] = [];
  const program = gl.createProgram(), buffer = gl.createBuffer();
  const dispose = () => { shaders.forEach(s => gl.deleteShader(s)); textures.forEach(t => gl.deleteTexture(t)); gl.deleteBuffer(buffer); gl.deleteProgram(program); };
  try {
    if (!program || !buffer) throw new Error('Leaf resources unavailable');
    const compile = (type: number, code: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Leaf shader unavailable');
      shaders.push(shader); gl.shaderSource(shader, code); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Leaf shader failed');
      gl.attachShader(program, shader);
    };
    compile(gl.VERTEX_SHADER, `attribute vec3 position; attribute vec2 texcoord; attribute float shade;
      varying vec2 uv; varying float light;
      void main(){float perspective=1.0-position.z*.06;gl_Position=vec4(position.xy,-position.z*.35,perspective);uv=texcoord;light=shade;}`);
    compile(gl.FRAGMENT_SHADER, `precision mediump float; varying vec2 uv; varying float light; uniform sampler2D paper; uniform vec3 castShadow;
      void main(){vec4 c=texture2D(paper,uv);float shadow=castShadow.z*exp(-pow((uv.x-castShadow.x)/max(.001,castShadow.y),2.0))*smoothstep(.04,.12,uv.y)*smoothstep(.04,.12,1.0-uv.y);gl_FragColor=vec4(c.rgb*light*(1.0-shadow),c.a);}`);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Leaf linking failed');
    gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [name, size, offset] of [['position', 3, 0], ['texcoord', 2, 12], ['shade', 1, 20]] as const) {
      const index = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(index); gl.vertexAttribPointer(index, size, gl.FLOAT, false, 24, offset);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    for (const page of [from, to]) {
      const texture = gl.createTexture(); if (!texture) throw new Error('Leaf texture unavailable');
      textures.push(texture); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, page);
    }
    gl.uniform1i(gl.getUniformLocation(program, 'paper'), 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const castShadow = gl.getUniformLocation(program, 'castShadow');
    const draw = (data: number[], texture: number) => {
      gl.bindTexture(gl.TEXTURE_2D, textures[texture]); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES, 0, data.length / 6);
    };
    const rectangle = (left: number, right: number, texture: number, light = 1) => {
      const a = [left, -1, 0, (left + 1) / 2, 0, light], b = [right, -1, 0, (right + 1) / 2, 0, light];
      const c = [left, 1, 0, (left + 1) / 2, 1, light], d = [right, 1, 0, (right + 1) / 2, 1, light];
      draw([...a,...b,...c,...b,...d,...c], texture);
    };
    return { dispose, draw(progress: number) {
      const p = Math.max(0, Math.min(1, progress));
      gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform3f(castShadow,0,1,0);
      if (p === 0 || p === 1) { rectangle(-1,1,p); return; }
      const curve = dictionaryLeafCurve(spread ? p : (reverse ? 1-p : p)/2);
      const edge = curve[curve.length-1];
      gl.uniform3f(castShadow,spread ? .5 + (reverse ? -1 : 1)*edge.x/2 : edge.x, .025+edge.z*.08, Math.sin(Math.PI*p)*.2);
      if (spread) { rectangle(-1,0,reverse ? 1 : 0); rectangle(0,1,reverse ? 0 : 1); }
      else rectangle(-1,1,reverse ? 0 : 1);
      gl.uniform3f(castShadow,0,1,0);
      const direction = reverse && spread ? -1 : 1;
      const hinge = spread ? 0 : -1;
      const width = spread ? 1 : 2;
      // Draw from the binding outwards: each strip carries its own front/back content and lighting.
      for (let i = 0; i < curve.length - 1; i++) {
        const a = curve[i], b = curve[i+1];
        const front = (a.normal + b.normal) >= 0;
        if (!spread && !front) continue; // the back of a single-page reader has left the viewport
        const texture = spread ? (front ? 0 : 1) : (reverse ? 1 : 0);
        const vertex = (point: typeof a, y: number) => {
          const u = spread ? .5 + direction * (front ? 1 : -1) * point.u / 2 : point.u;
          const light = .78 + .22 * Math.abs(point.normal);
          return [hinge + direction * point.x * width, spread ? y : y*(1-point.z*.06), point.z, u, (y+1)/2, light];
        };
        draw([...vertex(a,-1),...vertex(b,-1),...vertex(a,1),...vertex(b,-1),...vertex(b,1),...vertex(a,1)], texture);
      }
    } };
  } catch { dispose(); return null; }
}
