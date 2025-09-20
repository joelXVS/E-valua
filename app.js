// app.js (actualizado)

let testsList = null;
let codesList = null;
let currentTest = null;
let student = {name:'', group:''};
let answers = [];
let timerInterval = null;
let timeLeft = 0;
let startedAt = null;
let finished = false;
let visibilityTriggered = false;

// DOM helpers
const el = id => document.getElementById(id);

// elements
const startScreen = el('start-screen');
const examScreen = el('exam-screen');
const resultScreen = el('result-screen');

const btnContinue = el('btnContinue');
const btnLoadTests = el('btnLoadTests');
const availableTestsDiv = el('availableTests');

const testTitle = el('testTitle');
const metaName = el('metaName');
const metaGroup = el('metaGroup');
const timerEl = el('timer');
const questionContainer = el('questionContainer');
const prevBtn = el('prevBtn');
const nextBtn = el('nextBtn');
const finishBtn = el('finishBtn');

const resultSummary = el('resultSummary');
const detailedAnswers = el('detailedAnswers');
const downloadBtn = el('downloadBtn');
const downloadPdfBtn = el('downloadPdfBtn');
const restartBtn = el('restartBtn');

async function loadJSONFiles(){
  try{
    const [tRes, cRes] = await Promise.all([
      fetch('tests.json'),
      fetch('codes.json')
    ]);
    testsList = await tRes.json();
    codesList = await cRes.json();
  }catch(e){
    alert('Error cargando JSON. Servir los archivos con un servidor local (no file://).');
    console.error(e);
  }
}

function formatTime(s){ const mm = Math.floor(s/60).toString().padStart(2,'0'); const ss = (s%60).toString().padStart(2,'0'); return `${mm}:${ss}`;}
function nowISO(){ return new Date().toISOString(); }
function parseTimeStringToDate(tstr){ if(!tstr) return null; if(tstr.includes('T')) return new Date(tstr); const [hh,mm] = tstr.split(':').map(x=>parseInt(x)); const d = new Date(); d.setHours(hh, mm||0,0,0); return d; }

// --- mostrar pruebas disponibles
function showAvailableTests(){
  if(!testsList){ availableTestsDiv.innerHTML = '<div class="tx">No se encontraron pruebas.</div>'; return; }
  availableTestsDiv.innerHTML = '';
  testsList.tests.forEach(t=>{
    const div = document.createElement('div');
    div.className = 'tx';
    div.innerHTML = `<strong>${t.name}</strong> — Código público: <code>${t.publicCode||'N/A'}</code><br>
      Tiempo: ${t.timeMinutes} min • Preguntas: ${t.questions.length} • Horario: ${t.availableFrom||'--'} → ${t.availableTo||'--'}`;
    availableTestsDiv.appendChild(div);
  });
}

function resolveTestIdFromApplyCode(code){
  if(!codesList) return null;
  const mapping = codesList.codes.find(c=>c.applyCode === code);
  return mapping ? mapping.testId : null;
}

async function startProcess(){
  const name = el('studentName').value.trim();
  const group = el('studentGroup').value.trim();
  const applyCode = el('applyCode').value.trim();
  if(!name || !group || !applyCode){ alert('Completa nombre, grupo y código.'); return; }
  student.name = name; student.group = group;
  const testId = resolveTestIdFromApplyCode(applyCode);
  if(!testId){ alert('Código inválido.'); return; }
  const test = testsList.tests.find(t=>t.id === testId);
  if(!test){ alert('No se encontró la prueba para ese código.'); return; }
  const now = new Date();
  const from = parseTimeStringToDate(test.availableFrom);
  const to = parseTimeStringToDate(test.availableTo);
  if(from && now < from){ alert(`La prueba aún no está disponible. Disponible desde: ${from.toLocaleString()}`); return; }
  if(to && now > to){ alert(`La prueba ya cerró. Cerró: ${to.toLocaleString()}`); return; }
  currentTest = test;
  prepareExam();
}

