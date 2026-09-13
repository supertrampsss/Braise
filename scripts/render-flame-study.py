"""Optional offline shader study. Requires moderngl + Pillow, not a browser test.
Reads the production shader unchanged except GLSL desktop interface declarations.
Usage: python scripts/render-flame-study.py [output-directory]
"""
from pathlib import Path
import sys, re
import moderngl
from PIL import Image

root = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'work' / 'flame-study'
out.mkdir(parents=True, exist_ok=True)
source = (root / 'lib/flame-shaders.ts').read_text()
fragment = source.split('export const flameFragment = `')[1].split('`;')[0]
fragment = '#version 330\nout vec4 fragColor;\n' + fragment.replace('precision highp float;', '').replace('varying vec2 v;', 'in vec2 v;').replace('texture2D(', 'texture(').replace('gl_FragColor', 'fragColor')
ctx = moderngl.create_context(standalone=True, backend='egl')
program = ctx.program(vertex_shader='''#version 330
out vec2 v;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);v=p;gl_Position=vec4(p*2.-1.,0.,1.);}
''', fragment_shader=fragment)
seed = 71483
random = bytearray(128 * 128)
for i in range(len(random)):
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    random[i] = seed >> 24
pixels = bytearray(128 * 128 * 4)
for y in range(128):
    for x in range(128):
        offset = (y * 128 + x) * 4
        pixels[offset] = random[y * 128 + x]
        pixels[offset+1] = random[((y+17)%128)*128+(x+37)%128]
        pixels[offset+3] = 255
texture = ctx.texture((128,128),4,bytes(pixels))
texture.filter = (moderngl.LINEAR, moderngl.LINEAR)
texture.repeat_x = texture.repeat_y = True
texture.use(0)
program['noiseMap'] = 0
vao = ctx.vertex_array(program, [])
for name,width,height,heat,time in [('idle',390,420,0,4),('warm',390,420,.5,4),('hot',390,420,1,4),('compact',342,80,.7,5)]:
    fbo=ctx.simple_framebuffer((width,height));fbo.use()
    program['time']=time;program['heat']=heat;program['celebration']=0
    program['aspect']=width/height;program['gaze']=(0,0)
    vao.render(vertices=3)
    Image.frombytes('RGB',(width,height),fbo.read(components=3)).transpose(Image.Transpose.FLIP_TOP_BOTTOM).save(out/f'{name}.png')
    fbo.release()
print('Compiled and rendered via',ctx.info['GL_RENDERER'])
print(out)

# Motion study uses a fixed illustrative heat, never a fabricated game response.
if "--video" in sys.argv:
    import subprocess
    width,height=390,420
    fbo=ctx.simple_framebuffer((width,height));fbo.use()
    program['aspect']=width/height;program['heat']=.7;program['celebration']=0
    encoder=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{width}x{height}','-r','24','-i','-','-vf','vflip','-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'motion.mp4')],stdin=subprocess.PIPE)
    for frame in range(96):
        program['time']=4+frame/24
        vao.render(vertices=3)
        encoder.stdin.write(fbo.read(components=3))
    encoder.stdin.close()
    if encoder.wait(): raise RuntimeError('Video encoding failed')
