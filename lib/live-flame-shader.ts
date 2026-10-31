/**
 * Flamme procédurale 2D (WebGL 1). Présentation seulement : elle ne lit que des niveaux
 * déjà calculés par la partie (meilleure proximité, poussée d'un essai, victoire).
 *
 * heat   0..1  hauteur et intensité, suit la meilleure proximité acceptée ;
 * surge  0..1  poussée brève après un essai (retombe côté JavaScript) ;
 * glory  0..1  embrasement de victoire.
 */
export const liveFlameVertex = `
attribute vec2 position;
void main(){gl_Position=vec4(position,0.,1.);}
`;

export const liveFlameFragment = `
precision highp float;
uniform vec2 res;
uniform float t,heat,surge,glory;

float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return v;}

vec3 ramp(float x){
  // braise sombre -> rouge -> orange -> or -> blanc chaud
  vec3 c=mix(vec3(.10,.01,.0),vec3(.75,.12,.02),smoothstep(.0,.25,x));
  c=mix(c,vec3(1.,.42,.06),smoothstep(.2,.5,x));
  c=mix(c,vec3(1.,.74,.28),smoothstep(.45,.75,x));
  c=mix(c,vec3(1.,.95,.78),smoothstep(.72,1.,x));
  return c;
}

void main(){
  vec2 uv=gl_FragCoord.xy/res;
  float aspect=res.x/res.y;
  vec2 p=vec2((uv.x-.5)*aspect,uv.y-.1);
  float energy=clamp(heat+surge*.45+glory*.6,0.,1.6);
  float height=mix(.34,1.02,clamp(heat,0.,1.))+surge*.24+glory*.14;
  float speed=1.25+energy*.9;

  // Écoulement vers le haut, déformé par un second bruit : langues de feu.
  vec2 q=vec2(p.x*3.1,p.y*2.4-t*speed);
  float warp=fbm(q*.9+vec2(0.,t*.35));
  float n=fbm(q+vec2(warp*1.7,warp*.6));
  float n2=fbm(q*2.3+vec2(-t*.4,t*.2)+warp);

  float y=clamp(p.y/height,0.,1.4);
  float sway=(n-.5)*.34*y+sin(t*1.7+p.y*6.)*.018*y;
  float width=(.26+.12*energy)*(1.-pow(min(y,1.),1.35))*(.55+.45*smoothstep(0.,.18,y));
  float d=abs(p.x+sway)/max(width,.002);

  float body=1.-smoothstep(.15,1.05,d);
  body*=1.-smoothstep(.55,1.15,y+(n2-.5)*.55);
  body*=smoothstep(-.03,.05,p.y);
  // Langues détachées au sommet.
  float tongues=smoothstep(.55,.92,n2+n*.45)*smoothstep(.35,.9,y)*(1.-smoothstep(1.,1.35,y))*(1.-smoothstep(.6,1.6,d));
  float f=clamp(body*(.75+n*.6)+tongues*.75,0.,1.);

  float core=(1.-smoothstep(.0,.55,d))*(1.-smoothstep(.1,.62,y))*body;
  float lum=f*(.62+energy*.35)+core*(.35+energy*.3);
  vec3 col=ramp(clamp(lum,0.,1.));
  // Halo chaud autour de la flamme, et lueur au sol.
  float halo=exp(-pow(length(vec2(p.x*1.3,(p.y-height*.35)*.9)),2.)*7.)*(.10+energy*.16);
  float sol=exp(-pow(p.x*2.6,2.)*6.-pow((p.y+.02)*22.,2.))*(.25+energy*.35);
  // Sortie prémultipliée : la flamme couvre, le halo n'ajoute que de la lumière (jamais d'ombre).
  float fa=clamp(f*1.15,0.,1.);
  // Le halo s'éteint avant les bords du canevas : aucun rectangle visible.
  float bord=smoothstep(0.,.3,uv.x)*smoothstep(1.,.7,uv.x)*smoothstep(1.,.65,uv.y)*smoothstep(0.,.07,uv.y);
  float glow=(halo+sol)*bord;
  vec3 rgb=col*fa+vec3(1.,.45,.12)*glow;
  gl_FragColor=vec4(rgb,clamp(fa+glow*.35,0.,1.));
}
`;