function prepareExam(){
  answers = new Array(currentTest.questions.length).fill(null);
  startedAt = new Date();
  finished = false; visibilityTriggered = false;
  startScreen.classList.add('hidden'); resultScreen.classList.add('hidden'); examScreen.classList.remove('hidden');
  testTitle.textContent = currentTest.name; metaName.textContent = student.name; metaGroup.textContent = student.group;
  timeLeft = (currentTest.timeMinutes || 30) * 60;
  timerEl.textContent = formatTime(timeLeft);
  if(timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(tickTimer, 1000);
  renderQuestion(0);
  requestFullscreen();
  window.addEventListener('beforeunload', beforeUnloadHandler);
  window.addEventListener('contextmenu', e=>e.preventDefault());
  document.addEventListener('visibilitychange', onVisibilityChange);
}

function tickTimer(){
  if(finished) return;
  timeLeft--;
  if(timeLeft < 0) { autoSubmit('Tiempo agotado'); return; }
  timerEl.textContent = formatTime(timeLeft);
}

let currentIndex = 0;
function renderQuestion(idx){
  currentIndex = idx;
  const q = currentTest.questions[idx];
  questionContainer.innerHTML = '';
  const h = document.createElement('h3'); h.textContent = `Pregunta ${idx+1} / ${currentTest.questions.length}`;
  const qtxt = document.createElement('p'); qtxt.innerHTML = `<strong>${q.title}</strong>`;
  questionContainer.appendChild(h); questionContainer.appendChild(qtxt);

  if(q.type === 'mcq'){
    const optionsDiv = document.createElement('div'); optionsDiv.className='options';
    q.options.forEach((opt,i)=>{
      const optDiv = document.createElement('label'); optDiv.className='option';
      const radio = document.createElement('input'); radio.type='radio'; radio.name='opt'; radio.value = i;
      if(answers[idx] !== null && answers[idx].selected === i) radio.checked = true;
      optDiv.appendChild(radio); optDiv.appendChild(document.createTextNode(opt));
      optDiv.addEventListener('click', ()=> { answers[idx] = {selected: i}; Array.from(optionsDiv.children).forEach((c,j)=> c.classList.toggle('selected', j===i)); });
      optionsDiv.appendChild(optDiv);
    });
    questionContainer.appendChild(optionsDiv);
  } else if(q.type === 'tf'){
    const optionsDiv = document.createElement('div'); optionsDiv.className='options';
    ['Verdadero','Falso'].forEach((label,i)=>{
      const optDiv = document.createElement('label'); optDiv.className='option';
      const radio = document.createElement('input'); radio.type='radio'; radio.name='opt'; radio.value = i;
      if(answers[idx] && answers[idx].selected === i) radio.checked = true;
      optDiv.appendChild(radio); optDiv.appendChild(document.createTextNode(label));
      optDiv.addEventListener('click', ()=> { answers[idx] = {selected: i}; Array.from(optionsDiv.children).forEach((c,j)=> c.classList.toggle('selected', j===i)); });
      optionsDiv.appendChild(optDiv);
    });
    questionContainer.appendChild(optionsDiv);
  } else if(q.type === 'open'){
    const ta = document.createElement('textarea'); ta.placeholder = 'Escribe tu respuesta aquí...'; ta.rows = 6;
    ta.value = answers[idx] ? (answers[idx].value || '') : '';
    ta.addEventListener('input', e => { answers[idx] = {value: e.target.value}; });
    questionContainer.appendChild(ta);
  } else {
    const p = document.createElement('p'); p.textContent = 'Tipo de pregunta no soportado.'; questionContainer.appendChild(p);
  }

  if(currentTest.instructions) { const instr = document.createElement('p'); instr.className='small'; instr.textContent = currentTest.instructions; questionContainer.appendChild(instr); }

  prevBtn.disabled = idx === 0;
  nextBtn.disabled = idx === currentTest.questions.length - 1;
}

prevBtn.addEventListener('click', ()=> { if(currentIndex>0) renderQuestion(currentIndex-1); });
nextBtn.addEventListener('click', ()=> { if(currentIndex < currentTest.questions.length -1) renderQuestion(currentIndex+1); });

finishBtn.addEventListener('click', ()=> { if(!confirm('¿Estás seguro de terminar la prueba?')) return; submitExam('Terminado por el usuario'); });

function autoSubmit(reason){ if(finished) return; finished = true; clearInterval(timerInterval); submitExam(`Auto enviado: ${reason}`); }

// ----- Evaluación avanzada de preguntas abiertas -----
// Normalización: quitar tildes y minúsculas
function normalizeText(s){
  if(!s) return '';
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
// distancia de Levenshtein
function levenshtein(a,b){
  if(!a) a=''; if(!b) b='';
  const an = a.length, bn = b.length;
  if(an===0) return bn; if(bn===0) return an;
  const matrix = Array(an+1).fill(null).map(()=>Array(bn+1).fill(0));
  for(let i=0;i<=an;i++) matrix[i][0]=i;
  for(let j=0;j<=bn;j++) matrix[0][j]=j;
  for(let i=1;i<=an;i++){
    for(let j=1;j<=bn;j++){
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i-1][j] + 1,
        matrix[i][j-1] + 1,
        matrix[i-1][j-1] + cost
      );
    }
  }
  return matrix[an][bn];
}

