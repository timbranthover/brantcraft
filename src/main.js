const canvas = document.querySelector('#gfx');
const loading = document.querySelector('#loading');
const progress = document.querySelector('#progress');
const fallback = document.querySelector('#fallback');
const fpsEl = document.querySelector('#fps');

const TAU = Math.PI * 2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const v3=(x=0,y=0,z=0)=>[x,y,z];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(a[0],a[1],a[2]);
const norm=a=>{const l=len(a)||1;return [a[0]/l,a[1]/l,a[2]/l]};

function mat4Identity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}
function mat4Mul(a,b){
  const o=new Float32Array(16);
  for(let c=0;c<4;c++) for(let r=0;r<4;r++) o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];
  return o;
}
function mat4Perspective(fov,aspect,n,f){
  const q=1/Math.tan(fov/2), o=new Float32Array(16);
  o[0]=q/aspect;o[5]=q;o[10]=f/(n-f);o[11]=-1;o[14]=(n*f)/(n-f);return o;
}
function mat4Ortho(l,r,b,t,n,f){
  const o=mat4Identity();o[0]=2/(r-l);o[5]=2/(t-b);o[10]=1/(n-f);o[12]=(l+r)/(l-r);o[13]=(t+b)/(b-t);o[14]=n/(n-f);return o;
}
function mat4LookAt(eye,target,up=[0,1,0]){
  const z=norm(sub(eye,target)), x=norm(cross(up,z)), y=cross(z,x), o=mat4Identity();
  o[0]=x[0];o[1]=y[0];o[2]=z[0];
  o[4]=x[1];o[5]=y[1];o[6]=z[1];
  o[8]=x[2];o[9]=y[2];o[10]=z[2];
  o[12]=-dot(x,eye);o[13]=-dot(y,eye);o[14]=-dot(z,eye);return o;
}

class MeshBuilder{
  constructor(){this.v=[];this.i=[];}
  vert(p,n,uv,mat){this.v.push(...p,...n,...uv,mat);return this.v.length/9-1}
  tri(a,b,c){this.i.push(a,b,c)}
  quad(p0,p1,p2,p3,n,mat,uv=[0,0,1,0,1,1,0,1]){
    const a=this.vert(p0,n,[uv[0],uv[1]],mat),b=this.vert(p1,n,[uv[2],uv[3]],mat),c=this.vert(p2,n,[uv[4],uv[5]],mat),d=this.vert(p3,n,[uv[6],uv[7]],mat);this.tri(a,b,c);this.tri(a,c,d);
  }
  box(cx,cy,cz,sx,sy,sz,mat){
    const x0=cx-sx/2,x1=cx+sx/2,y0=cy-sy/2,y1=cy+sy/2,z0=cz-sz/2,z1=cz+sz/2;
    this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],mat,[0,0,sx,0,sx,sy,0,sy]);
    this.quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1],mat,[0,0,sx,0,sx,sy,0,sy]);
    this.quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0],mat,[0,0,sz,0,sz,sy,0,sy]);
    this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],mat,[0,0,sz,0,sz,sy,0,sy]);
    this.quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0],mat,[0,0,sx,0,sx,sz,0,sz]);
    this.quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0],mat,[0,0,sx,0,sx,sz,0,sz]);
  }
  cylinder(cx,cy,cz,r,h,seg,mat,axis='y'){
    const base=this.v.length/9;
    const p=(a,y)=>axis==='y'?[cx+Math.cos(a)*r,cy+y,cz+Math.sin(a)*r]:axis==='x'?[cx+y,cy+Math.cos(a)*r,cz+Math.sin(a)*r]:[cx+Math.cos(a)*r,cy+Math.sin(a)*r,cz+y];
    const nn=a=>axis==='y'?[Math.cos(a),0,Math.sin(a)]:axis==='x'?[0,Math.cos(a),Math.sin(a)]:[Math.cos(a),Math.sin(a),0];
    for(let s=0;s<=seg;s++){const a=s/seg*TAU,n=nn(a);this.vert(p(a,-h/2),n,[s/seg,0],mat);this.vert(p(a,h/2),n,[s/seg,h],mat)}
    for(let s=0;s<seg;s++){const a=base+s*2,b=a+1,c=a+3,d=a+2;this.tri(a,b,c);this.tri(a,c,d)}
    const c0=this.vert(axis==='y'?[cx,cy-h/2,cz]:axis==='x'?[cx-h/2,cy,cz]:[cx,cy,cz-h/2],axis==='y'?[0,-1,0]:axis==='x'?[-1,0,0]:[0,0,-1],[.5,.5],mat);
    const c1=this.vert(axis==='y'?[cx,cy+h/2,cz]:axis==='x'?[cx+h/2,cy,cz]:[cx,cy,cz+h/2],axis==='y'?[0,1,0]:axis==='x'?[1,0,0]:[0,0,1],[.5,.5],mat);
    for(let s=0;s<seg;s++){const a=base+s*2,b=base+((s+1)%seg)*2;this.tri(c0,b,a);this.tri(c1,a+1,b+1)}
  }
  sphere(cx,cy,cz,r,lat,lon,mat,ys=1){
    const base=this.v.length/9;
    for(let y=0;y<=lat;y++){
      const v=y/lat,th=v*Math.PI;
      for(let x=0;x<=lon;x++){
        const u=x/lon,ph=u*TAU,n=[Math.sin(th)*Math.cos(ph),Math.cos(th),Math.sin(th)*Math.sin(ph)];
        this.vert([cx+n[0]*r,cy+n[1]*r*ys,cz+n[2]*r],norm([n[0],n[1]/ys,n[2]]),[u,v],mat);
      }
    }
    for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){const a=base+y*(lon+1)+x,b=a+1,c=a+lon+2,d=a+lon+1;this.tri(a,d,c);this.tri(a,c,b)}
  }
  archPanel(cx,cy,cz,w,h,depth,mat,frontZ=1){
    const z=cz+frontZ*depth/2, n=[0,0,frontZ], x0=cx-w/2,x1=cx+w/2,rectH=h-w/2,y0=cy-h/2,y1=y0+rectH;
    this.quad([x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z],n,mat,[0,0,1,0,1,1,0,1]);
    const base=this.v.length/9, seg=18, cY=y1;
    this.vert([cx,cY,z],n,[.5,0],mat);
    for(let s=0;s<=seg;s++){const a=Math.PI-s/seg*Math.PI;this.vert([cx+Math.cos(a)*w/2,cY+Math.sin(a)*w/2,z],n,[.5+.5*Math.cos(a),Math.sin(a)],mat)}
    for(let s=0;s<seg;s++){if(frontZ>0)this.tri(base,base+s+1,base+s+2);else this.tri(base,base+s+2,base+s+1)}
  }
  frond(cx,cy,cz,ang,len,w,mat){
    const dir=[Math.cos(ang),-.18,Math.sin(ang)], side=norm(cross(dir,[0,1,0]));
    const steps=7;let prevL=null,prevR=null;
    for(let s=0;s<=steps;s++){
      const t=s/steps, bend=t*t*1.3, p=[cx+dir[0]*len*t,cy+0.3*Math.sin(t*Math.PI)-bend,cz+dir[2]*len*t], ww=w*(1-t)*(.7+.3*Math.sin(t*Math.PI));
      const L=add(p,mul(side,ww)),R=add(p,mul(side,-ww));
      if(prevL){const n=norm(cross(sub(prevR,prevL),sub(L,prevL)));this.quad(prevL,prevR,R,L,n,mat,[0,0,1,0,1,1,0,1]);}
      prevL=L;prevR=R;
    }
  }
}

