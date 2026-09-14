/** A bounded emissive volume. This is a visual field, never a game evaluator. */
export const flameVertex = `
varying vec2 v;
void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}
`;

export const flameFragment = `
precision highp float;
varying vec2 v;
uniform sampler2D noiseMap;
uniform float time,heat,aspect,celebration;
uniform vec2 gaze;

float volumeNoise(vec3 p){
  vec3 cell=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  vec2 uv=cell.xy+vec2(37.,17.)*cell.z+f.xy;
  vec2 sampleValue=texture2D(noiseMap,(uv+.5)/128.).rg;
  return mix(sampleValue.x,sampleValue.y,f.z);
}
float densityAt(vec3 p){
  p.x/=1.5; // Broad flame body, with unchanged vertical framing.
  float height=1.94+heat*.58;
  float h=p.y/height;
  if(h<=0.||h>=1.) return 0.;
  float lift=smoothstep(.12,.95,h);
  p.x-=sin(h*5.-time*.95)*(.07+heat*.11)*lift+sin(h*11.-time*1.6)*(.024+heat*.055)*lift;
  p.z-=cos(h*6.-time*.7)*(.05+heat*.055)*lift;
  float radius=(.105+.42*sin(pow(h,.7)*3.14159))*pow(1.-h,.62)*(1.55+heat*.65);
  float radial=length(p.xz)/max(radius,.012);
  vec3 flow=vec3(p.x*4.8,p.y*1.65-time*.9,p.z*4.8);
  float turbulence=volumeNoise(flow)*.68+volumeNoise(flow*2.15+vec3(0.,-time*.37,0.))*.32;
  float angle=atan(p.z,p.x);
  float fold=sin(angle*3.+h*9.-time*1.1)*(.12+heat*.10);
  float surface=.73+fold+(turbulence-.5)*(.26+heat*.12);
  float shell=exp(-abs(radial-surface)*16.);
  float inner=exp(-abs(radial-surface*.46)*14.)*(.28+heat*.12);
  float envelope=smoothstep(0.,.07,h)*(1.-smoothstep(.88,1.,h));
  float ribbon=.18+.82*smoothstep(.25,.69,turbulence);
  float core=exp(-radial*radial*35.)*(1.-smoothstep(.16,.54,h));
  return envelope*((shell+inner)*ribbon*(1.8+heat*.65)+core*(.35+heat*.65));
}
vec2 boxIntersection(vec3 ro,vec3 rd){
  vec3 inverse=1./rd;
  vec3 a=(vec3(-1.7,-.04,-1.15)-ro)*inverse;
  vec3 b=(vec3(1.7,2.65,1.15)-ro)*inverse;
  vec3 nearPlane=min(a,b),farPlane=max(a,b);
  return vec2(max(max(nearPlane.x,nearPlane.y),nearPlane.z),min(min(farPlane.x,farPlane.y),farPlane.z));
}
void main(){
  vec2 screen=(v*2.-1.)*vec2(aspect,1.);
  float angle=gaze.x*.052;
  vec3 ro=vec3(sin(angle)*4.,1.22+gaze.y*.055,cos(angle)*4.);
  vec3 forward=normalize(vec3(0.,1.2,0.)-ro);
  vec3 right=normalize(cross(forward,vec3(0.,1.,0.)));
  vec3 up=cross(right,forward);
  vec3 rd=normalize(screen.x*right+screen.y*up+forward*2.38);
  float pulse=.96+sin(time*1.3)*.035;
  vec3 color=vec3(0.);
  // Soft environmental illumination with perspective on the floor plane.
  if(rd.y<-.0001){
    float floorDistance=(-.035-ro.y)/rd.y;
    vec3 floorPoint=ro+rd*floorDistance;
    float reflection=exp(-dot(floorPoint.xz,floorPoint.xz)*3.6);
    float rim=exp(-abs(length(floorPoint.xz)-.28)*23.);
    color+=vec3(.40,.16,.035)*reflection*(.28+heat*.72+celebration*.25)*pulse;
    color+=vec3(.10,.055,.022)*rim*.17;
  }
  vec2 bounds=boxIntersection(ro,rd);
  float nearDistance=max(0.,bounds.x),farDistance=bounds.y;
  float transmission=1.;
  if(farDistance>nearDistance){
    float stepLength=(farDistance-nearDistance)/44.;
    float jitter=.5;
    float distanceAlong=nearDistance+stepLength*jitter;
    for(int i=0;i<44;i++){
      vec3 p=ro+rd*distanceAlong;
      float density=densityAt(p);
      float alpha=1.-exp(-density*5.6*stepLength);
      float core=smoothstep(.2,1.55,density);
      vec3 emission=mix(vec3(1.5,.19,.008),vec3(3.1,1.9,.6),core);
      emission=mix(emission,vec3(2.7,2.45,1.75),smoothstep(.8,1.45,density)*.8);
      color+=transmission*alpha*emission*(.72+heat*.48+celebration*.14);
      transmission*=1.-alpha;
      if(transmission<.02) break;
      distanceAlong+=stepLength;
    }
  }
  // World-space embers use the same camera and upward flow as the volume.
  for(int i=0;i<14;i++){
    float id=float(i), life=fract(time*(.105+fract(id*.71)*.06)+id*.618);
    float angleSeed=id*2.399;
    vec3 spark=vec3(sin(angleSeed)*(.34+life*(.28+heat*.3)),.12+life*2.7,cos(angleSeed)*.28);
    spark.x+=sin(life*5.+id)*.09;
    vec3 relative=spark-ro;
    float depth=dot(relative,forward);
    vec2 projected=vec2(dot(relative,right),dot(relative,up))*2.38/depth;
    float dist=length(screen-projected);
    float fade=sin(life*3.14159)*(1.-smoothstep(3.+heat*11.,5.+heat*11.,id));
    color+=vec3(.8,.32,.07)*exp(-dist*dist/0.000025)*fade*(.2+heat*.8);
  }
  // Gentle exposure roll-off retains warm detail rather than clipping to white.
  color=vec3(1.)-exp(-color*1.08);
  color=pow(max(color,vec3(0.)),vec3(.82));
  gl_FragColor=vec4(color,1.);
}
`;