// score fuzzy between 0..1 for two strings
function fuzzyScore(a,b){
  a = normalizeText(a); b = normalizeText(b);
  if(!a || !b) return 0;
  const lev = levenshtein(a,b);
  const maxLen = Math.max(a.length, b.length);
  if(maxLen === 0) return 1;
  return Math.max(0, 1 - (lev / maxLen));
}

// Evaluación de una pregunta abierta con keywords (array)
// Devuelve: {score:0..1, matchedKeywords: n, totalKeywords}
function evaluateOpenAnswer(answerText, keywords){
  answerText = normalizeText(answerText || '');
  if(!answerText) return {score:0, matchedKeywords:0, totalKeywords: keywords.length};
  const kws = (keywords || []).map(k => normalizeText(k));
  // contar keywords exactas (in substring)
  let matched = 0;
  kws.forEach(k=>{
    if(k && answerText.includes(k)) matched++;
  });
  // fuzzy: comparar cada keyword con el mejor token del answer (split por espacios)
  const tokens = answerText.split(/\s+/).filter(Boolean);
  let fuzzySum = 0;
  kws.forEach(k=>{
    if(!k) return;
    // si exact match ya cuentan al menos 1
    if(answerText.includes(k)){ fuzzySum += 1; return; }
    // else buscar el token con mayor similitud
    let best = 0;
    tokens.forEach(t=>{
      best = Math.max(best, fuzzyScore(t, k));
    });
    fuzzySum += best; // best in [0,1]
  });
  // normalizar a 0..1
  const avg = (kws.length>0) ? (fuzzySum / kws.length) : 0;
  // combinar: damos más peso a exact matches pero permitimos parcial por fuzzy
  const exactRatio = kws.length>0 ? (matched / kws.length) : 0;
  const combined = Math.max(exactRatio, avg * 0.95);
  return {score: combined, matchedKeywords: matched, totalKeywords: kws.length};
}

