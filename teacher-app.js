// teacher-app.js

let testsData = { tests: [] };
let codesData = { codes: [] };
let teachersData = { teachers: [] };
let resultsData = []; // desde localStorage o upload

let currentTeacher = null;
let editingTest = null;

const $ = id => document.getElementById(id);

/* ---------- File loaders ---------- */
$('btnLoadLocal').addEventListener('click', ()=> {
  $('fileInputTestsT').click();
});
$('fileInputTestsT').addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  testsData = JSON.parse(await f.text());
  renderTestsList();
});
$('fileInputCodesT').addEventListener('change', async (e)=> {
  const f = e.target.files[0]; if(!f) return;
  codesData = JSON.parse(await f.text());
});
$('fileInputResultsT').addEventListener('change', async (e)=> {
  const f = e.target.files[0]; if(!f) return;
  resultsData = JSON.parse(await f.text()); renderResults();
});
$('fileInputTeachers').addEventListener('change', async (e)=> {
  const f = e.target.files[0]; if(!f) return;
  teachersData = JSON.parse(await f.text());
});

/* ---------- Login ---------- */
$('btnLogin').addEventListener('click', ()=> {
  const user = $('teacherUser').value.trim();
  const pass = $('teacherPass').value.trim();
  if(!teachersData || !teachersData.teachers.length){ $('loginMsg').textContent = 'Carga teachers.json (lista de docentes) para iniciar.'; return; }
  const found = teachersData.teachers.find(t => t.username === user && t.password === pass);
  if(!found){ $('loginMsg').textContent = 'Credenciales inválidas.'; return; }
  currentTeacher = found;
  $('login').classList.add('hidden');
  $('panel').classList.remove('hidden');
  $('welcome').textContent = `Hola, ${found.name}`;
  // intentar cargar tests guardados en localStorage
  const storedTests = localStorage.getItem('tests_json_v2');
  if(storedTests) testsData = JSON.parse(storedTests);
  renderTestsList();
  renderResults();
});

/* ---------- Logout ---------- */
$('btnLogout').addEventListener('click', ()=> {
  currentTeacher = null;
  $('panel').classList.add('hidden');
  $('login').classList.remove('hidden');
  $('teacherUser').value=''; $('teacherPass').value='';
});

