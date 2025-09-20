// app.js

/* -------------------------
  Config / Estado global
--------------------------*/
let testsList = null;      // contenido de tests.json
let codesList = null;      // contenido de codes.json
let currentTest = null;    // objeto test seleccionado
let student = {name: '', group: ''};
let answers = [];          // respuestas del estudiante
let timerInterval = null;
let timeLeft = 0;
let startedAt = null;
let finished = false;
let visibilityTriggered = false;

/* -------------------------
  DOM referencias
--------------------------*/
const el = id => document.getElementById(id);
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
const restartBtn = el('restartBtn');

/* -------------------------
  Fetch JSON iniciales
--------------------------*/
async function loadJSONFiles(){
  try{
    const [tRes, cRes] = await Promise.all([
      fetch('tests.json'),
      fetch('codes.json')
    ]);
    testsList = await tRes.json();
    codesList = await cRes.json();
  }catch(e){
    alert('Error cargando JSON. Asegúrate de servir los archivos desde un servidor (no file://).');
    console.error(e);
  }
}

/* -------------------------
  Utilidades
--------------------------*/
function formatTime(s){
  const mm = Math.floor(s/60).toString().padStart(2,'0');
  const ss = (s%60).toString().padStart(2,'0');
  return `${mm}:${ss}`;
}
function nowISO(){ return new Date().toISOString(); }
function parseTimeStringToDate(tstr){
  // tstr en formato ISO preferible, si es "HH:MM" asume hoy
  if(!tstr) return null;
  if(tstr.includes('T')) return new Date(tstr);
  const [hh,mm] = tstr.split(':').map(x=>parseInt(x));
  const d = new Date();
  d.setHours(hh, mm||0,0,0);
  return d;
}

/* -------------------------
  UI: mostrar lista de pruebas cargadas
--------------------------*/
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

/* -------------------------
  Validar código: devuelve testId si válido
--------------------------*/
function resolveTestIdFromApplyCode(code){
  if(!codesList) return null;
  const mapping = codesList.codes.find(c=>c.applyCode === code);
  return mapping ? mapping.testId : null;
}

/* -------------------------
  Iniciar prueba
--------------------------*/
async function startProcess(){
  // lee inputs
  const name = el('studentName').value.trim();
  const group = el('studentGroup').value.trim();
  const applyCode = el('applyCode').value.trim();

  if(!name || !group || !applyCode){ alert('Completa nombre, grupo y código.'); return; }

  student.name = name;
  student.group = group;

  // resolver test id desde codes.json
  const testId = resolveTestIdFromApplyCode(applyCode);
  if(!testId){ alert('Código inválido.'); return; }

  // buscar test en testsList
  const test = testsList.tests.find(t=>t.id === testId);
  if(!test){ alert('No se encontró la prueba para ese código.'); return; }

  // verificar horario de disponibilidad
  const now = new Date();
  const from = parseTimeStringToDate(test.availableFrom);
  const to = parseTimeStringToDate(test.availableTo);
  if(from && now < from){ alert(`La prueba aún no está disponible. Disponible desde: ${from.toLocaleString()}`); return; }
  if(to && now > to){ alert(`La prueba ya cerró. Cerró: ${to.toLocaleString()}`); return; }

  // todo ok: set currentTest
  currentTest = test;
  prepareExam();
}