const MAT={GRASS:1,STUCCO:2,STONE:3,WOOD:4,SHUTTER:5,TILE:6,METAL:7,FABRIC:8,DARK:9,LEAF:10,TRUNK:11,SKIN:12,WHITE:13,WATER:14,GLASS:15};
const opaque=new MeshBuilder();

opaque.box(0,-0.18,2,38,.32,30,MAT.GRASS);
opaque.box(9.0,-0.04,8.45,18.8,.14,8.1,MAT.STONE);
opaque.box(9.0,-0.02,4.55,18.8,.22,.42,MAT.STONE);
opaque.box(9.0,-0.02,12.35,18.8,.22,.42,MAT.STONE);
opaque.box(-0.2,-0.02,8.45,.42,.22,8.2,MAT.STONE);
opaque.box(18.2,-0.02,8.45,.42,.22,8.2,MAT.STONE);

opaque.box(-8.0,2.7,-5.6,10.8,5.4,5.8,MAT.STUCCO);
opaque.box(-10.25,6.25,-6.75,4.25,1.7,3.5,MAT.STUCCO);
opaque.box(-8.0,.24,-2.67,10.9,.35,.18,MAT.STONE);
function windowSet(x,y,z,w,h,arched=false){
  if(arched) opaque.archPanel(x,y,z,w,h,.08,MAT.GLASS,1); else opaque.box(x,y,z,w,h,.08,MAT.GLASS);
  const sw=.42;
  opaque.box(x-w/2-sw*.55,y,z+.07,sw,h,.11,MAT.SHUTTER);
  opaque.box(x+w/2+sw*.55,y,z+.07,sw,h,.11,MAT.SHUTTER);
  opaque.box(x,y-h/2-.055,z+.09,w+.16,.09,.1,MAT.WOOD);opaque.box(x,y+h/2+.055,z+.09,w+.16,.09,.1,MAT.WOOD);
  opaque.box(x-w/2-.055,y,z+.09,.09,h+.16,.1,MAT.WOOD);opaque.box(x+w/2+.055,y,z+.09,.09,h+.16,.1,MAT.WOOD);
}
windowSet(-9.6,4.3,-2.66,1.45,1.65,false);
windowSet(-5.8,3.45,-2.66,1.28,1.9,true);
windowSet(-8.55,1.45,-2.66,3.2,1.25,false);
windowSet(-4.05,1.5,-2.66,1.15,1.65,true);
function awning(x,y,z,w){for(let s=0;s<Math.ceil(w/.32);s++)opaque.cylinder(x-w/2+.16+s*.32,y,z,.11,.38,10,MAT.TILE,'x')}
awning(-8.55,2.27,-2.47,3.8);awning(-9.6,5.27,-2.47,1.9);awning(-5.8,4.58,-2.47,1.75);

