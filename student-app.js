// student-app.js

let testsData = null;   // estructura completa de tests
let codesData = null;   // map codes -> testId
let gradesData = null;  // lista de cursos para dropdown

let currentTest = null;
let student = {name:'', group:'', grade:''};
let answers = [];
let timer = null;
let timeLeft = 0;
let startedAt = null;
let finished = false;
let currentIndex = 0;

const $ = id => document.getElementById(id);

/* ---------- UI: mostrar pruebas disponibles ---------- */
function showAvailable(){
  const out = $('available');
  if(!testsData && !codesData){ 
    out.innerHTML = '<div class="small">No se cargaron pruebas.</div>'; 
    return; 
  }
  const testsCount = testsData ? testsData.tests.length : 0;
  out.innerHTML = `<div class="small">Pruebas cargadas: ${testsCount}. Usa un código de aplicación válido.</div>`;
}

/* ---------- Grados dropdown ---------- */
function populateGrades(){
  const sel = $('gradeSelect');
  sel.innerHTML = '<option value="">-- Selecciona --</option>';
  if(!gradesData || !gradesData.grades) return;
  gradesData.grades.forEach(g=>{
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    sel.appendChild(opt);
  });
}

/* ---------- Resolver test desde código ---------- */
function resolveTestFromCode(code){
  if(!codesData) return null;
  const mapping = (codesData.codes || []).find(c=>c.applyCode === code);
  if(!mapping) return null;
  if(!testsData) return null;
  return testsData.tests.find(t=>t.id === mapping.testId) || null;
}

/* ---------- Continuar / iniciar prueba ---------- */
$('btnContinue').addEventListener('click', ()=>{
  const name = $('studentName').value.trim();
  const group = $('studentGroup').value.trim();
  const grade = $('gradeSelect').value;
  const code = $('applyCode').value.trim();

  if(!name || !group || !code){ alert('Completa nombre, grupo y código.'); return; }
  student = {name, group, grade};
  currentTest = resolveTestFromCode(code);
  if(!currentTest){ alert('Código inválido o JSON no cargado.'); return; }

  // 🔹 Verificar disponibilidad horaria
  const now = new Date();
  if(currentTest.availableFrom){
    const from = parseTime(currentTest.availableFrom);
    if(from && now < from){ alert('Prueba no disponible aún.'); return; }
  }
  if(currentTest.availableTo){
    const to = parseTime(currentTest.availableTo);
    if(to && now > to){ alert('Prueba cerrada.'); return; }
  }

  // 🔹 Verificar si la prueba aplica al grupo
  if(currentTest.groups && currentTest.groups.length > 0){
    if(!currentTest.groups.includes(student.group)){
      alert("Esta prueba no está disponible para tu grupo.");
      return;
    }
  }

  startExam();
});

/* ---------- Start Exam ---------- */
function startExam(){
  answers = new Array(currentTest.questions.length).fill(null);
  currentIndex = 0;
  startedAt = new Date();
  finished = false;

  $('start').classList.add('hidden');
  $('exam').classList.remove('hidden');
  $('testTitle').textContent = currentTest.name;
  $('metaName').textContent = student.name;
  $('metaGroup').textContent = student.group;
  $('metaGrade').textContent = student.grade || '-';

  timeLeft = (currentTest.timeMinutes||30) * 60;
  $('timer').textContent = formatTime(timeLeft);
  timer = setInterval(()=> { timeLeft--; $('timer').textContent = formatTime(timeLeft); if(timeLeft<0) autoSubmit('Tiempo agotado'); }, 1000);

  renderQuestion(0);

  // detectar cambio de pestaña -> auto submit
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('beforeunload', ()=>{ if(!finished) return 'La prueba se finalizará'; });
}

