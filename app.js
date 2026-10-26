// shared by index.html (home) and learn.html (sections)
const D=window.DATA||{ui:{},chars:{}},SEC=window.SECTIONS||{};
let lang='gu';try{lang=localStorage.getItem('abcd-lang')||'gu'}catch(e){}
if(!['gu','hi','en'].includes(lang))lang='gu';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const tr=o=>o&&(o[lang]||o.gu);
const W={
 title:{gu:'સનાતન ધર્મ શીખો',hi:'सनातन धर्म सीखो',en:'Learn Sanatan Dharma'},
 sub:{gu:'ચિત્ર, વાર્તા અને અવાજ સાથે',hi:'चित्र, कहानी और आवाज़ के साथ',en:'With pictures, stories and voice'},
 home:{gu:'સનાતન શીખો',hi:'सनातन सीखो',en:'Learn Sanatan'},
 'akshar-gu':{gu:'ગુજરાતી અક્ષર',hi:'गुजराती अक्षर',en:'Gujarati Letters'},
 'akshar-hi':{gu:'હિન્દી અક્ષર',hi:'हिन्दी अक्षर',en:'Hindi Letters'},
 numbers:{gu:'ગણતરી',hi:'गिनती',en:'Numbers'},
 deities:{gu:'દેવી-દેવતા',hi:'देवी-देवता',en:'Gods & Goddesses'},
 avatars:{gu:'દશાવતાર',hi:'दशावतार',en:'Dashavatar'},
 abcd:{gu:'સનાતન A to Z',hi:'सनातन A to Z',en:'Sanatan A to Z'},
 sanskrit:{gu:'સંસ્કૃત',hi:'संस्कृत',en:'Sanskrit'},
 soon:{gu:'જલ્દી આવે છે',hi:'जल्द आ रहा है',en:'Coming soon'},
 vowels:{gu:'સ્વર',hi:'स्वर',en:'Vowels'},cons:{gu:'વ્યંજન',hi:'व्यंजन',en:'Consonants'},
 listen:{gu:'🔊 સાંભળો',hi:'🔊 सुनो',en:'🔊 Listen'},pause:{gu:'⏸ રોકો',hi:'⏸ रोको',en:'⏸ Stop'},
 close:{gu:'✕ બંધ',hi:'✕ बंद',en:'✕ Close'},install:{gu:'📲 એપ ઉમેરો',hi:'📲 ऐप जोड़ो',en:'📲 Add app'},
 mantra:{gu:'મંત્ર',hi:'मंत्र',en:'Mantra'},vahan:{gu:'વાહન',hi:'वाहन',en:'Vehicle'},loves:{gu:'પ્રિય',hi:'प्रिय',en:'Loves'},
 yuga:{gu:'યુગ',hi:'युग',en:'Yuga'},form:{gu:'રૂપ',hi:'रूप',en:'Form'},stands:{gu:'અર્થ',hi:'अर्थ',en:'Meaning'},
 order:{gu:'અવતાર',hi:'अवतार',en:'Avatar'},
};
const t=k=>tr(W[k])||k;
const nameOf=id=>{const c=D.chars[id];return c?tr(c.names):id};
const LB={gu:'ગુ',hi:'हि',en:'EN'};
const VOICE={gu:'gu-IN',hi:'hi-IN',en:'en-IN'};
(function sky(){const s=$('#stars');if(s)s.innerHTML=[...Array(50)].map(()=>`<i style="left:${Math.random()*100}%;top:${Math.random()*100}%;--s:${1+Math.random()*3}px;--d:${1.5+Math.random()*3}s"></i>`).join('')})();
function setLang(next){lang=next;try{localStorage.setItem('abcd-lang',lang)}catch(e){}document.documentElement.lang=lang;const l=$('#langlbl');if(l)l.textContent=LB[lang]}
function cycleLang(){setLang(lang==='gu'?'hi':lang==='hi'?'en':'gu')}
// voice: recorded file if it exists, else the device voice, else wait a reading time so pictures still move on
const _a=new Audio();_a.preload='none';let _run=0,_timer=null;
function stopSpeak(){_run++;clearTimeout(_timer);_a.pause();if('speechSynthesis'in window)speechSynthesis.cancel()}
function speak(file,text,next){
  const run=++_run,go=()=>{if(run===_run)next&&next()};
  _a.onended=go;
  _a.onerror=()=>{if(run!==_run)return;
    const v='speechSynthesis'in window&&speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith(lang));
    if(v){const u=new SpeechSynthesisUtterance(text);u.voice=v;u.lang=VOICE[lang];u.rate=.85;u.onend=u.onerror=go;speechSynthesis.speak(u)}
    else _timer=setTimeout(go,Math.min(14000,1800+text.length*60))};
  _a.src=file;_a.play().catch(e=>{if(run!==_run)return;if(e&&e.name==='NotAllowedError'){stopSpeak();return}if(_a.error)return;go()});
}
if('serviceWorker'in navigator&&location.protocol!=='file:')addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
let dip=null;addEventListener('beforeinstallprompt',e=>{e.preventDefault();dip=e;const b=$('#install');if(b)b.style.display='inline-flex'});