// ----- Empaquetar y evaluar resultados (usando validación avanzada) -----
function evaluateAndPackage(reason){
  const takenSeconds = Math.max(0, (currentTest.timeMinutes*60) - timeLeft);
  const submittedAt = new Date();
  const results = {
    student: {...student},
    testId: currentTest.id,
    testName: currentTest.name,
    startedAt: startedAt ? startedAt.toISOString() : null,
    submittedAt: submittedAt.toISOString(),
    durationSeconds: takenSeconds,
    reason,
    score: 0,
    maxScore: 0,
    questionResults: []
  };

  const ptsCorrect = currentTest.points && currentTest.points.correct !== undefined ? currentTest.points.correct : 1;
  const ptsWrong = currentTest.points && currentTest.points.incorrect !== undefined ? currentTest.points.incorrect : 0;

  currentTest.questions.forEach((q,i)=>{
    const qres = {index:i, type:q.type, title:q.title, correct:false, earned:0, max:0, answer: answers[i] || null};
    if(q.type === 'mcq'){
      qres.max = ptsCorrect;
      results.maxScore += ptsCorrect;
      const selected = answers[i] ? answers[i].selected : null;
      const correctIndex = q.answer;
      if(selected !== null && selected !== undefined){
        if(selected === correctIndex){ qres.correct = true; qres.earned = ptsCorrect; results.score += ptsCorrect; }
        else { qres.correct = false; qres.earned = ptsWrong; results.score += ptsWrong; }
      } else { qres.earned = 0; qres.correct=false; }
    } else if(q.type === 'tf'){
      qres.max = ptsCorrect;
      results.maxScore += ptsCorrect;
      const sel = answers[i] ? answers[i].selected : null;
      if(sel !== null && sel !== undefined){
        if(Number(sel) === Number(q.answer)){ qres.correct = true; qres.earned = ptsCorrect; results.score += ptsCorrect; }
        else { qres.correct = false; qres.earned = ptsWrong; results.score += ptsWrong; }
      } else { qres.earned = 0; }
    } else if(q.type === 'open'){
      qres.max = ptsCorrect;
      results.maxScore += ptsCorrect;
      const text = answers[i] && answers[i].value ? answers[i].value : '';
      const evalRes = evaluateOpenAnswer(text, q.answer || []);
      // definimos la ganancia como ptsCorrect * evalRes.score (0..1)
      const earned = Math.round((ptsCorrect * evalRes.score)*100)/100;
      qres.earned = earned;
      qres.correct = evalRes.score >= 0.6; // umbral para considerarlo "correcto"
      qres.evaluation = evalRes;
      results.score += earned;
    } else {
      // desconocido
    }
    results.questionResults.push(qres);
  });

  // opcional: redondear score a 2 decimales
  results.score = Math.round(results.score * 100)/100;
  results.maxScore = Math.round(results.maxScore * 100)/100;
  return results;
}

// persistir resultados: localStorage y POST al servidor si disponible
async function persistResults(results){
  // guardar local
  const key = 'examResults_v1';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.push(results);
  localStorage.setItem(key, JSON.stringify(arr));

  // intentar enviar a servidor POST /saveResult
  try{
    const res = await fetch('/saveResult', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(results)
    });
    if(res.ok){
      console.log('Resultado enviado al servidor.');
      return {ok:true, server:true};
    } else {
      console.warn('El servidor respondió con error al intentar guardar resultado.');
      return {ok:false, server:false};
    }
  }catch(e){
    console.warn('No se pudo conectar al servidor para guardar resultado. Resultado guardado localmente.', e);
    return {ok:false, server:false};
  }
}