/* ---------- Render pregunta ---------- */
function renderQuestion(idx){
  currentIndex = idx;
  const q = currentTest.questions[idx];
  const container = $('questionContainer');
  container.innerHTML = '';
  const h = document.createElement('h3'); h.textContent = `Pregunta ${idx+1} / ${currentTest.questions.length}`;
  const p = document.createElement('p'); p.innerHTML = `<strong>${q.title}</strong>`;
  container.appendChild(h); container.appendChild(p);

  if(q.type === 'mcq'){
    const wrap = document.createElement('div'); wrap.className='options';
    q.options.forEach((opt,i)=>{
      const label = document.createElement('label'); label.className='option';
      const radio = document.createElement('input'); radio.type='radio'; radio.name='opt'; radio.value = i;
      if(answers[idx] && answers[idx].selected===i) radio.checked = true;
      label.appendChild(radio); label.appendChild(document.createTextNode(opt));
      label.addEventListener('click', ()=> { answers[idx] = {selected:i}; Array.from(wrap.children).forEach((c,j)=> c.classList.toggle('selected', j===i)); });
      wrap.appendChild(label);
    });
    container.appendChild(wrap);
  } else if(q.type === 'tf'){
    const wrap = document.createElement('div'); wrap.className='options';
    ['Falso','Verdadero'].forEach((t,i)=>{
      const label = document.createElement('label'); label.className='option';
      const radio = document.createElement('input'); radio.type='radio'; radio.name='opt'; radio.value = i;
      if(answers[idx] && answers[idx].selected===i) radio.checked = true;
      label.appendChild(radio); label.appendChild(document.createTextNode(t));
      label.addEventListener('click', ()=> { answers[idx] = {selected:i}; Array.from(wrap.children).forEach((c,j)=> c.classList.toggle('selected', j===i)); });
      wrap.appendChild(label);
    });
    container.appendChild(wrap);
  } else if(q.type === 'open'){
    const ta = document.createElement('textarea'); ta.rows=6; ta.placeholder='Escribe tu respuesta...';
    ta.value = answers[idx] ? (answers[idx].value||'') : '';
    ta.addEventListener('input', (e)=> answers[idx]={value:e.target.value});
    container.appendChild(ta);
  } else {
    container.appendChild(document.createTextNode('Tipo de pregunta no soportado.'));
  }

  $('prevBtn').disabled = idx === 0;
  $('nextBtn').disabled = idx === currentTest.questions.length -1;
}

$('prevBtn').addEventListener('click', ()=> { if(currentIndex>0) renderQuestion(currentIndex-1); });
$('nextBtn').addEventListener('click', ()=> { if(currentIndex < currentTest.questions.length-1) renderQuestion(currentIndex+1); });
$('finishBtn').addEventListener('click', ()=> { if(confirm('Terminar prueba?')) submitExam('Terminado por el usuario'); });

/* ---------- Visibility change -> auto submit ---------- */
function onVisibilityChange(){
  if(document.hidden && !finished){
    autoSubmit('Pestaña en segundo plano');
    setTimeout(()=> alert('Se detectó cambio de pestaña. La prueba fue finalizada.'),200);
  }
}

/* ---------- Auto submit / submit ---------- */
function autoSubmit(reason){
  if(finished) return;
  finished = true;
  clearInterval(timer);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  const res = evaluateResults(reason);
  persistResult(res);
  showResult(res);
}
function submitExam(reason){
  if(finished) return;
  finished = true;
  clearInterval(timer);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  const res = evaluateResults(reason);
  persistResult(res);
  showResult(res);
}

/* ---------- Evaluación con puntuación parcial para abiertas ---------- */
function evaluateResults(reason){
  const ptsCorrect = (currentTest.points && currentTest.points.correct) || 1;
  const ptsWrong = (currentTest.points && ('incorrect' in currentTest.points)) ? currentTest.points.incorrect : 0;
  const result = {
    student,
    testId: currentTest.id,
    testName: currentTest.name,
    startedAt: startedAt ? startedAt.toISOString() : null,
    submittedAt: new Date().toISOString(),
    durationSeconds: (currentTest.timeMinutes||0)*60 - timeLeft,
    reason,
    score:0,
    maxScore:0,
    questionResults:[]
  };

  currentTest.questions.forEach((q,i)=>{
    const qr = {index:i, type:q.type, title:q.title, earned:0, max:0, correct:false, answer: answers[i] || null};
    if(q.type === 'mcq'){
      qr.max = ptsCorrect; result.maxScore += ptsCorrect;
      const sel = answers[i] ? answers[i].selected : null;
      if(sel !== null && sel !== undefined){
        if(Number(sel) === Number(q.answer)){ qr.earned = ptsCorrect; qr.correct = true; result.score += ptsCorrect; }
        else { qr.earned = ptsWrong; qr.correct = false; result.score += ptsWrong; }
      }
    } else if(q.type === 'tf'){
      qr.max = ptsCorrect; result.maxScore += ptsCorrect;
      const sel = answers[i] ? answers[i].selected : null;
      if(sel !== null && sel !== undefined){
        if(Number(sel) === Number(q.answer)){ qr.earned = ptsCorrect; qr.correct = true; result.score += ptsCorrect; }
        else { qr.earned = ptsWrong; qr.correct = false; result.score += ptsWrong; }
      }
    } else if(q.type === 'open'){
      qr.max = ptsCorrect; result.maxScore += ptsCorrect;
      const text = answers[i] && answers[i].value ? answers[i].value.toLowerCase() : '';
      if(!text){ qr.earned = 0; qr.correct = false; }
      else {
        const kws = q.keywords || [];
        let totalWeight = 0;
        let foundWeight = 0;
        if(kws.length === 0 && Array.isArray(q.answer)){
          q.answer.forEach(k=>{ totalWeight += 1; if(text.includes(k.toLowerCase())) foundWeight += 1; });
        } else {
          kws.forEach(k => { totalWeight += (k.weight || 1); if(text.includes(k.word.toLowerCase())) foundWeight += (k.weight || 1); });
        }
        const fraction = totalWeight > 0 ? (foundWeight/totalWeight) : 0;
        const earned = Math.round(fraction * ptsCorrect * 100)/100;
        qr.earned = earned;
        if(fraction >= 0.5) qr.correct = true;
        result.score += earned;
      }
    }
    result.questionResults.push(qr);
  });

  return result;
}

