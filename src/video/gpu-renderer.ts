/**
 * Zero-copy VideoFrame rendering using WebGPU with ImageBitmap fallback.
 *
 * This class provides high-performance video rendering by using WebGPU's
 * `importExternalTexture()` for zero-copy rendering when available, or falling
 * back to ImageBitmapRenderer for compatibility.
 *
 * Features:
 * - **Zero-copy rendering** via WebGPU (no pixel copying between GPU and CPU)
 * - **Two filter modes**: Linear (hardware accelerated) and Bicubic (high quality)
 * - **Automatic fallback** to ImageBitmapRenderer if WebGPU is unavailable
 * - **Works with VideoFrame** objects from VideoDecoder
 *
 * @example
 * ```typescript
 * const canvas = document.getElementById('canvas');
 * const renderer = new GPUFrameRenderer(canvas, { filterMode: 'linear' });
 * await renderer.init();
 *
 * // In VideoDecoder output callback:
 * decoder.configure({
 *   output: (frame) => {
 *     renderer.drawImage(frame);
 *     frame.close();
 *   },
 *   error: (e) => console.error(e)
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Switch to high-quality bicubic filtering
 * renderer.setFilterMode('bicubic');
 *
 * // Check current mode
 * if (renderer.getMode() === 'webgpu') {
 *   console.log('Using WebGPU zero-copy rendering');
 * }
 * ```
 */
export class GPUFrameRenderer {

    canvas: HTMLCanvasElement | OffscreenCanvas;
    mode: 'webgpu' | 'bitmap' | null;
    filterMode: 'linear' | 'bicubic';
    device: GPUDevice | null;
    context: GPUCanvasContext | null;
    linearPipeline: GPURenderPipeline | null;
    bicubicPipeline: GPURenderPipeline | null;
    sampler: GPUSampler | null;
    uniformBuffer: GPUBuffer | null;
    bitmapCtx: ImageBitmapRenderingContext | null;

    /**
     * Create a new GPUFrameRenderer.
     *
     * @param canvas - The canvas element to render to (HTMLCanvasElement or OffscreenCanvas)
     * @param options - Configuration options
     * @param options.filterMode - Scaling filter: 'linear' (default) or 'bicubic' (higher quality)
     */
    constructor(canvas: HTMLCanvasElement | OffscreenCanvas, options: { filterMode?: 'linear' | 'bicubic' } = {}) {
      this.canvas = canvas;
      this.mode = 'webgpu'; // 'webgpu' or 'bitmap'
      this.filterMode = options.filterMode || 'linear'; // 'linear' or 'bicubic'
  
      // WebGPU state
      this.device = null;
      this.context = null;
      this.linearPipeline = null;
      this.bicubicPipeline = null;
      this.sampler = null;
      this.uniformBuffer = null;
  
      // Bitmap renderer fallback
      this.bitmapCtx = null;
    }
  
    /**
     * Initialize the renderer. Must be called before drawImage().
     *
     * Attempts to initialize WebGPU first for zero-copy rendering. If WebGPU
     * is unavailable or initialization fails, automatically falls back to
     * ImageBitmapRenderer.
     *
     * @returns Promise that resolves when initialization is complete
     *
     * @example
     * ```typescript
     * const renderer = new GPUFrameRenderer(canvas);
     * await renderer.init();
     * // Ready to render
     * ```
     */
    async init() {
      // Try to initialize WebGPU first
      if (navigator.gpu) {
        try {
          await this.initWebGPU();
          this.mode = 'webgpu';
          console.log('GPUDrawImage: Using WebGPU (zero-copy)');
          return;
        } catch (e) {
          console.warn('GPUDrawImage: WebGPU initialization failed, falling back to ImageBitmap', e);
        }
      }

      // Fall back to ImageBitmapRenderer
      this.initBitmapRenderer();
      this.mode = 'bitmap';
      console.log('GPUDrawImage: Using ImageBitmapRenderer (fallback)');
    }
  
