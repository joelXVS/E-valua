// teacher-app.js

let testsData = { tests: [] };
let codesData = { codes: [] };
let teachersData = {
  "teachers": [
    { "username": "profe1", "password": "pass123", "name": "Profesor Uno" },
    { "username": "maria", "password": "secret", "name": "María López" }
  ]
};
let resultsData = [];

let currentTeacher = null;
let editingTest = null;

const $ = id => document.getElementById(id);

/* ---------- Login ---------- */
$('btnLogin').addEventListener('click', ()=> {
  const user = $('teacherUser').value.trim();
  const pass = $('teacherPass').value.trim();

  if(!teachersData || !teachersData.teachers.length){
    $('loginMsg').textContent = 'No se encontró teachers.json en la raíz.';
    return;
  }

  const found = teachersData.teachers.find(t => t.username === user && t.password === pass);
  if(!found){ $('loginMsg').textContent = 'Credenciales inválidas.'; return; }

  currentTeacher = found;
  $('login').classList.add('hidden');
  $('panel').classList.remove('hidden');
  $('welcome').textContent = `Hola, ${found.name}`;
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
    node.innerHTML = `<strong>${t.name}</strong>
      <div class="small">ID: ${t.id} • Preguntas: ${t.questions.length} • Código público: ${t.publicCode||'-'} • Grupos: ${t.groups?t.groups.join(", "):"Todos"}</div>
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
    groups: [], // grupos permitidos
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
  $('editGroups').value = editingTest.groups ? editingTest.groups.join(",") : "";
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
  editingTest.groups = $('editGroups').value ? $('editGroups').value.split(",").map(s=>s.trim()) : [];

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
    node.querySelector('.qType').value = q.type;
    const optsDiv = node.querySelector('.qOptions');
    if(q.type === 'mcq'){
      optsDiv.innerHTML = '<span class="small">Opciones</span>';
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
      optsDiv.innerHTML = `<label class="field"><span>Keywords (json array)</span>
        <textarea data-idx="${idx}" class="openKeywords" rows="3">${q.keywords?JSON.stringify(q.keywords): ''}</textarea></label>`;
    }

    node.querySelector('.qType').addEventListener('change', (ev)=>{
      const val = ev.target.value;
      editingTest.questions[idx].type = val;
      if(val === 'mcq'){ editingTest.questions[idx].options = ['Opción A','Opción B','Opción C','Opción D']; editingTest.questions[idx].answer = 0; }
      if(val === 'tf'){ editingTest.questions[idx].answer = 0; delete editingTest.questions[idx].options; }
      if(val === 'open'){ delete editingTest.questions[idx].options; delete editingTest.questions[idx].answer; editingTest.questions[idx].keywords = []; }
      renderQuestionsEditor();
    });

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
        try{ editingTest.questions[idx].keywords = ta ? JSON.parse(ta) : []; }
        catch(e){ alert('JSON inválido en keywords'); return; }
      }
      alert('Pregunta guardada en editor.');
    });

    node.querySelector('.qDelete').addEventListener('click', ()=>{
      if(!confirm('Eliminar pregunta?')) return;
      editingTest.questions.splice(idx,1);
      renderQuestionsEditor();
    });
  });
}

/* ---------- Helpers ---------- */
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function genRandomCode(){ return 'C-'+Math.random().toString(36).slice(2,8).toUpperCase(); }

/* ---------- Render Results ---------- */
function renderResults(){
  const div = $('resultsList'); div.innerHTML = '';
  if(!resultsData || resultsData.length===0){ div.innerHTML = '<div class="small">No hay resultados cargados.</div>'; return; }
  const byTest = {};
  resultsData.forEach(r => { byTest[r.testId] = byTest[r.testId] || []; byTest[r.testId].push(r); });
  Object.keys(byTest).forEach(testId=>{
    const header = document.createElement('div'); header.className='result-card';
    header.innerHTML = `<strong>Test: ${testId}</strong> <div class="small">Entradas: ${byTest[testId].length}</div>`;
    div.appendChild(header);
    byTest[testId].forEach((r, idx)=>{
      const item = document.createElement('div'); item.className='result-card';
      item.innerHTML = `<strong>${r.student.name}</strong> <div class="small">Grupo: ${r.student.group} • Puntaje: ${Math.round(r.score*100)/100} / ${r.maxScore}</div>`;
      div.appendChild(item);
    });
  });
}

/* ---------- Inicial ---------- */
(async function init(){
  try{
    const t = await fetch("./tests.json"); testsData = await t.json();
    const c = await fetch("./codes.json"); codesData = await c.json();
    const r = await fetch("./results.json"); resultsData = await r.json();
    // const th = await fetch("./teachers.json"); teachersData = await th.json();
    renderTestsList();
    renderResults();
  }catch(e){
    console.error("Error cargando JSONs desde raíz:", e);
  }
})();