opaque.box(6.6,2.25,-7.7,11.7,4.5,5.4,MAT.STUCCO);
opaque.box(9.0,4.85,-8.3,6.2,1.2,4.2,MAT.STUCCO);
windowSet(4.3,3.15,-4.98,1.1,1.35,false);windowSet(8.05,3.15,-4.98,1.0,1.35,false);windowSet(11.15,3.15,-4.98,1.0,1.35,false);
awning(4.3,4.02,-4.8,1.6);awning(8.05,4.02,-4.8,1.6);
for(let s=0;s<9;s++)opaque.box(1.35+s*.52,.17+s*.19,-4.4+s*.24,1.05,.34+s*.02,.72,MAT.STONE);
opaque.box(3.72,1.8,-3.2,5.6,.35,.35,MAT.STUCCO);opaque.box(1.15,1.4,-4.25,.35,2.8,2.6,MAT.STUCCO);
opaque.box(12.0,5.45,-8.8,.58,3.0,.58,MAT.STUCCO);opaque.box(12.0,6.98,-8.8,.78,.12,.78,MAT.STONE);
opaque.cylinder(8.5,6.15,-7.0,.42,2.25,18,MAT.METAL,'x');
opaque.box(8.5,5.35,-7.0,2.6,.08,.9,MAT.DARK);
for(const dx of [-.75,.75]){opaque.cylinder(8.5+dx,5.55,-6.75,.06,.72,10,MAT.METAL,'y');opaque.cylinder(8.5+dx,5.55,-7.25,.06,.72,10,MAT.METAL,'y')}

opaque.box(15.3,1.35,-2.9,6.4,2.7,4.2,MAT.STUCCO);
opaque.box(15.1,2.88,-2.3,7.0,.22,5.4,MAT.WOOD);
for(let x=12.0;x<18.5;x+=.34)opaque.cylinder(x,3.03,-2.3,.13,5.4,8,MAT.TILE,'z');
for(const x of [12.0,18.1])for(const z of [-.6,-4.1])opaque.box(x,1.45,z,.3,2.9,.3,MAT.STONE);
opaque.box(16.0,1.0,-1.0,3.1,.16,.65,MAT.WOOD);opaque.box(16.0,.72,-1.0,3.0,.12,.52,MAT.WOOD);
for(let k=0;k<4;k++)opaque.cylinder(15.2+k*.45,1.28,-.92,.06,.42,10,k%2?MAT.GLASS:MAT.SHUTTER,'y');

opaque.box(5.0,.92,-3.6,1.5,.65,.75,MAT.METAL);opaque.box(5.0,1.34,-3.6,1.45,.18,.75,MAT.DARK);
for(const x of [4.45,5.55]){opaque.cylinder(x,.43,-3.35,.07,.85,8,MAT.METAL,'y');opaque.cylinder(x,.43,-3.85,.07,.85,8,MAT.METAL,'y')}
opaque.cylinder(4.55,.24,-3.35,.18,.12,12,MAT.DARK,'x');opaque.cylinder(5.45,.24,-3.35,.18,.12,12,MAT.DARK,'x');

function lounger(x,z){
  opaque.box(x,.33,z,1.15,.16,2.25,MAT.WHITE);opaque.box(x,.48,z-.72,1.02,.12,.8,MAT.FABRIC);
  opaque.box(x,.68,z-.88,1.0,.1,.95,MAT.FABRIC);
  for(const dx of [-.45,.45]){opaque.box(x+dx,.16,z,0.08,.34,2.0,MAT.WHITE)}
}
for(let k=0;k<4;k++)lounger(-5.0+k*1.35,2.9-k*.08);
opaque.box(-7.3,.18,3.95,1.0,.11,2.4,MAT.SHUTTER);

