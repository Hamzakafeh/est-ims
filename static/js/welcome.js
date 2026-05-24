const canvas=document.getElementById('noiseCanvas');
const ctx2=canvas.getContext('2d');
canvas.width=window.innerWidth||680; canvas.height=window.innerHeight||800;
function drawNoise(){const id=ctx2.createImageData(canvas.width,canvas.height);for(let i=0;i<id.data.length;i+=4){const v=Math.random()*255|0;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=255;}ctx2.putImageData(id,0,0);setTimeout(drawNoise,80);}
drawNoise();

function scatterTitle(){
  const chars=document.querySelectorAll('.char');
  chars.forEach(c=>{const rx=(Math.random()-0.5)*60;const ry=(Math.random()-0.5)*60;c.style.transform=`translate(${rx}px,${ry}px) rotate(${(Math.random()-0.5)*40}deg)`;c.style.color=`hsl(${Math.random()*360},70%,70%)`;setTimeout(()=>{c.style.transform='';c.style.color='';},600);});
}
document.querySelectorAll('.char').forEach(c=>{
  c.addEventListener('mouseover',()=>{c.style.transform=`translateY(${(Math.random()-0.5)*20}px) rotate(${(Math.random()-0.5)*30}deg)`;c.style.color='#f0f0f0';});
  c.addEventListener('mouseleave',()=>{c.style.transform='';c.style.color='';});
});

const scrambleWords=['خارج الخدمة','تحت التشغيل','قيد الإصلاح','غير متاح','يرجى الانتظار','نعود قريباً'];
let swIdx=0;
const letters='ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
function triggerScramble(){
  swIdx=(swIdx+1)%scrambleWords.length;
  const target=scrambleWords[swIdx];
  const el=document.getElementById('wordScramble');
  let iter=0;
  const iv=setInterval(()=>{el.textContent=target.split('').map((c,i)=>i<iter?c:letters[Math.floor(Math.random()*letters.length)]).join('');iter+=0.5;if(iter>target.length){clearInterval(iv);el.textContent=target;}},40);
}

const glitchMessages=['كل شيء تحت السيطرة.<br><span>تقريباً.</span>','الكود يعمل.<br><span>أحياناً.</span>','لم نحذف قاعدة البيانات.<br><span>عمداً.</span>','الخادم بخير.<br><span>نظنّ ذلك.</span>','نحن نعمل على تحسين تجربتك.<br><span>يرجى العودة لاحقاً.</span>','الخطأ ليس خطأنا.<br><span>ربما.</span>','جميع الأنظمة تعمل.<br><span>عدا هذا الموقع.</span>'];
let gmIdx=0;
setInterval(()=>{gmIdx=(gmIdx+1)%glitchMessages.length;const el=document.getElementById('glitchText');el.style.opacity=0;setTimeout(()=>{el.innerHTML=glitchMessages[gmIdx];el.style.opacity=1;},200);el.style.transition='opacity 0.2s';},3500);

const v1opts=['إعادة بناء','متوقف','يعيد التشغيل','في حالة ذعر','يتأمل','نائم','يبكي'];
const v2opts=['منذ 00:00','منذ أمس','منذ أسبوع','لا يوجد','يحاول...','فشل','لن يحدث'];
const v3opts=['لا شيء','منخفض','متوسط','مرتفع','حرج','كارثي','ما فوق الكارثي'];
const v4opts=['غير معروف','أحمد','الخادم','القطة','لا أحد','الجميع','أنت'];
const vOpts={v1:v1opts,v2:v2opts,v3:v3opts,v4:v4opts};
function randomizeVal(id){const opts=vOpts[id];const el=document.getElementById(id);let i=0;const iv=setInterval(()=>{el.textContent=opts[Math.floor(Math.random()*opts.length)];if(++i>8)clearInterval(iv);},60);}

const bigNums=['404','500','418','301','503','200','403','502','410','451'];
let bnIdx=0;
function cycleBigNum(){bnIdx=(bnIdx+1)%bigNums.length;const el=document.getElementById('bigNum');el.style.opacity=0;setTimeout(()=>{el.textContent=bigNums[bnIdx];el.style.opacity=1;},150);}

const morseDecoded=['·· ·−· −−· ·· ·−·· ·−','I R G I L A','إرجع لاحقاً','·· ·−· −−· ·· ·−·· ·−'];
let morseIdx=0;
function decodeMorse(){morseIdx=(morseIdx+1)%morseDecoded.length;const el=document.getElementById('decodeArea');el.style.color=morseIdx===2?'#f0f0f0':'#333';el.textContent=morseDecoded[morseIdx];}

let flipped=false;
function flipPage(){const s=document.querySelector('.scene');s.style.transition='transform 0.6s';flipped=!flipped;s.style.transform=flipped?'scaleX(-1)':'scaleX(1)';}

function runAway(btn){
  const root=document.getElementById('mmRoot');
  const maxX=Math.min((root.offsetWidth||580)-150,460);
  const nx=Math.max(20,Math.random()*maxX);
  const ny=Math.max(20,Math.random()*400+200);
  btn.style.position='fixed';
  btn.style.left=nx+'px';
  btn.style.top=ny+'px';
  btn.style.zIndex=999;
  btn.textContent='لا!';
}

let inverted=false;
function invertAll(){inverted=!inverted;document.getElementById('mmRoot').style.filter=inverted?'invert(1)':'invert(0)';}