/* -------------------------
  Preparar y mostrar pantalla de examen
--------------------------*/
function prepareExam(){
  // iniciar estado
  answers = new Array(currentTest.questions.length).fill(null);
  startedAt = new Date();
  finished = false;
  visibilityTriggered = false;

  // UI
  startScreen.classList.add('hidden');
  resultScreen.classList.add('hidden');
  examScreen.classList.remove('hidden');
  testTitle.textContent = currentTest.name;
  metaName.textContent = student.name;
  metaGroup.textContent = student.group;

  // iniciar temporizador
  timeLeft = (currentTest.timeMinutes || 30) * 60;
  timerEl.textContent = formatTime(timeLeft);
  if(timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(tickTimer, 1000);

  // navigation
  renderQuestion(0);

  // pantalla completa
  requestFullscreen();

  // prevenir salir sin aviso
  window.addEventListener('beforeunload', beforeUnloadHandler);

  // ocultar menu contextual
  window.addEventListener('contextmenu', e=>e.preventDefault());

  // detectar si la pestaña pierde foco
  document.addEventListener('visibilitychange', onVisibilityChange);
}

/* -------------------------
  Timer tick
--------------------------*/
function tickTimer(){
  if(finished) return;
  timeLeft--;
  if(timeLeft < 0) {
    // tiempo agotado
    autoSubmit('Tiempo agotado');
    return;
  }
  timerEl.textContent = formatTime(timeLeft);
}

/* -------------------------
  Render pregunta por índice
--------------------------*/
let currentIndex = 0;
function renderQuestion(idx){
  currentIndex = idx;
  const q = currentTest.questions[idx];
  questionContainer.innerHTML = '';

  const h = document.createElement('h3');
  h.textContent = `Pregunta ${idx+1} / ${currentTest.questions.length}`;
  const qtxt = document.createElement('p');
  qtxt.innerHTML = `<strong>${q.title}</strong>`;
  questionContainer.appendChild(h);
  questionContainer.appendChild(qtxt);

  if(q.type === 'mcq'){
    const optionsDiv = document.createElement('div'); optionsDiv.className='options';
    q.options.forEach((opt,i)=>{
      const optDiv = document.createElement('label'); optDiv.className='option';
      const radio = document.createElement('input');
      radio.type='radio'; radio.name='opt'; radio.value = i;
      if(answers[idx] !== null && answers[idx].selected === i) radio.checked = true;
      optDiv.appendChild(radio);
      const span = document.createElement('span'); span.textContent = opt;
      optDiv.appendChild(span);
      optDiv.addEventListener('click', ()=> {
        // store
        answers[idx] = {selected: i};
        // mark UI
        Array.from(optionsDiv.children).forEach((c,j)=> c.classList.toggle('selected', j===i));
      });
      optionsDiv.appendChild(optDiv);
    });
    questionContainer.appendChild(optionsDiv);
  } else if(q.type === 'tf'){
    const optionsDiv = document.createElement('div'); optionsDiv.className='options';
    ['Verdadero','Falso'].forEach((label,i)=>{
      const optDiv = document.createElement('label'); optDiv.className='option';
      const radio = document.createElement('input'); radio.type='radio'; radio.name='opt'; radio.value = i;
      if(answers[idx] && answers[idx].selected === i) radio.checked = true;
      optDiv.appendChild(radio);
      optDiv.appendChild(document.createTextNode(label));
      optDiv.addEventListener('click', ()=> { answers[idx] = {selected: i}; Array.from(optionsDiv.children).forEach((c,j)=> c.classList.toggle('selected', j===i));});
      optionsDiv.appendChild(optDiv);
    });
    questionContainer.appendChild(optionsDiv);
  } else if(q.type === 'open'){
    const ta = document.createElement('textarea');
    ta.placeholder = 'Escribe tu respuesta aquí...';
    ta.rows = 6;
    ta.value = answers[idx] ? (answers[idx].value || '') : '';
    ta.addEventListener('input', e => { answers[idx] = {value: e.target.value}; });
    questionContainer.appendChild(ta);
  } else {
    const p = document.createElement('p'); p.textContent = 'Tipo de pregunta no soportado.';
    questionContainer.appendChild(p);
  }

  // pie con instrucciones si existen
  if(currentTest.instructions) {
    const instr = document.createElement('p'); instr.className='small'; instr.textContent = currentTest.instructions;
    questionContainer.appendChild(instr);
  }

  // buttons enable/disable
  prevBtn.disabled = idx === 0;
  nextBtn.disabled = idx === currentTest.questions.length - 1;
}

/* -------------------------
  Navegación
--------------------------*/
prevBtn.addEventListener('click', ()=> {
  if(currentIndex>0) renderQuestion(currentIndex-1);
});
nextBtn.addEventListener('click', ()=> {
  if(currentIndex < currentTest.questions.length -1) renderQuestion(currentIndex+1);
});

/* -------------------------
  Finalizar o auto enviar
--------------------------*/
finishBtn.addEventListener('click', ()=> {
  if(!confirm('¿Estás seguro de terminar la prueba?')) return;
  submitExam('Terminado por el usuario');
});

function autoSubmit(reason){
  if(finished) return;
  finished = true;
  clearInterval(timerInterval);
  // guardar y mostrar aviso
  submitExam(`Auto enviado: ${reason}`);
}

/* -------------------------
  Cálculo de puntaje y guardado
--------------------------*/
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

  const ptsCorrect = currentTest.points.correct || 1;
  const ptsWrong = ('incorrect' in currentTest.points) ? currentTest.points.incorrect : 0;
  currentTest.questions.forEach((q,i)=>{
    const qres = {index:i, type:q.type, title:q.title, correct:false, earned:0, max:0, answer: answers[i] || null};
    if(q.type === 'mcq'){
      qres.max = ptsCorrect;
      results.maxScore += ptsCorrect;
      const selected = answers[i] ? answers[i].selected : null;
      const correctIndex = q.answer; // índice
      if(selected !== null && selected !== undefined){
        if(selected === correctIndex){ qres.correct = true; qres.earned = ptsCorrect; results.score += ptsCorrect; }
        else { qres.correct = false; qres.earned = ptsWrong; results.score += ptsWrong; }
      } else { qres.earned = 0; qres.correct = false; }
    } else if(q.type === 'tf'){
      qres.max = ptsCorrect;
      results.maxScore += ptsCorrect;
      const sel = answers[i] ? answers[i].selected : null;
      if(sel !== null && sel !== undefined){
        if(Number(sel) === Number(q.answer)){ qres.correct = true; qres.earned = ptsCorrect; results.score += ptsCorrect; }
        else { qres.correct = false; qres.earned = ptsWrong; results.score += ptsWrong; }
      } else { qres.earned = 0; }
    } else if(q.type === 'open'){
      // comprobar lista de palabras esperadas (keywords)
      qres.max = ptsCorrect;
      results.maxScore += ptsCorrect;
      const text = answers[i] && answers[i].value ? answers[i].value.toLowerCase() : '';
      if(!text){ qres.earned = 0; qres.correct=false; }
      else {
        const keywords = q.answer.map(s=>s.toLowerCase());
        const found = keywords.filter(k => text.includes(k));
        // criterio: si al menos la mitad de palabras aparecen -> correcto (ajustable)
        if(found.length >= Math.ceil(keywords.length/2)){
          qres.correct = true; qres.earned = ptsCorrect; results.score += ptsCorrect;
        } else {
          qres.correct = false; qres.earned = ptsWrong; results.score += ptsWrong;
        }
      }
    } else {
      // otros tipos: 0
    }
    results.questionResults.push(qres);
  });

  return results;
}