function person(x,y,z,shirt=MAT.DARK,pants=MAT.DARK,skin=MAT.SKIN){
  opaque.sphere(x,y+1.48,z,.18,8,10,skin,1.05);
  opaque.cylinder(x,y+1.0,z,.28,.78,10,shirt,'y');
  opaque.cylinder(x-.32,y+1.03,z,.105,.62,8,skin,'x');opaque.cylinder(x+.32,y+1.03,z,.105,.62,8,skin,'x');
  opaque.cylinder(x-.15,y+.45,z+.18,.12,.85,8,pants,'y');opaque.cylinder(x+.15,y+.45,z+.18,.12,.85,8,pants,'y');
}
person(-4.95,.32,2.75);person(-3.6,.32,2.66);person(-2.2,.32,2.58);person(-5.2,.92,2.35);

for(let s=0;s<15;s++){const t=s/14;opaque.cylinder(-11.7+Math.sin(t*1.2)*.35,2.7*t,1.1-.3*t,.46-.16*t,.26,10,MAT.TRUNK,'y')}
for(let f=0;f<28;f++)opaque.frond(-11.45,3.0,.8,f/28*TAU,3.7+(f%5)*.18,.3,MAT.LEAF);
function tree(x,z,scale=1){opaque.cylinder(x,1.4*scale,z,.28*scale,2.8*scale,9,MAT.TRUNK,'y');for(let k=0;k<7;k++){const a=k/7*TAU;opaque.sphere(x+Math.cos(a)*.65*scale,3.35*scale+Math.sin(k*2.1)*.18,z+Math.sin(a)*.65*scale,1.05*scale,6,8,MAT.LEAF,.78)}}
for(const t of [[-1.2,-10.5,1.1],[3.2,-11.5,1.0],[7.3,-11.3,1.05],[11.0,-10.8,1.0],[-5.0,-11.2,1.1],[15.0,-9.8,.9]])tree(...t);
function shrub(x,z,s=.7){for(let k=0;k<5;k++){const a=k/5*TAU;opaque.sphere(x+Math.cos(a)*.28*s,.42*s,z+Math.sin(a)*.28*s,.46*s,5,7,MAT.LEAF,.8)}}
shrub(3.0,-3.1,1.0);shrub(10.4,-3.2,1.2);shrub(11.0,-1.8,.8);

const water=new MeshBuilder();
const wx0=.1,wx1=17.9,wz0=4.85,wz1=12.05,nx=48,nz=18;
const wb=water.v.length/9;
for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const u=x/nx,v=z/nz;water.vert([lerp(wx0,wx1,u),.045,lerp(wz0,wz1,v)],[0,1,0],[u,v],MAT.WATER)}
for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const a=wb+z*(nx+1)+x,b=a+1,c=a+nx+2,d=a+nx+1;water.tri(a,d,c);water.tri(a,c,b)}

const blockers=[[-13.5,-2.2,-8.5,-2.5],[.3,12.6,-10.4,-5.0],[11.6,18.6,-5.0,-.3]];
function blocked(x,z){return blockers.some(b=>x>b[0]-.45&&x<b[1]+.45&&z>b[2]-.45&&z<b[3]+.45) || (x>.0&&x<18.1&&z>4.7&&z<12.2)}