/* ---------- Render tests list ---------- */
function renderTestsList(){
  const div = $('testsList'); div.innerHTML = '';
  if(!testsData || !testsData.tests.length){ div.innerHTML = '<div class="small">No hay pruebas.</div>'; return; }
  testsData.tests.forEach(t=>{
    const node = document.createElement('div'); node.className='result-card';
    node.innerHTML = `<strong>${t.name}</strong> <div class="small">ID: ${t.id} • Preguntas: ${t.questions.length} • Código público: ${t.publicCode||'-'}</div>
      <div class="row gap" style="margin-top:8px">
        <button class="btn" data-id="${t.id}" data-action="edit">Editar</button>
        <button class="btn" data-id="${t.id}" data-action="delete">Eliminar</button>
        <button class="btn" data-id="${t.id}" data-action="genCode">Generar código</button>
        <button class="btn" data-id="${t.id}" data-action="exportJson">Exportar JSON</button>
      </div>`;
    div.appendChild(node);
  });
  // attach handlers
  div.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', ()=> {
      const id = b.getAttribute('data-id');
      const action = b.getAttribute('data-action');
      const test = testsData.tests.find(x=>x.id===id);
      if(action==='edit') openEditor(test);
      if(action==='delete'){ if(confirm('Eliminar prueba?')) { testsData.tests = testsData.tests.filter(x=>x.id!==id); renderTestsList(); } }
      if(action==='genCode'){ const code = genRandomCode(); codesData.codes.push({ applyCode: code, testId: id }); alert('Código generado: '+code); }
      if(action==='exportJson'){ const blob = new Blob([JSON.stringify(test,null,2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download = `test_${id}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
    });
  });
}

/* ---------- Editor de prueba ---------- */
$('btnNewTest').addEventListener('click', ()=> {
  openEditor({
    id: 'test-'+Date.now(),
    name: '',
    publicCode: '',
    timeMinutes: 20,
    points: { correct:1, incorrect:0 },
    availableFrom: '08:00',
    availableTo: '23:59',
    instructions: '',
    showResults:true,
    showCorrectAnswers:true,
    questions: []
  });
});

function openEditor(test){
  editingTest = JSON.parse(JSON.stringify(test)); // copia
  $('testEditor').classList.remove('hidden');
  $('editName').value = editingTest.name;
  $('editTime').value = editingTest.timeMinutes;
  $('editPtsOk').value = editingTest.points.correct;
  $('editPtsBad').value = editingTest.points.incorrect;
  $('editFrom').value = editingTest.availableFrom || '';
  $('editTo').value = editingTest.availableTo || '';
  $('editShowRes').value = editingTest.showResults ? 'true' : 'false';
  $('editShowCorrect').value = editingTest.showCorrectAnswers ? 'true' : 'false';
  renderQuestionsEditor();
}

/* ---------- Guardar/cancelar edición ---------- */
$('btnCancelEdit').addEventListener('click', ()=> {
  editingTest = null; $('testEditor').classList.add('hidden');
});
$('btnSaveTest').addEventListener('click', ()=> {
  if(!editingTest) return;
  editingTest.name = $('editName').value.trim();
  editingTest.timeMinutes = Number($('editTime').value) || 20;
  editingTest.points = { correct: Number($('editPtsOk').value)||1, incorrect: Number($('editPtsBad').value)||0 };
  editingTest.availableFrom = $('editFrom').value.trim();
  editingTest.availableTo = $('editTo').value.trim();
  editingTest.showResults = $('editShowRes').value === 'true';
  editingTest.showCorrectAnswers = $('editShowCorrect').value === 'true';
  // persist into testsData
  const idx = testsData.tests.findIndex(t=>t.id===editingTest.id);
  if(idx>=0) testsData.tests[idx] = editingTest;
  else testsData.tests.push(editingTest);
  renderTestsList();
  editingTest = null; $('testEditor').classList.add('hidden');
});

/* ---------- Agregar pregunta ---------- */
$('btnAddQuestion').addEventListener('click', ()=> {
  if(!editingTest) return;
  const q = {
    type: 'mcq',
    title: 'Nueva pregunta',
    options: ['Opción A','Opción B','Opción C','Opción D'],
    answer: 0
  };
  editingTest.questions.push(q);
  renderQuestionsEditor();
});

function renderQuestionsEditor(){
  const container = $('questionsEditor'); container.innerHTML = '';
  if(!editingTest) return;
  editingTest.questions.forEach((q, idx)=>{
    const node = document.createElement('div'); node.className='result-card';
    node.innerHTML = `<strong>Pregunta ${idx+1} (${q.type})</strong>
      <label class="field"><span>Enunciado</span><input data-idx="${idx}" class="qTitle" value="${escapeHtml(q.title)}"/></label>
      <label class="field"><span>Tipo</span>
        <select data-idx="${idx}" class="qType">
          <option value="mcq">ABCD (mcq)</option><option value="tf">Verdadero/Falso</option><option value="open">Abierta</option>
        </select></label>
      <div class="qOptions"></div>
      <div class="row gap" style="margin-top:8px">
        <button data-idx="${idx}" class="btn qSave">Guardar cambios</button>
        <button data-idx="${idx}" class="btn qDelete">Eliminar</button>
      </div>`;
    container.appendChild(node);
    // populate fields
    node.querySelector('.qType').value = q.type;
    // options area
    const optsDiv = node.querySelector('.qOptions');
    if(q.type === 'mcq'){
      optsDiv.innerHTML = '<span class="small">Opciones (editar, marca índice de respuesta)</span>';
      q.options.forEach((opt,i)=>{
        const optHtml = document.createElement('div');
        optHtml.innerHTML = `<input data-idx="${idx}" data-opt="${i}" class="optInput" value="${escapeHtml(opt)}" />
          <label><input type="radio" name="ans-${idx}" ${q.answer===i ? 'checked' : ''} data-idx="${idx}" data-select="${i}"/> Correcta</label>`;
        optsDiv.appendChild(optHtml);
      });
    } else if(q.type === 'tf'){
      optsDiv.innerHTML = `<span class="small">Respuesta correcta: </span>
        <label><input type="radio" name="tf-${idx}" data-idx="${idx}" data-select="0" ${q.answer===0?'checked':''}/> Verdadero</label>
        <label><input type="radio" name="tf-${idx}" data-idx="${idx}" data-select="1" ${q.answer===1?'checked':''}/> Falso</label>`;
    } else if(q.type === 'open'){
      optsDiv.innerHTML = `<label class="field"><span>Keywords (json array) — ejemplo: [{"word":"lado","weight":1},{"word":"hipotenusa","weight":2}]</span>
        <textarea data-idx="${idx}" class="openKeywords" rows="3">${q.keywords?JSON.stringify(q.keywords): ''}</textarea></label>`;
    }

    // events: change type
    node.querySelector('.qType').addEventListener('change', (ev)=>{
      const val = ev.target.value;
      editingTest.questions[idx].type = val;
      if(val === 'mcq'){ editingTest.questions[idx].options = ['Opción A','Opción B','Opción C','Opción D']; editingTest.questions[idx].answer = 0; }
      if(val === 'tf'){ editingTest.questions[idx].answer = 0; delete editingTest.questions[idx].options; }
      if(val === 'open'){ delete editingTest.questions[idx].options; delete editingTest.questions[idx].answer; editingTest.questions[idx].keywords = []; }
      renderQuestionsEditor();
    });

    // save button
    node.querySelector('.qSave').addEventListener('click', ()=>{
      const newTitle = node.querySelector('.qTitle').value;
      editingTest.questions[idx].title = newTitle;
      const type = editingTest.questions[idx].type;
      if(type === 'mcq'){
        const optInputs = node.querySelectorAll('.optInput');
        editingTest.questions[idx].options = Array.from(optInputs).map(o=>o.value);
        const sel = node.querySelector(`[data-select][data-idx="${idx}"]:checked`);
        if(sel) editingTest.questions[idx].answer = Number(sel.getAttribute('data-select'));
      } else if(type === 'tf'){
        const sel = node.querySelector(`[data-select][data-idx="${idx}"]:checked`);
        if(sel) editingTest.questions[idx].answer = Number(sel.getAttribute('data-select'));
      } else if(type === 'open'){
        const ta = node.querySelector('.openKeywords').value;
        try{
          editingTest.questions[idx].keywords = ta ? JSON.parse(ta) : [];
        }catch(e){ alert('JSON inválido en keywords'); return; }
      }
      alert('Pregunta guardada en editor.');
    });

    // delete
    node.querySelector('.qDelete').addEventListener('click', ()=>{
      if(!confirm('Eliminar pregunta?')) return;
      editingTest.questions.splice(idx,1);
      renderQuestionsEditor();
    });
  });
}

/* ---------- Guardar tests en localStorage ---------- */
$('btnSaveJSON').addEventListener('click', ()=> {
  localStorage.setItem('tests_json_v2', JSON.stringify(testsData));
  localStorage.setItem('codes_json_v2', JSON.stringify(codesData));
  alert('Tests y códigos guardados en localStorage (tests_json_v2 / codes_json_v2).');
});

/* ---------- Generar código aleatorio ---------- */
function genRandomCode(){ return 'C-'+Math.random().toString(36).slice(2,8).toUpperCase(); }

/* ---------- Results management ---------- */
$('btnLoadResultsFromLS').addEventListener('click', ()=> {
  const key = 'examResults_v2';
  const arr = localStorage.getItem(key);
  if(!arr){ alert('No hay resultados en localStorage. Pide a los estudiantes que descarguen y suban los JSON, o carga un archivo results.json'); return; }
  resultsData = JSON.parse(arr);
  renderResults();
});
$('btnUploadResultsFile').addEventListener('click', ()=> $('fileInputResultsT').click());

function renderResults(){
  const div = $('resultsList'); div.innerHTML = '';
  if(!resultsData || resultsData.length===0){ div.innerHTML = '<div class="small">No hay resultados cargados.</div>'; return; }
  // agrupamos por testId
  const byTest = {};
  resultsData.forEach(r => { byTest[r.testId] = byTest[r.testId] || []; byTest[r.testId].push(r); });
  Object.keys(byTest).forEach(testId=>{
    const header = document.createElement('div'); header.className='result-card';
    header.innerHTML = `<strong>Test: ${testId}</strong> <div class="small">Entradas: ${byTest[testId].length}</div>`;
    const list = document.createElement('div');
    byTest[testId].forEach((r, idx)=>{
      const item = document.createElement('div'); item.className='result-card';
      item.innerHTML = `<strong>${r.student.name}</strong> <div class="small">Grupo: ${r.student.group} • Puntaje: ${Math.round(r.score*100)/100} / ${r.maxScore}</div>
        <div class="row gap" style="margin-top:6px">
          <button class="btn" data-test="${testId}" data-idx="${idx}" data-action="view">Ver</button>
          <button class="btn" data-test="${testId}" data-idx="${idx}" data-action="pdf">PDF</button>
        </div>`;
      list.appendChild(item);
      // handlers
      item.querySelectorAll('button').forEach(b=>{
        b.addEventListener('click', ()=> {
          const action = b.getAttribute('data-action');
          if(action==='view') showResultModal(r);
          if(action==='pdf') exportSinglePDF(r);
        });
      });
    });
    div.appendChild(header); div.appendChild(list);
  });
}

/* ---------- Show single result (modal-like) ---------- */
function showResultModal(r){
  let txt = `Resultado: ${r.student.name}\nGrupo: ${r.student.group}\nPuntaje: ${Math.round(r.score*100)/100} / ${r.maxScore}\n\nPreguntas:\n`;
  r.questionResults.forEach((q,i)=> txt += `${i+1}. ${q.title} - Puntos: ${q.earned}/${q.max} - Respuesta: ${q.answer ? (q.answer.selected ?? q.answer.value) : '---'}\n`);
  alert(txt);
}

/* ---------- Export single result to PDF ---------- */
async function exportSinglePDF(r){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(12); doc.text(`Resultado - ${r.testName}`,10,10);
  doc.setFontSize(10); doc.text(`Estudiante: ${r.student.name}`,10,18);
  doc.text(`Grupo: ${r.student.group}`,10,24);
  doc.text(`Puntaje: ${Math.round(r.score*100)/100} / ${r.maxScore}`,10,30);
  let y=38;
  r.questionResults.forEach((q,i)=>{
    if(y>270){ doc.addPage(); y=10; }
    doc.text(`${i+1}. ${q.title}`, 10, y); y+=6;
    doc.text(`Respuesta: ${q.answer ? (q.answer.selected ?? q.answer.value) : 'Sin respuesta'}`, 12, y); y+=6;
    doc.text(`Puntos: ${q.earned} / ${q.max}`, 12, y); y+=8;
  });
  doc.save(`resultado_${r.student.name.replace(/\s+/g,'_')}.pdf`);
}

/* ---------- Export all results to single PDF ---------- */
$('btnExportAll').addEventListener('click', async ()=> {
  if(!resultsData || resultsData.length===0){ alert('No hay resultados'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(12);
  let y=10;
  resultsData.forEach((r, idx)=>{
    if(y>260){ doc.addPage(); y=10; }
    doc.text(`${idx+1}. ${r.testName} - ${r.student.name} - ${Math.round(r.score*100)/100}/${r.maxScore}`, 10, y); y+=8;
    doc.text(`Grupo: ${r.student.group} • Fecha: ${r.submittedAt}`, 12, y); y+=8;
  });
  doc.save(`todos_resultados_${Date.now()}.pdf`);
});

/* ---------- Helpers ---------- */
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function renderTestsListIfNeeded(){ if(document.body.contains($('testsList'))) renderTestsList(); }

/* ---------- Inicial ---------- */
(function init(){
  // intentar cargar tests desde localStorage si existen
  const t = localStorage.getItem('tests_json_v2');
  if(t) testsData = JSON.parse(t);
  const c = localStorage.getItem('codes_json_v2');
  if(c) codesData = JSON.parse(c);
  const r = localStorage.getItem('examResults_v2');
  if(r) resultsData = JSON.parse(r);
})();