// mostrar resultados en pantalla según flags
function showResultScreen(results){
  examScreen.classList.add('hidden');
  resultScreen.classList.remove('hidden');

  resultSummary.innerHTML = `
    <div class="result-card">
      <p><strong>Puntaje:</strong> ${results.score} / ${results.maxScore}</p>
      <p class="small">Iniciado: ${results.startedAt || '—'} • Enviado: ${results.submittedAt}</p>
      <p class="small">Duración (s): ${results.durationSeconds} • Razón: ${results.reason}</p>
    </div>
  `;

  const showAll = currentTest.showResults === true;
  const showCorrects = currentTest.showCorrectAnswers === true;

  detailedAnswers.innerHTML = '';
  if(showAll){
    results.questionResults.forEach(q=>{
      const s = document.createElement('div'); s.className='result-card';
      s.innerHTML = `<strong>Pregunta ${q.index+1}:</strong> ${q.title}
        <p class="small">Tipo: ${q.type} • Correcto: ${q.correct} • Puntos: ${q.earned} / ${q.max}</p>
        <p class="small">Respuesta del alumno: ${q.answer ? (q.answer.selected ?? q.answer.value) : 'Sin respuesta'}</p>
        ${showCorrects ? `<p class="small">Respuesta correcta: ${formatCorrect(q, currentTest.questions[q.index])}</p>` : '' }
        ${q.evaluation ? `<p class="small">Evaluación abierta: matched ${q.evaluation.matchedKeywords}/${q.evaluation.totalKeywords} • score=${Math.round(q.evaluation.score*100)}%</p>` : ''}
      `;
      detailedAnswers.appendChild(s);
    });
  } else {
    const s = document.createElement('div'); s.className='result-card';
    s.innerHTML = `<p class="small">Los detalles no están disponibles para esta prueba.</p>`;
    detailedAnswers.appendChild(s);
  }
}

// helper formateo respuestas correctas
function formatCorrect(qres, qDef){
  if(qDef.type==='mcq') return qDef.options[qDef.answer];
  if(qDef.type==='tf') return qDef.answer ? 'Verdadero' : 'Falso';
  if(qDef.type==='open') return qDef.answer.join(', ');
  return '-';
}

// enviar resultado final
async function submitExam(reason){
  if(finished) return;
  finished = true;
  clearInterval(timerInterval);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('beforeunload', beforeUnloadHandler);
  exitFullscreen();

  const results = evaluateAndPackage(reason);
  const persisted = await persistResults(results);
  showResultScreen(results);
  alert('Prueba finalizada. Resultado guardado. ' + (persisted.server ? 'Guardado en servidor.' : 'Guardado localmente.'));
}

// visibility / fullscreen handlers
function onVisibilityChange(){ if(document.hidden && !finished){ visibilityTriggered = true; autoSubmit('Pestaña en segundo plano / cambio de foco detectado'); setTimeout(()=> alert('Se detectó que cambiaste de pestaña o pusiste la app en segundo plano. La prueba fue finalizada automáticamente.'), 200);} }
function beforeUnloadHandler(e){ e.preventDefault(); e.returnValue = ''; }
function requestFullscreen(){ const el = document.documentElement; if(el.requestFullscreen) el.requestFullscreen().catch(()=>{}); else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen(); }
function exitFullscreen(){ if(document.exitFullscreen) document.exitFullscreen().catch(()=>{}); else if(document.webkitExitFullscreen) document.webkitExitFullscreen(); }

// UI events
btnContinue.addEventListener('click', async ()=>{ if(!testsList || !codesList) await loadJSONFiles(); startProcess(); });
btnLoadTests.addEventListener('click', async ()=>{ if(!testsList) await loadJSONFiles(); showAvailableTests(); });
restartBtn.addEventListener('click', ()=>{ resultScreen.classList.add('hidden'); startScreen.classList.remove('hidden'); });

// descarga JSON resultado
downloadBtn.addEventListener('click', ()=>{
  const key = 'examResults_v1';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  if(arr.length === 0){ alert('Sin resultados guardados.'); return; }
  const last = arr[arr.length-1];
  const blob = new Blob([JSON.stringify(last,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `resultado_${student.name.replace(/\s+/g,'_')}_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
});

// generar PDF del resultado mostrado
downloadPdfBtn.addEventListener('click', async ()=>{
  // renderizamos el div resultScreen con html2canvas y lo ponemos en pdf
  const node = resultScreen;
  const canvas = await html2canvas(node, {scale:2});
  const imgData = canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({orientation:'p', unit:'px', format:[canvas.width, canvas.height]});
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(`resultado_${student.name.replace(/\s+/g,'_')}_${Date.now()}.pdf`);
});

// inicializar
window.addEventListener('load', async ()=> { await loadJSONFiles(); });