async function main(){
  progress.style.width='8%';
  if(!navigator.gpu){fallback.style.display='grid';loading.style.display='none';return}
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  if(!adapter) throw new Error('WebGPU adapter unavailable');
  const device=await adapter.requestDevice();
  device.lost.then(info=>console.error('GPU device lost',info));
  progress.style.width='18%';
  const ctx=canvas.getContext('webgpu');const format=navigator.gpu.getPreferredCanvasFormat();ctx.configure({device,format,alphaMode:'opaque'});

  const opaqueVB=device.createBuffer({size:opaque.v.length*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(opaqueVB,0,new Float32Array(opaque.v));
  const opaqueIB=device.createBuffer({size:opaque.i.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(opaqueIB,0,new Uint32Array(opaque.i));
  const waterVB=device.createBuffer({size:water.v.length*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(waterVB,0,new Float32Array(water.v));
  const waterIB=device.createBuffer({size:water.i.length*4,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(waterIB,0,new Uint32Array(water.i));
  progress.style.width='32%';

  const uniform=device.createBuffer({size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const shadowSize=1536;
  const shadowTex=device.createTexture({size:[shadowSize,shadowSize],format:'depth32float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
  const shadowSampler=device.createSampler({compare:'less',magFilter:'linear',minFilter:'linear'});
  let depthTex=null;

  const common=`
struct Globals{viewProj:mat4x4<f32>,lightVP:mat4x4<f32>,camTime:vec4<f32>,sun:vec4<f32>,screen:vec4<f32>};
@group(0) @binding(0) var<uniform> g:Globals;
@group(0) @binding(1) var shadowTex:texture_depth_2d;
@group(0) @binding(2) var shadowSamp:sampler_comparison;
struct In{@location(0) pos:vec3<f32>,@location(1) nrm:vec3<f32>,@location(2) uv:vec2<f32>,@location(3) mat:f32};
struct Out{@builtin(position) pos:vec4<f32>,@location(0) wpos:vec3<f32>,@location(1) nrm:vec3<f32>,@location(2) uv:vec2<f32>,@location(3) mat:f32,@location(4) shadow:vec4<f32>};
fn hash31(p:vec3<f32>)->f32{return fract(sin(dot(p,vec3<f32>(127.1,311.7,74.7)))*43758.5453);}
fn noise(p:vec3<f32>)->f32{let i=floor(p);let f=fract(p);let u=f*f*(3.0-2.0*f);let n000=hash31(i);let n100=hash31(i+vec3<f32>(1.0,0.0,0.0));let n010=hash31(i+vec3<f32>(0.0,1.0,0.0));let n110=hash31(i+vec3<f32>(1.0,1.0,0.0));let n001=hash31(i+vec3<f32>(0.0,0.0,1.0));let n101=hash31(i+vec3<f32>(1.0,0.0,1.0));let n011=hash31(i+vec3<f32>(0.0,1.0,1.0));let n111=hash31(i+vec3<f32>(1.0,1.0,1.0));return mix(mix(mix(n000,n100,u.x),mix(n010,n110,u.x),u.y),mix(mix(n001,n101,u.x),mix(n011,n111,u.x),u.y),u.z);}
fn fbm(p0:vec3<f32>)->f32{var p=p0;var a=.5;var s=0.0;for(var k=0;k<4;k++){s+=noise(p)*a;p=p*2.02+vec3<f32>(1.7,9.2,4.1);a*=.5;}return s;}
fn aces(x:vec3<f32>)->vec3<f32>{let a=2.51;let b=.03;let c=2.43;let d=.59;let e=.14;return clamp((x*(a*x+b))/(x*(c*x+d)+e),vec3<f32>(0.0),vec3<f32>(1.0));}
fn shadowFactor(sc:vec4<f32>,n:vec3<f32>)->f32{let q=sc.xyz/sc.w;let uv=q.xy*vec2<f32>(.5,-.5)+vec2<f32>(.5);let z=q.z; if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0||z<0.0||z>1.0){return 1.0;} let texel=1.0/1536.0;var s=0.0;let bias=max(.0007*(1.0-dot(n,normalize(g.sun.xyz))),.00015);for(var yy=-1;yy<=1;yy++){for(var xx=-1;xx<=1;xx++){s+=textureSampleCompare(shadowTex,shadowSamp,uv+vec2<f32>(f32(xx),f32(yy))*texel,z-bias);}}return s/9.0;}
fn matBase(id:f32,p:vec3<f32>,uv:vec2<f32>)->vec4<f32>{
 let n=fbm(p*1.7)+.35*noise(p*18.0);
 if(id<1.5){let blade=.04*sin((p.x+p.z)*34.0)+.025*sin(p.x*71.0);return vec4<f32>(vec3<f32>(.18,.29,.075)*(0.78+.35*n)+blade,0.92);}
 if(id<2.5){let mott=.86+.22*n;let grime=smoothstep(.72,.95,noise(p*3.2))*0.07;return vec4<f32>(vec3<f32>(.88,.84,.71)*mott-grime,0.88);}
 if(id<3.5){let grout=smoothstep(.92,.98,abs(fract(uv.x*2.2)-.5)*2.0)+smoothstep(.92,.98,abs(fract(uv.y*2.2)-.5)*2.0);return vec4<f32>(mix(vec3<f32>(.61,.52,.39)*(0.8+.28*n),vec3<f32>(.34,.30,.25),clamp(grout,0.0,1.0)),0.8);}
 if(id<4.5){let grain=.75+.28*noise(vec3<f32>(uv.x*2.0,p.y*13.0,uv.y*2.0));return vec4<f32>(vec3<f32>(.24,.115,.045)*grain,0.72);}
 if(id<5.5){let slats=.83+.17*step(.16,fract((p.y+uv.x*.02)*10.0));return vec4<f32>(vec3<f32>(.035,.18,.075)*slats,0.76);}
 if(id<6.5){let ridges=.75+.25*abs(sin((p.x+p.z)*19.0));return vec4<f32>(vec3<f32>(.58,.28,.075)*ridges,0.84);}
 if(id<7.5){return vec4<f32>(vec3<f32>(.28,.31,.32)*(0.75+.3*n),0.32);}
 if(id<8.5){return vec4<f32>(vec3<f32>(.16,.30,.49)*(0.86+.18*n),0.62);}
 if(id<9.5){return vec4<f32>(vec3<f32>(.035,.042,.047)*(0.86+.18*n),0.5);}
 if(id<10.5){return vec4<f32>(vec3<f32>(.10,.24,.075)*(0.72+.45*n),0.9);}
 if(id<11.5){let bands=.7+.3*step(.45,fract(p.y*3.7+p.x*.4));return vec4<f32>(vec3<f32>(.22,.14,.075)*bands*(0.82+.25*n),0.95);}
 if(id<12.5){return vec4<f32>(vec3<f32>(.42,.24,.15)*(0.92+.12*n),0.7);}
 if(id<13.5){return vec4<f32>(vec3<f32>(.82,.82,.79)*(0.9+.15*n),0.76);}
 if(id<15.5){return vec4<f32>(vec3<f32>(.045,.085,.10),0.1);}
 return vec4<f32>(vec3<f32>(.5),.8);
}
`;

  const sceneWGSL=common+`
@vertex fn vs(i:In)->Out{var o:Out;o.wpos=i.pos;o.nrm=i.nrm;o.uv=i.uv;o.mat=i.mat;o.pos=g.viewProj*vec4<f32>(i.pos,1.0);o.shadow=g.lightVP*vec4<f32>(i.pos,1.0);return o;}
@fragment fn fs(i:Out)->@location(0) vec4<f32>{
 let N=normalize(i.nrm);let L=normalize(g.sun.xyz);let V=normalize(g.camTime.xyz-i.wpos);let H=normalize(L+V);let mb=matBase(i.mat,i.wpos,i.uv);let al=mb.rgb;let rough=mb.a;let ndl=max(dot(N,L),0.0);let sh=shadowFactor(i.shadow,N);let hemi=.22+.28*max(N.y,0.0);let f0=.035;let fres=f0+(1.0-f0)*pow(1.0-max(dot(N,V),0.0),5.0);let spec=pow(max(dot(N,H),0.0),mix(180.0,10.0,rough))*mix(.95,.12,rough);var col=al*(hemi+1.25*ndl*sh)+vec3<f32>(spec*fres*sh*2.1);
 let dist=distance(g.camTime.xyz,i.wpos);let fog=1.0-exp(-dist*.012);let sky=vec3<f32>(.45,.66,.87);col=mix(col,sky,fog*.5);col=aces(col*1.2);return vec4<f32>(pow(col,vec3<f32>(1.0/2.2)),1.0);
}`;
  const shadowWGSL=`
struct Globals{viewProj:mat4x4<f32>,lightVP:mat4x4<f32>,camTime:vec4<f32>,sun:vec4<f32>,screen:vec4<f32>};@group(0) @binding(0) var<uniform> g:Globals;struct In{@location(0) pos:vec3<f32>,@location(1) nrm:vec3<f32>,@location(2) uv:vec2<f32>,@location(3) mat:f32};@vertex fn vs(i:In)->@builtin(position) vec4<f32>{return g.lightVP*vec4<f32>(i.pos,1.0);}`;
  const skyWGSL=`
struct Globals{viewProj:mat4x4<f32>,lightVP:mat4x4<f32>,camTime:vec4<f32>,sun:vec4<f32>,screen:vec4<f32>};@group(0) @binding(0) var<uniform> g:Globals;struct O{@builtin(position)p:vec4<f32>,@location(0)uv:vec2<f32>};@vertex fn vs(@builtin(vertex_index)i:u32)->O{var o:O;let p=array<vec2<f32>,3>(vec2<f32>(-1.0,-1.0),vec2<f32>(3.0,-1.0),vec2<f32>(-1.0,3.0));o.p=vec4<f32>(p[i],0.999,1.0);o.uv=p[i];return o;}fn hash(p:vec2<f32>)->f32{return fract(sin(dot(p,vec2<f32>(127.1,311.7)))*43758.5453);}@fragment fn fs(i:O)->@location(0) vec4<f32>{let frag=i.p.xy/g.screen.xy;let y=clamp(1.0-frag.y,0.0,1.0);var c=mix(vec3<f32>(.73,.83,.91),vec3<f32>(.11,.35,.67),pow(y,.7));let sunUV=vec2<f32>(.72,.26);let d=distance(frag,sunUV);c+=vec3<f32>(1.0,.78,.48)*exp(-d*d*900.0)*2.0;let cloud=hash(floor(frag*vec2<f32>(180.0,90.0))+floor(g.camTime.w*.02));let band=smoothstep(.46,.8,sin(frag.x*12.0+frag.y*4.0)+.45*sin(frag.x*27.0));c=mix(c,vec3<f32>(.96,.97,.98),band*.09*(.8+.2*cloud));return vec4<f32>(pow(c,vec3<f32>(1.0/2.2)),1.0);}`;
  const waterWGSL=common+`
@vertex fn vs(i:In)->Out{var o:Out;let t=g.camTime.w;var p=i.pos;let w1=sin(p.x*.55+t*1.35)+sin(p.z*.8-t*1.05);let w2=sin((p.x+p.z)*1.4+t*1.9);p.y+=w1*.018+w2*.008;o.wpos=p;o.nrm=normalize(vec3<f32>(-.012*cos(p.x*.55+t*1.35),1.0,-.018*cos(p.z*.8-t*1.05)));o.uv=i.uv;o.mat=i.mat;o.pos=g.viewProj*vec4<f32>(p,1.0);o.shadow=g.lightVP*vec4<f32>(p,1.0);return o;}
@fragment fn fs(i:Out)->@location(0) vec4<f32>{let N=normalize(i.nrm);let V=normalize(g.camTime.xyz-i.wpos);let L=normalize(g.sun.xyz);let fres=.04+.96*pow(1.0-max(dot(N,V),0.0),5.0);let sky=vec3<f32>(.19,.48,.72);let deep=vec3<f32>(.015,.18,.25);let gl=pow(max(dot(reflect(-L,N),V),0.0),240.0);let ripple=.015*sin((i.wpos.x-i.wpos.z)*13.0+g.camTime.w*2.0);var c=mix(deep+ripple,sky,fres);c+=vec3<f32>(1.0,.88,.68)*gl*2.4;return vec4<f32>(pow(c,vec3<f32>(1.0/2.2)),.86);}`;

  async function module(code,label){const m=device.createShaderModule({code,label});const info=await m.getCompilationInfo();const bad=info.messages.filter(x=>x.type==='error');if(bad.length)throw new Error(label+': '+bad.map(x=>`${x.lineNum}:${x.linePos} ${x.message}`).join(' | '));return m}
  const sceneMod=await module(sceneWGSL,'scene');const shadowMod=await module(shadowWGSL,'shadow');const skyMod=await module(skyWGSL,'sky');const waterMod=await module(waterWGSL,'water');
  progress.style.width='54%';

  const vbuf=[{arrayStride:36,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x2'},{shaderLocation:3,offset:32,format:'float32'}]}];
  const shadowPipe=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:shadowMod,entryPoint:'vs',buffers:vbuf},primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less'}});
  const scenePipe=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:sceneMod,entryPoint:'vs',buffers:vbuf},fragment:{module:sceneMod,entryPoint:'fs',targets:[{format}]},primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});
  const skyPipe=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:skyMod,entryPoint:'vs'},fragment:{module:skyMod,entryPoint:'fs',targets:[{format}]},primitive:{topology:'triangle-list'},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'less-equal'}});
  const waterPipe=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:waterMod,entryPoint:'vs',buffers:vbuf},fragment:{module:waterMod,entryPoint:'fs',targets:[{format,blend:{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'}}}]},primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'less'}});

  const shadowBG=device.createBindGroup({layout:shadowPipe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:uniform}}]});
  const sceneBG=device.createBindGroup({layout:scenePipe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:uniform}},{binding:1,resource:shadowTex.createView()},{binding:2,resource:shadowSampler}]});
  const skyBG=device.createBindGroup({layout:skyPipe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:uniform}}]});
  const waterBG=device.createBindGroup({layout:waterPipe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:uniform}},{binding:1,resource:shadowTex.createView()},{binding:2,resource:shadowSampler}]});
  progress.style.width='74%';

  const cam={p:[-13.8,1.62,10.8],yaw:0.76,pitch:-0.11,vy:0,g:true};
  const keys=new Set();addEventListener('keydown',e=>keys.add(e.code));addEventListener('keyup',e=>keys.delete(e.code));canvas.addEventListener('click',()=>canvas.requestPointerLock?.());document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){cam.yaw-=e.movementX*.00165;cam.pitch=clamp(cam.pitch-e.movementY*.00145,-1.35,1.35)}});
  let mt=[0,0],run=false,sid=null,lid=null,ll=[0,0];const stick=document.querySelector('#moveStick'),nub=stick.querySelector('.nub');function sm(x,y){const r=stick.getBoundingClientRect();let dx=x-r.left-59,dy=y-r.top-59,l=Math.hypot(dx,dy);if(l>42){dx*=42/l;dy*=42/l}nub.style.transform=`translate(${dx}px,${dy}px)`;mt=[dx/42,dy/42]}
  stick.addEventListener('pointerdown',e=>{sid=e.pointerId;stick.setPointerCapture(sid);sm(e.clientX,e.clientY)});stick.addEventListener('pointermove',e=>{if(e.pointerId===sid)sm(e.clientX,e.clientY)});stick.addEventListener('pointerup',e=>{if(e.pointerId===sid){sid=null;mt=[0,0];nub.style.transform=''}});
  const look=document.querySelector('#lookZone');look.addEventListener('pointerdown',e=>{lid=e.pointerId;ll=[e.clientX,e.clientY];look.setPointerCapture(lid)});look.addEventListener('pointermove',e=>{if(e.pointerId===lid){cam.yaw-=(e.clientX-ll[0])*.0031;cam.pitch=clamp(cam.pitch-(e.clientY-ll[1])*.0027,-1.35,1.35);ll=[e.clientX,e.clientY]}});look.addEventListener('pointerup',e=>{if(e.pointerId===lid)lid=null});document.querySelector('#runBtn').addEventListener('pointerdown',()=>run=true);document.querySelector('#runBtn').addEventListener('pointerup',()=>run=false);document.querySelector('#jumpBtn').addEventListener('pointerdown',()=>{if(cam.g){cam.vy=4.5;cam.g=false}});

  function resize(){const d=Math.min(devicePixelRatio||1,1.35),w=Math.max(1,Math.floor(innerWidth*d)),h=Math.max(1,Math.floor(innerHeight*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;depthTex?.destroy();depthTex=device.createTexture({size:[w,h],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});}}
  resize();addEventListener('resize',resize);progress.style.width='100%';setTimeout(()=>loading.classList.add('done'),180);setTimeout(()=>loading.remove(),700);
  let last=performance.now(),ft=last,fc=0;
  function frame(now){
    const dt=Math.min(.033,(now-last)/1000);last=now;
    const F=[Math.sin(cam.yaw),0,Math.cos(cam.yaw)],R=[Math.cos(cam.yaw),0,-Math.sin(cam.yaw)];let x=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+mt[0],z=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-mt[1],l=Math.hypot(x,z);if(l>1){x/=l;z/=l}const sp=(keys.has('ShiftLeft')||run)?5.2:3.0;let nxp=cam.p[0]+(R[0]*x+F[0]*z)*sp*dt,nzp=cam.p[2]+(R[2]*x+F[2]*z)*sp*dt;if(!blocked(nxp,cam.p[2]))cam.p[0]=nxp;if(!blocked(cam.p[0],nzp))cam.p[2]=nzp;if(keys.has('Space')&&cam.g){cam.vy=4.5;cam.g=false}cam.vy-=10.5*dt;cam.p[1]+=cam.vy*dt;if(cam.p[1]<1.62){cam.p[1]=1.62;cam.vy=0;cam.g=true}
    resize();
    const aspect=canvas.width/canvas.height,forward=[Math.sin(cam.yaw)*Math.cos(cam.pitch),Math.sin(cam.pitch),Math.cos(cam.yaw)*Math.cos(cam.pitch)],target=add(cam.p,forward);const vp=mat4Mul(mat4Perspective(64*Math.PI/180,aspect,.06,120),mat4LookAt(cam.p,target));
    const sunDir=norm([-.48,.81,.34]),lightPos=mul(sunDir,-28),lightVP=mat4Mul(mat4Ortho(-28,28,-22,22,.1,70),mat4LookAt(lightPos,[0,1,-2]));
    const data=new Float32Array(64);data.set(vp,0);data.set(lightVP,16);data.set([...cam.p,now/1000],32);data.set([...sunDir,2.2],36);data.set([canvas.width,canvas.height,1/canvas.width,1/canvas.height],40);device.queue.writeBuffer(uniform,0,data);
    const enc=device.createCommandEncoder();
    {const p=enc.beginRenderPass({depthStencilAttachment:{view:shadowTex.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});p.setPipeline(shadowPipe);p.setBindGroup(0,shadowBG);p.setVertexBuffer(0,opaqueVB);p.setIndexBuffer(opaqueIB,'uint32');p.drawIndexed(opaque.i.length);p.end();}
    {const p=enc.beginRenderPass({colorAttachments:[{view:ctx.getCurrentTexture().createView(),clearValue:{r:.35,g:.55,b:.78,a:1},loadOp:'clear',storeOp:'store'}],depthStencilAttachment:{view:depthTex.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});p.setPipeline(skyPipe);p.setBindGroup(0,skyBG);p.draw(3);p.setPipeline(scenePipe);p.setBindGroup(0,sceneBG);p.setVertexBuffer(0,opaqueVB);p.setIndexBuffer(opaqueIB,'uint32');p.drawIndexed(opaque.i.length);p.setPipeline(waterPipe);p.setBindGroup(0,waterBG);p.setVertexBuffer(0,waterVB);p.setIndexBuffer(waterIB,'uint32');p.drawIndexed(water.i.length);p.end();}
    device.queue.submit([enc.finish()]);
    fc++;if(now-ft>500){fpsEl.textContent=`${Math.round(fc*1000/(now-ft))} FPS`;fc=0;ft=now}requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
main().catch(err=>{console.error(err);fallback.style.display='grid';loading.style.display='none';fallback.innerHTML=`<div><h2>Renderer error</h2><p style="max-width:80vw;word-break:break-word">${String(err.message||err)}</p></div>`});