/* ---------- Persistir resultado ---------- */
function persistResult(res){
  const key = 'examResults_v2';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.push(res);
  localStorage.setItem(key, JSON.stringify(arr));

  const blob = new Blob([JSON.stringify(res, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  $('downloadBtn').onclick = ()=> {
    const a = document.createElement('a'); a.href = url;
    a.download = `resultado_${res.student.name.replace(/\s+/g,'_')}_${Date.now()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };
  $('downloadPdfBtn').onclick = ()=> generatePDF(res);
}

/* ---------- Mostrar resultado ---------- */
function showResult(res){
  $('exam').classList.add('hidden');
  $('result').classList.remove('hidden');
  $('resultSummary').innerHTML = `<div class="result-card"><p><strong>Puntaje:</strong> ${Math.round(res.score*100)/100} / ${res.maxScore}</p>
    <p class="small">Inició: ${res.startedAt || '-'} • Enviado: ${res.submittedAt}</p>
    <p class="small">Duración (s): ${res.durationSeconds}</p></div>`;
  const showAll = currentTest.showResults === true;
  const showCorrects = currentTest.showCorrectAnswers === true;
  const det = $('detailedAnswers'); det.innerHTML = '';
  if(showAll){
    res.questionResults.forEach(q=>{
      const node = document.createElement('div'); node.className='result-card';
      node.innerHTML = `<strong>Pregunta ${q.index+1}:</strong> ${q.title}
        <p class="small">Tipo: ${q.type} • Puntos: ${q.earned} / ${q.max} • Correcto: ${q.correct}</p>
        <p class="small">Respuesta: ${q.answer ? (q.answer.selected ?? q.answer.value) : 'Sin respuesta'}</p>
        ${showCorrects ? `<p class="small">Respuesta correcta: ${formatRight(q, currentTest.questions[q.index])}</p>` : ''}`;
      det.appendChild(node);
    });
  } else {
    det.innerHTML = `<div class="result-card"><p class="small">Detalle de respuestas no disponible.</p></div>`;
  }
}

/* ---------- Helpers ---------- */
function formatRight(qres, qDef){
  if(qDef.type==='mcq') return qDef.options[qDef.answer];
  if(qDef.type==='tf') return qDef.answer ? 'Verdadero' : 'Falso';
  if(qDef.type==='open') {
    if(qDef.keywords) return qDef.keywords.map(k=>k.word).join(', ');
    if(qDef.answer) return qDef.answer.join(', ');
    return '-';
  }
  return '-';
}
function parseTime(str){
  if(!str) return null;
  if(str.includes('T')) return new Date(str);
  const [hh,mm]=str.split(':').map(x=>parseInt(x));
  const d = new Date(); d.setHours(hh,mm||0,0,0); return d;
}
function formatTime(s){ const mm = Math.floor(s/60).toString().padStart(2,'0'); const ss = (s%60).toString().padStart(2,'0'); return `${mm}:${ss}`; }

/* ---------- PDF export ---------- */
async function generatePDF(res){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(12);
  doc.text(`Resultados - ${res.testName}`, 10, 10);
  doc.setFontSize(10);
  doc.text(`Estudiante: ${res.student.name}`, 10, 18);
  doc.text(`Grupo: ${res.student.group}`, 10, 24);
  doc.text(`Puntaje: ${Math.round(res.score*100)/100} / ${res.maxScore}`, 10, 30);
  let y = 38;
  res.questionResults.forEach((q,i)=>{
    if(y>270){ doc.addPage(); y=10; }
    doc.text(`${i+1}. ${q.title}`, 10, y); y+=6;
    doc.text(`Respuesta: ${q.answer ? (q.answer.selected ?? q.answer.value) : 'Sin respuesta'}`, 12, y); y+=6;
    doc.text(`Puntos: ${q.earned} / ${q.max}`, 12, y); y+=8;
  });
  doc.save(`resultado_${res.student.name.replace(/\s+/g,'_')}.pdf`);
}

/* ---------- Cargar JSONs desde raíz ---------- */
(async function loadFromRoot(){
  try{
    const t = await fetch("./tests.json"); testsData = await t.json();
    const c = await fetch("./codes.json"); codesData = await c.json();
    const g = await fetch("./grades.json"); gradesData = await g.json(); populateGrades();
    showAvailable();
  }catch(e){
    console.error("Error cargando JSONs desde raíz:", e);
  }
})();
