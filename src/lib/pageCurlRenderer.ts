import { pageCurlShader } from './pageCurlShader';

/** A transient canvas overlays readable HTML only while a page is turning. */
export function createPageCurl(canvas: HTMLCanvasElement, from: HTMLCanvasElement, to: HTMLCanvasElement, reverse: boolean) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: true });
  if (!gl) return null;
  const shaders: WebGLShader[] = [];
  const textures: WebGLTexture[] = [];
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const dispose = () => {
    textures.forEach(texture => gl.deleteTexture(texture));
    shaders.forEach(shader => gl.deleteShader(shader));
    gl.deleteBuffer(buffer); gl.deleteProgram(program);
  };
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Page curl shader unavailable');
    shaders.push(shader);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Page curl shader failed');
    return shader;
  };
  try {
    if (!program || !buffer) throw new Error('Page curl resources unavailable');
    gl.attachShader(program, compile(gl.VERTEX_SHADER, 'attribute vec2 position; varying vec2 uv; void main(){uv=(position+1.0)*0.5;gl_Position=vec4(position,0.0,1.0);}'));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `precision highp float;
      varying vec2 uv; uniform sampler2D fromPage; uniform sampler2D toPage;
      uniform float progress; uniform bool reverse;
      vec2 oriented(vec2 p) { return reverse ? vec2(1.0-p.x,p.y) : p; }
      vec4 getFromColor(vec2 p) { return texture2D(fromPage,oriented(p)); }
      vec4 getToColor(vec2 p) { return texture2D(toPage,oriented(p)); }
      ${pageCurlShader}
      void main(){ gl_FragColor=transition(oriented(uv)); }`));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Page curl linking failed');
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    [from, to].forEach((page, index) => {
      const texture = gl.createTexture();
      if (!texture) throw new Error('Page curl texture unavailable');
      textures.push(texture);
      gl.activeTexture(gl.TEXTURE0 + index); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, page);
      gl.uniform1i(gl.getUniformLocation(program, index ? 'toPage' : 'fromPage'), index);
    });
    gl.uniform1i(gl.getUniformLocation(program, 'reverse'), reverse ? 1 : 0);
    const progress = gl.getUniformLocation(program, 'progress');
    gl.viewport(0, 0, canvas.width, canvas.height);
    return { draw(value: number) {
      gl.uniform1f(progress, Math.max(0, Math.min(1, value)));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }, dispose };
  } catch {
    dispose();
    return null;
  }
}
