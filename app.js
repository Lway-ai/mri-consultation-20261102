'use strict';
const $=id=>document.getElementById(id), canvas=$('canvas'), ctx=canvas.getContext('2d');
let manifest=[], cache=new Map(), key, current=null, seriesIndex=0, frameIndex=0, timer=null, invert=false, zoom=1, dx=0,dy=0, ticket=0;
const status=text=>{$('status').textContent=text;$('status').hidden=!text};
function stop(){clearInterval(timer);timer=null;$('play').textContent='▶ 自动播放'}
function transform(){canvas.style.transform=`translate(${dx}px,${dy}px) scale(${zoom})`;$('zoomText').textContent=Math.round(zoom*100)+'%'}
function render(){
 if(!current)return;
 const f=current.frames[frameIndex], a=current.pixels[frameIndex];
 canvas.hidden=!!f.missing;status(f.missing?'原始 DICOM 数据不完整：此幅无法解码，请向医院补取。':'');
 const wc=Number($('wc').value),ww=Math.max(1,Number($('ww').value));
 canvas.width=f.cols;canvas.height=f.rows;const im=ctx.createImageData(f.cols,f.rows);
 for(let j=0;j<a.length;j++){let x=a[j]*f.slope+f.intercept;
 let v=ww<=1?(x>wc-.5?255:0):Math.round(Math.max(0,Math.min(1,(x-(wc-.5))/(ww-1)+.5))*255);
 if(invert)v=255-v;im.data[j*4]=im.data[j*4+1]=im.data[j*4+2]=v;im.data[j*4+3]=255;}
 ctx.putImageData(im,0,0);$('slice').value=frameIndex;$('counter').textContent=`${frameIndex+1} / ${current.frames.length}`;
 $('details').textContent=`${f.cols} × ${f.rows} · 16 bit\n窗位 ${wc} / 窗宽 ${ww}\n层面位置 ${f.location.toFixed(2)} mm`;
 $('orientation').textContent=f.orientation.length?'DICOM 方向余弦：'+f.orientation.map(x=>x.toFixed(2)).join(', '):'原始像素方向';
 transform();
}
function move(n){if(!current)return;frameIndex=(frameIndex+n+current.frames.length)%current.frames.length;render()}
function reset(){if(!current)return;const f=current.frames[frameIndex];$('wc').value=f.wc;$('ww').value=f.ww;invert=false;zoom=1;dx=dy=0;$('zoom').value=100;render()}
async function loadSeries(i){
 stop();const request=++ticket;seriesIndex=i;current=null;status('正在解密原始像素…');
 [...$('series').children].forEach((b,j)=>b.classList.toggle('active',j===i));
 try{
  let data=cache.get(i);
  if(!data){
   const response=await fetch('assets/'+manifest[i].file);if(!response.ok)throw Error('影像下载失败，请检查网络');
   const raw=new Uint8Array(await response.arrayBuffer());
   const compressed=await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.slice(0,12)},key,raw.slice(12));
   const plain=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
   const len=new DataView(plain).getUint32(0,true);data=JSON.parse(new TextDecoder().decode(new Uint8Array(plain,4,len)));
   let offset=4+len;data.pixels=data.frames.map(f=>{const count=f.rows*f.cols;const bytes=plain.slice(offset,offset+count*2);offset+=count*2;return new Int16Array(bytes)});
   if(offset!==plain.byteLength)throw Error('影像数据长度不符');cache.set(i,data);
  }
  if(request!==ticket)return;current=data;frameIndex=0;$('title').textContent=data.name;$('slice').max=data.frames.length-1;
  $('series').children[i].firstChild.textContent=data.name;status('');reset();
 }catch(e){if(request!==ticket)return;status('无法打开影像。请检查完整分享链接、密钥及网络。');console.error('Image load failed:',e.name)}
}
async function unlock(value){
 try{
  if(!/^[A-Za-z0-9_-]{43}$/.test(value))throw Error('密钥格式不正确');
  const bytes=Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));
  key=await crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['decrypt']);
  $('unlock').close();await loadSeries(0);
 }catch(e){$('unlockError').textContent=e.message;$('unlock').showModal()}
}
$('unlockButton').onclick=e=>{e.preventDefault();unlock($('keyInput').value.trim())};
$('prev').onclick=()=>move(-1);$('next').onclick=()=>move(1);$('slice').oninput=e=>{frameIndex=Number(e.target.value);render()};
$('play').onclick=()=>{if(timer){stop();return}if(!current)return;timer=setInterval(()=>move(1),1000/Number($('fps').value));$('play').textContent='Ⅱ 暂停'};
$('fps').onchange=()=>{if(timer){stop();$('play').click()}};
$('reset').onclick=reset;$('invert').onclick=()=>{invert=!invert;render()};
$('wc').oninput=render;$('ww').oninput=render;$('zoom').oninput=e=>{zoom=Number(e.target.value)/100;transform()};
$('viewport').addEventListener('wheel',e=>{e.preventDefault();move(e.deltaY>0?1:-1)},{passive:false});
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||$('unlock').open)return;if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft',' '].includes(e.key))e.preventDefault();if(['ArrowDown','ArrowRight'].includes(e.key))move(1);if(['ArrowUp','ArrowLeft'].includes(e.key))move(-1);if(e.key===' ')$('play').click()});
let drag=null;$('viewport').onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,dx,dy};$('viewport').setPointerCapture(e.pointerId)};
$('viewport').onpointermove=e=>{if(!drag)return;dx=drag.dx+e.clientX-drag.x;dy=drag.dy+e.clientY-drag.y;transform()};
$('viewport').onpointerup=$('viewport').onpointercancel=()=>drag=null;
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewport').requestFullscreen()}catch{status('当前浏览器不支持全屏')}};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(`${current?.name||''} · 第 ${frameIndex+1} 幅\n${$('notes').value}`);$('copyStatus').textContent='已复制'}catch{$('copyStatus').textContent='请选中文字手动复制'}};
async function init(){
 try{
  if(!window.crypto?.subtle||!window.DecompressionStream)throw Error('请使用新版 Chrome、Edge、Safari 或 Firefox，通过 HTTPS 打开');
  const r=await fetch('manifest.json');if(!r.ok)throw Error('序列清单加载失败');manifest=await r.json();
  manifest.forEach((s,i)=>{const b=document.createElement('button');b.append(document.createTextNode(s.name));const small=document.createElement('small');small.textContent=`${s.count} 幅`;b.append(small);b.onclick=()=>loadSeries(i);$('series').append(b)});
  const value=new URLSearchParams(location.hash.slice(1)).get('key');
  if(value)await unlock(value);else{status('等待解锁');$('unlock').showModal()}
 }catch(e){status(e.message)}
}
init();
