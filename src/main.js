const canvas=document.querySelector('#gfx'),loading=document.querySelector('#loading'),progress=document.querySelector('#progress'),fallback=document.querySelector('#fallback'),fpsEl=document.querySelector('#fps');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const blockers=[[-13.4,-1.15,-2.2,-7.45],[0.0,12.3,-10.3,-4.25],[11.5,18.7,-4.9,-0.4],[0.2,17.4,4.8,11.5]];
function blocked(x,z){return blockers.some(b=>x>b[0]-0.38&&x<b[1]+0.38&&z>b[2]-0.38&&z<b[3]+0.38)}
async function main(){
 progress.style.width='10%';if(!navigator.gpu){fallback.style.display='grid';loading.style.display='none';return}
 const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw Error('No WebGPU adapter');const device=await adapter.requestDevice();progress.style.width='28%';
 const ctx=canvas.getContext('webgpu'),format=navigator.gpu.getPreferredCanvasFormat();ctx.configure({device,format,alphaMode:'opaque'});
 const U=device.createBuffer({size:128,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
 const code=`
struct U{res:vec4<f32>,cam:vec4<f32>,ang:vec4<f32>,misc:vec4<f32>};@group(0)@binding(0)var<uniform>u:U;
struct O{@builtin(position)p:vec4<f32>,@location(0)uv:vec2<f32>};
@vertex fn vs(@builtin(vertex_index)i:u32)->O{var o:O;let p=array<vec2<f32>,3>(vec2<f32>(-1.0,-1.0),vec2<f32>(3.0,-1.0),vec2<f32>(-1.0,3.0));o.p=vec4<f32>(p[i],0.0,1.0);o.uv=p[i];return o;}
fn h31(p:vec3<f32>)->f32{var q=fract(p*vec3<f32>(0.1031,0.11369,0.13787));q+=vec3<f32>(dot(q,q.yzx+vec3<f32>(19.19)));return fract((q.x+q.y)*q.z);}
fn n3(p:vec3<f32>)->f32{let i=floor(p),f=fract(p),w=f*f*(3.0-2.0*f);return mix(mix(mix(h31(i),h31(i+vec3<f32>(1,0,0)),w.x),mix(h31(i+vec3<f32>(0,1,0)),h31(i+vec3<f32>(1,1,0)),w.x),w.y),mix(mix(h31(i+vec3<f32>(0,0,1)),h31(i+vec3<f32>(1,0,1)),w.x),mix(h31(i+vec3<f32>(0,1,1)),h31(i+vec3<f32>(1,1,1)),w.x),w.y),w.z);}
fn fbm(p0:vec3<f32>)->f32{var p=p0;var a=0.5;var f=0.0;for(var i=0;i<4;i++){f+=n3(p)*a;p=p*2.03+vec3<f32>(7.1,3.7,5.9);a*=0.5;}return f;}
fn boxD(p:vec3<f32>,b:vec3<f32>)->f32{let q=abs(p)-b;return length(max(q,vec3<f32>(0.0)))+min(max(q.x,max(q.y,q.z)),0.0);}
fn rbox(p:vec3<f32>,b:vec3<f32>,r:f32)->f32{return boxD(p,b)-r;}
fn cylD(p:vec3<f32>,r:f32,h:f32)->f32{let d=abs(vec2<f32>(length(p.xz),p.y))-vec2<f32>(r,h);return min(max(d.x,d.y),0.0)+length(max(d,vec2<f32>(0.0)));}
fn rotY(p:vec3<f32>,a:f32)->vec3<f32>{let c=cos(a),s=sin(a);return vec3<f32>(c*p.x-s*p.z,p.y,s*p.x+c*p.z);}
fn op(m:vec2<f32>,d:f32,id:f32)->vec2<f32>{if(d<m.x){return vec2<f32>(d,id);}return m;}
fn bx(m:vec2<f32>,p:vec3<f32>,c:vec3<f32>,b:vec3<f32>,id:f32)->vec2<f32>{return op(m,boxD(p-c,b),id);}
fn rb(m:vec2<f32>,p:vec3<f32>,c:vec3<f32>,b:vec3<f32>,r:f32,id:f32)->vec2<f32>{return op(m,rbox(p-c,b,r),id);}
fn scene(p:vec3<f32>)->vec2<f32>{
 var m=vec2<f32>(p.y,1.0);
 m=bx(m,p,vec3<f32>(-7.8,2.75,-4.3),vec3<f32>(5.6,2.75,3.15),2.0);
 m=bx(m,p,vec3<f32>(-10.8,5.7,-5.35),vec3<f32>(2.5,0.35,2.1),2.0);
 m=bx(m,p,vec3<f32>(6.4,2.2,-7.3),vec3<f32>(5.9,2.2,3.0),2.0);
 m=bx(m,p,vec3<f32>(8.7,4.55,-7.7),vec3<f32>(3.5,0.2,2.2),2.0);
 m=bx(m,p,vec3<f32>(2.8,1.55,-3.6),vec3<f32>(2.9,1.55,1.8),2.0);
 m=bx(m,p,vec3<f32>(15.1,1.3,-2.65),vec3<f32>(3.6,1.3,2.25),2.0);
 m=bx(m,p,vec3<f32>(-9.2,4.15,-1.11),vec3<f32>(0.72,1.05,0.06),4.0);m=bx(m,p,vec3<f32>(-10.23,4.15,-1.05),vec3<f32>(0.28,1.05,0.07),5.0);m=bx(m,p,vec3<f32>(-8.17,4.15,-1.05),vec3<f32>(0.28,1.05,0.07),5.0);
 m=bx(m,p,vec3<f32>(-5.7,3.45,-1.11),vec3<f32>(0.72,1.18,0.06),4.0);m=bx(m,p,vec3<f32>(-6.72,3.45,-1.05),vec3<f32>(0.28,1.18,0.07),5.0);m=bx(m,p,vec3<f32>(-4.68,3.45,-1.05),vec3<f32>(0.28,1.18,0.07),5.0);
 m=bx(m,p,vec3<f32>(-8.5,1.55,-1.11),vec3<f32>(1.45,0.72,0.06),4.0);m=bx(m,p,vec3<f32>(-10.27,1.55,-1.05),vec3<f32>(0.28,0.72,0.07),5.0);m=bx(m,p,vec3<f32>(-6.73,1.55,-1.05),vec3<f32>(0.28,0.72,0.07),5.0);
 for(var k=0;k<3;k++){let x=array<f32,3>(4.2,8.1,11.0)[k];m=bx(m,p,vec3<f32>(x,3.2,-4.25),vec3<f32>(0.32,0.86,0.06),5.0);}
 m=bx(m,p,vec3<f32>(-8.5,2.47,-1.02),vec3<f32>(1.8,0.09,0.18),6.0);m=bx(m,p,vec3<f32>(-9.2,5.27,-1.02),vec3<f32>(0.92,0.09,0.18),6.0);
 m=bx(m,p,vec3<f32>(15.1,2.72,-2.65),vec3<f32>(3.8,0.14,2.42),6.0);
 m=bx(m,p,vec3<f32>(12.0,4.7,-7.7),vec3<f32>(0.36,2.05,0.36),2.0);m=op(m,cylD(p-vec3<f32>(8.8,5.3,-6.3),0.34,1.2),8.0);
 m=bx(m,p,vec3<f32>(8.8,0.03,4.62),vec3<f32>(9.0,0.12,0.22),3.0);m=bx(m,p,vec3<f32>(8.8,0.03,11.58),vec3<f32>(9.0,0.12,0.22),3.0);m=bx(m,p,vec3<f32>(-0.02,0.03,8.1),vec3<f32>(0.22,0.12,3.5),3.0);m=bx(m,p,vec3<f32>(17.62,0.03,8.1),vec3<f32>(0.22,0.12,3.5),3.0);
 m=bx(m,p,vec3<f32>(8.8,0.055,8.1),vec3<f32>(8.6,0.035,3.25),7.0);
 m=rb(m,p,vec3<f32>(5.4,0.72,-2.2),vec3<f32>(0.8,0.45,0.42),0.06,8.0);m=bx(m,p,vec3<f32>(15.2,0.8,-0.45),vec3<f32>(1.6,0.08,0.36),4.0);
 for(var j=0;j<3;j++){let x=-5.6+f32(j)*1.8;m=rb(m,p,vec3<f32>(x,0.31,3.4-f32(j)*0.2),vec3<f32>(0.58,0.09,1.35),0.08,9.0);}
 for(var j=0;j<3;j++){let x=-5.7+f32(j)*1.8; m=rb(m,p,vec3<f32>(x,1.02,3.3-f32(j)*0.15),vec3<f32>(0.28,0.42,0.19),0.12,10.0);m=op(m,length(p-vec3<f32>(x,1.58,3.25-f32(j)*0.15))-0.2,11.0);}
 m=op(m,cylD(p-vec3<f32>(-12.2,3.4,2.3),0.42,3.4),12.0);
 for(var j=0;j<7;j++){let a=f32(j)*0.897;let c=vec3<f32>(-12.2+cos(a)*1.3,7.25+sin(a*1.7)*0.35,2.3+sin(a)*1.3);m=op(m,length(p-c)-1.25,13.0);}
 for(var j=0;j<6;j++){let x=array<f32,6>(-10.0,-4.0,1.0,7.0,12.0,15.0)[j];let z=array<f32,6>(-11.0,-10.0,-10.0,-11.0,-10.0,-8.0)[j];m=op(m,cylD(p-vec3<f32>(x,2.0,z),0.28,2.0),12.0);m=op(m,length(p-vec3<f32>(x,5.2,z))-2.0,13.0);}
 return m;
}
fn normal(p:vec3<f32>)->vec3<f32>{let e=0.003;let d=scene(p).x;return normalize(vec3<f32>(scene(p+vec3<f32>(e,0,0)).x-d,scene(p+vec3<f32>(0,e,0)).x-d,scene(p+vec3<f32>(0,0,e)).x-d));}
fn shad(ro:vec3<f32>,rd:vec3<f32>)->f32{var t=0.03;var r=1.0;for(var i=0;i<28;i++){let h=scene(ro+rd*t).x;if(h<0.002){return 0.12;}r=min(r,12.0*h/t);t+=clamp(h,0.02,0.55);if(t>35.0){break;}}return clamp(r,0.12,1.0);}
fn ao(p:vec3<f32>,n:vec3<f32>)->f32{var a=0.0;var w=1.0;for(var i=1;i<=5;i++){let h=0.08*f32(i);a+=(h-scene(p+n*h).x)*w;w*=0.55;}return clamp(1.0-a*2.2,0.15,1.0);}
fn sky(rd:vec3<f32>)->vec3<f32>{let t=clamp(rd.y*0.5+0.5,0.0,1.0);var c=mix(vec3<f32>(0.72,0.83,0.92),vec3<f32>(0.11,0.34,0.66),vec3<f32>(t));let sd=normalize(vec3<f32>(-0.55,0.78,0.28));let s=pow(max(dot(rd,sd),0.0),650.0);c+=vec3<f32>(1.3,0.95,0.62)*s*2.3;let cp=rd/max(rd.y+0.18,0.08);let q=vec3<f32>(cp.x*0.17+u.misc.x*0.002,2.0,cp.z*0.17);let cl=smoothstep(0.55,0.76,fbm(q))*(1.0-smoothstep(0.78,1.0,rd.y));return mix(c,vec3<f32>(0.95,0.96,0.97),vec3<f32>(cl*0.6));}
fn matcol(id:f32,p:vec3<f32>)->vec3<f32>{let d=fbm(p*3.0)*0.14+fbm(p*18.0)*0.05;if(id<1.5){return vec3<f32>(0.24,0.32,0.11)*(1.0+d);}if(id<2.5){return vec3<f32>(0.82,0.80,0.70)*(1.0+d);}if(id<3.5){return vec3<f32>(0.58,0.51,0.39)*(1.0+d);}if(id<4.5){return vec3<f32>(0.22,0.11,0.045)*(1.0+d);}if(id<5.5){return vec3<f32>(0.055,0.16,0.075)*(1.0+d);}if(id<6.5){return vec3<f32>(0.55,0.26,0.085)*(1.0+d);}if(id<7.5){return vec3<f32>(0.025,0.22,0.32);}if(id<8.5){return vec3<f32>(0.26,0.28,0.29);}if(id<9.5){return vec3<f32>(0.12,0.24,0.40);}if(id<10.5){return vec3<f32>(0.045,0.055,0.06);}if(id<11.5){return vec3<f32>(0.42,0.25,0.16);}if(id<12.5){return vec3<f32>(0.27,0.16,0.07)*(1.0+d);}return vec3<f32>(0.11,0.22,0.065)*(1.0+d);}
fn aces(x:vec3<f32>)->vec3<f32>{return clamp((x*(2.51*x+vec3<f32>(0.03)))/(x*(2.43*x+vec3<f32>(0.59))+vec3<f32>(0.14)),vec3<f32>(0.0),vec3<f32>(1.0));}
@fragment fn fs(i:O)->@location(0)vec4<f32>{
 let frag=(i.p.xy/u.res.xy)*2.0-vec2<f32>(1.0);let asp=u.res.x/u.res.y;let q=vec2<f32>(frag.x*asp,-frag.y);let yaw=u.ang.x,pitch=u.ang.y;let f=normalize(vec3<f32>(sin(yaw)*cos(pitch),sin(pitch),cos(yaw)*cos(pitch)));let r=normalize(cross(f,vec3<f32>(0.0,1.0,0.0)));let up=cross(r,f);let rd=normalize(f+r*q.x*0.82+up*q.y*0.82);let ro=u.cam.xyz;
 var t=0.0;var hit=vec2<f32>(-1.0,0.0);for(var s=0;s<105;s++){let p=ro+rd*t;let d=scene(p);if(d.x<0.0025){hit=d;break;}t+=d.x*0.78;if(t>90.0){break;}}
 var col=sky(rd);if(hit.x>=0.0){let p=ro+rd*t;let n=normal(p);let id=hit.y;let sun=normalize(vec3<f32>(-0.55,0.78,0.28));let V=-rd;let Ndot=max(dot(n,sun),0.0);let S=shad(p+n*0.015,sun);let A=ao(p,n);var al=matcol(id,p);if(id>6.5&&id<7.5){let fres=0.04+0.96*pow(1.0-max(dot(n,V),0.0),5.0);let refl=sky(reflect(rd,n));al=mix(vec3<f32>(0.01,0.18,0.27),refl,vec3<f32>(fres));let gl=pow(max(dot(reflect(-sun,n),V),0.0),180.0);al+=vec3<f32>(gl*1.8);}let H=normalize(sun+V);let rough=select(0.82,0.25,id>7.4&&id<8.6);let spec=pow(max(dot(n,H),0.0),mix(80.0,10.0,rough))*(1.0-rough);col=al*(0.22*A+1.25*Ndot*S)+vec3<f32>(spec*S*0.8);let fog=1.0-exp(-t*0.018);col=mix(col,sky(rd),vec3<f32>(fog*0.55));}
 col=aces(col*1.15);let vig=1.0-smoothstep(0.72,1.35,dot(frag,frag));col*=mix(0.91,1.0,vig);let grain=(h31(vec3<f32>(i.p.xy,u.misc.x))-0.5)*0.012;col+=vec3<f32>(grain);return vec4<f32>(pow(max(col,vec3<f32>(0.0)),vec3<f32>(1.0/2.2)),1.0);
}`;
 const mod=device.createShaderModule({code});const pipe=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:mod,entryPoint:'vs'},fragment:{module:mod,entryPoint:'fs',targets:[{format}]},primitive:{topology:'triangle-list'}});const bg=device.createBindGroup({layout:pipe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}}]});progress.style.width='72%';
 const cam={p:[-1.0,1.72,12.5],yaw:Math.PI,pitch:-0.06,vy:0,g:true};const keys=new Set();addEventListener('keydown',e=>keys.add(e.code));addEventListener('keyup',e=>keys.delete(e.code));canvas.addEventListener('click',()=>canvas.requestPointerLock?.());document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){cam.yaw-=e.movementX*0.0021;cam.pitch=clamp(cam.pitch-e.movementY*0.0019,-1.42,1.42)}});
 let mt=[0,0],run=false,sid=null,lid=null,ll=[0,0];const stick=document.querySelector('#moveStick'),nub=stick.querySelector('.nub');function sm(x,y){let r=stick.getBoundingClientRect(),dx=x-r.left-59,dy=y-r.top-59,l=Math.hypot(dx,dy);if(l>42){dx*=42/l;dy*=42/l}nub.style.transform=`translate(${dx}px,${dy}px)`;mt=[dx/42,dy/42]};stick.addEventListener('pointerdown',e=>{sid=e.pointerId;stick.setPointerCapture(sid);sm(e.clientX,e.clientY)});stick.addEventListener('pointermove',e=>{if(e.pointerId===sid)sm(e.clientX,e.clientY)});stick.addEventListener('pointerup',e=>{if(e.pointerId===sid){sid=null;mt=[0,0];nub.style.transform=''}});const look=document.querySelector('#lookZone');look.addEventListener('pointerdown',e=>{lid=e.pointerId;ll=[e.clientX,e.clientY];look.setPointerCapture(lid)});look.addEventListener('pointermove',e=>{if(e.pointerId===lid){cam.yaw-=(e.clientX-ll[0])*0.0048;cam.pitch=clamp(cam.pitch-(e.clientY-ll[1])*0.0042,-1.4,1.4);ll=[e.clientX,e.clientY]}});look.addEventListener('pointerup',e=>{if(e.pointerId===lid)lid=null});document.querySelector('#runBtn').addEventListener('pointerdown',()=>run=true);document.querySelector('#runBtn').addEventListener('pointerup',()=>run=false);document.querySelector('#jumpBtn').addEventListener('pointerdown',()=>{if(cam.g){cam.vy=5.0;cam.g=false}});
 function resize(){let d=Math.min(devicePixelRatio||1,1.2),w=Math.max(1,Math.floor(innerWidth*d)),h=Math.max(1,Math.floor(innerHeight*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}}resize();addEventListener('resize',resize);progress.style.width='100%';setTimeout(()=>loading.classList.add('done'),180);setTimeout(()=>loading.remove(),800);
 let last=performance.now(),ft=last,fc=0;function frame(now){let dt=Math.min(0.033,(now-last)/1000);last=now;let F=[Math.sin(cam.yaw),0,Math.cos(cam.yaw)],R=[Math.cos(cam.yaw),0,-Math.sin(cam.yaw)],x=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+mt[0],z=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-mt[1],l=Math.hypot(x,z);if(l>1){x/=l;z/=l}let sp=(keys.has('ShiftLeft')||run)?6.5:3.6,nx=cam.p[0]+(R[0]*x+F[0]*z)*sp*dt,nz=cam.p[2]+(R[2]*x+F[2]*z)*sp*dt;if(!blocked(nx,cam.p[2]))cam.p[0]=nx;if(!blocked(cam.p[0],nz))cam.p[2]=nz;if(keys.has('Space')&&cam.g){cam.vy=5.0;cam.g=false}cam.vy-=11.0*dt;cam.p[1]+=cam.vy*dt;if(cam.p[1]<1.72){cam.p[1]=1.72;cam.vy=0;cam.g=true}resize();let data=new Float32Array(32);data.set([canvas.width,canvas.height,1/canvas.width,1/canvas.height],0);data.set([...cam.p,1],4);data.set([cam.yaw,cam.pitch,0,0],8);data.set([now/1000,0,0,0],12);device.queue.writeBuffer(U,0,data);let enc=device.createCommandEncoder(),pass=enc.beginRenderPass({colorAttachments:[{view:ctx.getCurrentTexture().createView(),clearValue:{r:0.1,g:0.2,b:0.35,a:1},loadOp:'clear',storeOp:'store'}]});pass.setPipeline(pipe);pass.setBindGroup(0,bg);pass.draw(3);pass.end();device.queue.submit([enc.finish()]);fc++;if(now-ft>500){fpsEl.textContent=`${Math.round(fc*1000/(now-ft))} FPS`;fc=0;ft=now}requestAnimationFrame(frame)}requestAnimationFrame(frame);
}
main().catch(e=>{console.error(e);fallback.style.display='grid';loading.style.display='none';fallback.querySelector('p').textContent=e.message});