    async initWebGPU(): Promise<boolean> {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return false;
  
      this.device = await adapter.requestDevice();
      if(!this.device) return false;
      this.context = this.canvas.getContext('webgpu');
  
      if(!this.context) return false;
    
      const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: presentationFormat,
        alphaMode: 'opaque',
      });
  
      // Create sampler for texture sampling
      this.sampler = this.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
      });
  
      // Create uniform buffer for texture dimensions (2 floats = 8 bytes)
      this.uniformBuffer = this.device.createBuffer({
        size: 8,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
  
      const vertexShader = `
        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) texCoord: vec2f,
        }
  
        @vertex
        fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
          var pos = array<vec2f, 6>(
            vec2f(-1.0, -1.0),
            vec2f(1.0, -1.0),
            vec2f(-1.0, 1.0),
            vec2f(-1.0, 1.0),
            vec2f(1.0, -1.0),
            vec2f(1.0, 1.0)
          );
  
          var texCoord = array<vec2f, 6>(
            vec2f(0.0, 1.0),
            vec2f(1.0, 1.0),
            vec2f(0.0, 0.0),
            vec2f(0.0, 0.0),
            vec2f(1.0, 1.0),
            vec2f(1.0, 0.0)
          );
  
          var output: VertexOutput;
          output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
          output.texCoord = texCoord[vertexIndex];
          return output;
        }
      `;
  
      // Linear sampling shader (hardware accelerated)
      const linearShaderModule = this.device.createShaderModule({
        code: vertexShader + `
          @group(0) @binding(0) var videoTexture: texture_external;
          @group(0) @binding(1) var texSampler: sampler;
  
          @fragment
          fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
            return textureSampleBaseClampToEdge(videoTexture, texSampler, input.texCoord);
          }
        `
      });
  
      // Bicubic sampling shader (multiple texture reads)
      const bicubicShaderModule = this.device.createShaderModule({
        code: vertexShader + `
          @group(0) @binding(0) var videoTexture: texture_external;
          @group(0) @binding(1) var<uniform> texSize: vec2f;
  
          // Bicubic weight function (Catmull-Rom)
          fn cubic(x: f32) -> f32 {
            let x_abs = abs(x);
            if (x_abs <= 1.0) {
              return 1.5 * x_abs * x_abs * x_abs - 2.5 * x_abs * x_abs + 1.0;
            } else if (x_abs < 2.0) {
              return -0.5 * x_abs * x_abs * x_abs + 2.5 * x_abs * x_abs - 4.0 * x_abs + 2.0;
            }
            return 0.0;
          }
  
          @fragment
          fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
            let texCoord = input.texCoord;
  
            let coord = texCoord * texSize;
            let coordFloor = floor(coord);
            let f = coord - coordFloor;
  
            var result = vec4f(0.0, 0.0, 0.0, 0.0);
            var weightSum = 0.0;
  
            // Read exact pixel values from 4x4 neighborhood using textureLoad
            for (var y = -1; y <= 2; y++) {
              for (var x = -1; x <= 2; x++) {
                let pixelCoord = vec2i(i32(coordFloor.x) + x, i32(coordFloor.y) + y);
  
                // Clamp to valid texture coordinates
                let clampedCoord = clamp(pixelCoord, vec2i(0, 0), vec2i(i32(texSize.x) - 1, i32(texSize.y) - 1));
  
                let weight = cubic(f.x - f32(x)) * cubic(f.y - f32(y));
                result += textureLoad(videoTexture, clampedCoord) * weight;
                weightSum += weight;
              }
            }
  
            return result / weightSum;
          }
        `
      });
  
      this.linearPipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: linearShaderModule,
          entryPoint: 'vertexMain',
        },
        fragment: {
          module: linearShaderModule,
          entryPoint: 'fragmentMain',
          targets: [{
            format: presentationFormat,
          }],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });
  
      this.bicubicPipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: bicubicShaderModule,
          entryPoint: 'vertexMain',
        },
        fragment: {
          module: bicubicShaderModule,
          entryPoint: 'fragmentMain',
          targets: [{
            format: presentationFormat,
          }],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });

      return true;
    }
  
    initBitmapRenderer() {
      this.bitmapCtx = this.canvas.getContext('bitmaprenderer');
    }
  
    /**
     * Draw a VideoFrame to the canvas
     * @param {VideoFrame} source - The VideoFrame to draw
     */
    drawImage(source: VideoFrame) {
      if (this.mode === 'webgpu') {
        this.drawImageWebGPU(source);
      } else if (this.mode === 'bitmap') {
        this.drawImageBitmap(source);
      } else {
        throw new Error('GPUDrawImage not initialized. Call init() first.');
      }
    }
  
    drawImageWebGPU(videoFrame: VideoFrame) {
      const pipeline = this.filterMode === 'bicubic' ? this.bicubicPipeline : this.linearPipeline;
      const useBicubic = this.filterMode === 'bicubic';
  
      const entries = [
        {
          binding: 0,
          resource: this.device!.importExternalTexture({
            source: videoFrame,
          }),
        }
      ];
  
      // Add sampler for linear filtering, uniform buffer for bicubic
      if (useBicubic) {
        // Update uniform buffer with actual texture dimensions
        const texSize = new Float32Array([videoFrame.displayWidth, videoFrame.displayHeight]);
        this.device!.queue.writeBuffer(this.uniformBuffer!, 0, texSize);
  
        entries.push({
          binding: 1,
          resource: {
            buffer: this.uniformBuffer!,
          },
        });
      } else {
        entries.push({
          binding: 1,
          resource: this.sampler!,
        });
      }
  
      const bindGroup = this.device!.createBindGroup({
        layout: pipeline!.getBindGroupLayout(0),
        entries: entries,
      });
  
      const commandEncoder = this.device!.createCommandEncoder();
      const textureView = this.context!.getCurrentTexture().createView();
  
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
  
      renderPass.setPipeline(pipeline!);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(6);
      renderPass.end();
  
      this.device!.queue.submit([commandEncoder!.finish()]);
    }
  
    async drawImageBitmap(videoFrame: VideoFrame) {
      // Create ImageBitmap from VideoFrame and transfer to canvas
      const bitmap = await createImageBitmap(videoFrame);
      this.bitmapCtx!.transferFromImageBitmap(bitmap);
    }
  
    /**
     * Get the current rendering mode
     * @returns {'webgpu'|'bitmap'|null}
     */
    getMode() {
      return this.mode;
    }
  
    /**
     * Get the current filter mode
     * @returns {'linear'|'bicubic'}
     */
    getFilterMode() {
      return this.filterMode;
    }
  
    /**
     * Set the filter mode (only applies to WebGPU mode)
     * @param {'linear'|'bicubic'} mode
     */
    setFilterMode(mode: 'linear' | 'bicubic') {
      if (mode !== 'linear' && mode !== 'bicubic') {
        throw new Error('Filter mode must be "linear" or "bicubic"');
      }
      this.filterMode = mode;
    }
  
    /**
     * Clean up resources
     */
    destroy() {
      if (this.device) {
        this.device.destroy();
      }
    }
  }
  