// اعترافات المطور
const confessions=[
  'لم أختبر الكود قبل الرفع على الـ Production.',
  'كتبت "TODO: fix this later" منذ 3 سنوات.',
  'الباسوورد كان "123456". للخادم.',
  'حذفت جدول قاعدة البيانات بالخطأ.',
  'الـ CSS كله !important.',
  'نسخت الكود من Stack Overflow وما فهمته.',
  'آخر commit message كان "fix stuff".',
  'الـ logs مليانة أخطاء لكن تجاهلتها.',
  'جربت إطفاء وتشغيل الخادم 17 مرة.',
  'دمرت الـ git history بالكامل.',
];
let confIdx=0;
function nextConfession(){confIdx=(confIdx+1)%confessions.length;const el=document.getElementById('confessMsg');el.style.opacity=0;setTimeout(()=>{el.textContent=confessions[confIdx];el.style.opacity=1;},150);}

// شريط تقدم وهمي
const progressStates={p1:0,p2:0,p3:0};
function fakeProgress(id,wrap){
  const el=document.getElementById(id);
  const vEl=document.getElementById(id+'val');
  const cur=progressStates[id];
  let next;
  if(cur>=100){next=Math.floor(Math.random()*30);} 
  else{next=Math.min(100,cur+Math.floor(Math.random()*40)+10);}
  progressStates[id]=next;
  el.style.width=next+'%';
  vEl.textContent=next+'%';
  if(next===100){setTimeout(()=>{progressStates[id]=0;el.style.width='0%';vEl.textContent='0%';},2000);}
}

// عداد النقرات
let clickCount=0;
const clickTaunts=['كل مرة تضغط تتأخر أكثر','جرّب مرة ثانية، ربما يفيد','أنت ما زلت تضغط؟','المطور يراك ويضحك','الخادم يتعمد الانتظار'];
function bumpCounter(){
  clickCount++;
  document.getElementById('clickCounter').textContent=clickCount;
  const t=clickTaunts[Math.min(Math.floor(clickCount/3),clickTaunts.length-1)];
  document.getElementById('clickTaunt').textContent=t;
}

// اقتباسات
const quotes=[
  {q:'البرنامج لا يعطل. الناس هم اللي يعطلون.',s:'— مجهول، الساعة 3 صباحاً'},
  {q:'كل بق هو في الأصل فيتشر لم يُوثَّق بعد.',s:'— مطور دفاعي'},
  {q:'إذا كان يعمل، لا تلمسه.',s:'— حكمة الـ Production'},
  {q:'الـ deadline كان أمس.',s:'— العميل دائماً'},
  {q:'يعمل عندي على الـ localhost.',s:'— آخر كلمات المطور'},
  {q:'لا يوجد كود جميل، فقط كود يعمل.',s:'— واقعي صادق'},
  {q:'الكومنت الوحيد في الكود كان "لا أعرف لماذا يعمل هذا".',s:'— الـ pull request رقم 847'},
];
let qIdx=0;
function nextQuote(){qIdx=(qIdx+1)%quotes.length;const el=document.getElementById('quoteText');const se=document.getElementById('quoteSource');el.style.opacity=0;setTimeout(()=>{el.textContent=quotes[qIdx].q;se.textContent=quotes[qIdx].s;el.style.opacity=1;},200);}

// شبكة خلايا
const gridWords=['ERROR','خطأ','500','NULL','⚡','BUG','???','VOID','NaN','☠','HALT','لأ'];
const grid=document.getElementById('gridGlitch');
for(let i=0;i<12;i++){
  const cell=document.createElement('div');
  cell.className='grid-cell';
  cell.textContent=gridWords[i%gridWords.length];
  cell.onclick=function(){this.classList.toggle('active');setTimeout(()=>this.classList.remove('active'),600);};
  grid.appendChild(cell);
}
setInterval(()=>{const cells=document.querySelectorAll('.grid-cell');const idx=Math.floor(Math.random()*cells.length);cells[idx].classList.add('active');setTimeout(()=>cells[idx].classList.remove('active'),300);},900);

// كتابة وهمية
const typeMessages=['جاري البحث عن المشكلة...','وجدناها. في مكان آخر.','يتم إلقاء اللوم على النظام...','النظام يرفض الاتهام.','إعادة المحاولة للمرة الـ 99...'];
let tmIdx=0;
let typeInterval=null;
function startTypewriter(){
  clearTimeout(typeInterval);
  const el=document.getElementById('typewriterText');
  const msg=typeMessages[tmIdx%typeMessages.length];
  tmIdx++;
  let i=0;
  el.textContent='';
  function type(){if(i<msg.length){el.textContent+=msg[i];i++;setTimeout(type,80);}else{typeInterval=setTimeout(startTypewriter,2200);}}
  type();
}
startTypewriter();

// بيانات ثنائية
const binaryMessages=['01001001 01010010 01000111 01001001 01001100 01000001','ERROR 0x0000 0x1337 0xDEAD 0xBEEF 0xCAFE','10110100 11001010 01110011 00110001 00101110','إرجع لاحقاً — ASCII 101011 1001011','NULL NULL NULL NaN Infinity -Infinity'];
let binIdx=0;
function glitchBinary(){binIdx=(binIdx+1)%binaryMessages.length;const el=document.getElementById('binaryStream');el.style.opacity=0;setTimeout(()=>{el.textContent=binaryMessages[binIdx];el.style.opacity=1;},120);}