function persistResults(results){
  // guardar en localStorage 'examResults' (array)
  const key = 'examResults_v1';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.push(results);
  localStorage.setItem(key, JSON.stringify(arr));
  // también generar descarga automática
  const blob = new Blob([JSON.stringify(results,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  downloadBtn.onclick = ()=> {
    const a = document.createElement('a');
    a.href = url;
    const fname = `resultado_${student.name.replace(/\s+/g,'_')}_${Date.now()}.json`;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
}

/* -------------------------
  Mostrar resultado en pantalla
--------------------------*/
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

  // mostrar detalles según flags del test
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
      `;
      detailedAnswers.appendChild(s);
    });
  } else {
    const s = document.createElement('div'); s.className='result-card';
    s.innerHTML = `<p class="small">Los detalles no están disponibles para esta prueba.</p>`;
    detailedAnswers.appendChild(s);
  }
}

/* Helper: mostrar respuesta correcta legible */
function formatCorrect(qres, qDef){
  if(qDef.type==='mcq') return qDef.options[qDef.answer];
  if(qDef.type==='tf') return qDef.answer ? 'Verdadero' : 'Falso';
  if(qDef.type==='open') return qDef.answer.join(', ');
  return '-';
}

/* -------------------------
  Submit final
--------------------------*/
function submitExam(reason){
  if(finished) return;
  finished = true;
  clearInterval(timerInterval);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('beforeunload', beforeUnloadHandler);
  exitFullscreen();

  const results = evaluateAndPackage(reason);
  persistResults(results);
  showResultScreen(results);
  alert('Prueba finalizada. Resultado guardado (descarga disponible).');
}

/* -------------------------
  Fullscreen helpers
--------------------------*/
function requestFullscreen(){
  const el = document.documentElement;
  if(el.requestFullscreen) el.requestFullscreen().catch(()=>{});
  else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}
function exitFullscreen(){
  if(document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
}

/* -------------------------
  Visibility change handler:
  si se oculta la pestaña -> auto enviar
--------------------------*/
function onVisibilityChange(){
  if(document.hidden && !finished){
    // acción: auto enviar con motivo "pestaña en segundo plano"
    visibilityTriggered = true;
    autoSubmit('Pestaña en segundo plano / cambio de foco detectado');
    // mostrar notificación modal simple después
    setTimeout(()=> alert('Se detectó que cambiaste de pestaña o pusiste la app en segundo plano. La prueba fue finalizada automáticamente.'), 200);
  }
}

/* -------------------------
  beforeunload handler
--------------------------*/
function beforeUnloadHandler(e){
  e.preventDefault();
  e.returnValue = '';
}

/* -------------------------
  Eventos UI
--------------------------*/
btnContinue.addEventListener('click', async ()=>{
  if(!testsList || !codesList) await loadJSONFiles();
  startProcess();
});
btnLoadTests.addEventListener('click', async ()=>{
  if(!testsList) await loadJSONFiles();
  showAvailableTests();
});

restartBtn.addEventListener('click', ()=>{
  // reset UI
  resultScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
});

/* -------------------------
  Inicializar al cargar
--------------------------*/
window.addEventListener('load', async ()=> {
  await loadJSONFiles();
  // si quieres puedes auto mostrar pruebas:
  // showAvailableTests();
});
