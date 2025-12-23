// reemplaza tu customDialog por esta versión
let dialogOpen = false;
let lastDialogClose = 0;

function customDialog(img_src, type, title, message, opts = {}) {
  return new Promise(resolve => {
    dialogOpen = true;

    // --- crear DOM del diálogo ---
    const overlay = document.createElement('div');
    overlay.className = 'modal open';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.display = 'flex';

    const card = document.createElement('div');
    card.className = 'card';
    card.style.textAlign = 'center';
    card.style.maxWidth = '90%';

    // logo si es PC
    const logo = document.createElement('img');

    logo.src = img_src; 
    logo.alt = "Logo";
    logo.style.width = '80px';
    logo.style.margin = '0px auto';

    const h2 = document.createElement('h2');
    h2.textContent = title || 'Mensaje';

    const p = document.createElement('p');
    p.textContent = message || '';
    p.style.margin = '8px 0 8px 0';

    const small = document.createElement('div');
    small.className = 'small';
    small.style.minHeight = '18px';

    const btnRow = document.createElement('div');
    btnRow.className = 'row';
    btnRow.style.justifyContent = 'center';
    btnRow.style.marginTop = '12px';
    btnRow.style.gap = '8px';

    // input para prompt
    let input = null;
    if (type === 'prompt') {
      input = document.createElement('input');
      input.type = 'text';
      input.placeholder = opts.placeholder || '';
      input.value = opts.defaultValue || '';
      input.style.marginTop = '8px';
      input.style.width = '100%';
      input.style.maxWidth = '520px';
      input.className = 'field-input';
    }

    const btnOK = document.createElement('button');
    btnOK.className = 'btn primary';
    btnOK.textContent = (type === 'confirm') ? 'Confirmar' : ((type === 'prompt') ? 'Aceptar' : 'Continuar');

    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn danger';
    btnCancel.textContent = 'Cancelar';

    // montar botones según tipo
    if (type === 'alert') {
      btnRow.appendChild(btnOK);
    } else {
      btnRow.append(btnOK, btnCancel);
    }

    // ensamblar
    card.append(logo, h2, p);
    
    // ocultar logo en movil
    if (window.innerWidth < 768) {
      logo.style.display = 'none';
    }

    if (input) card.appendChild(input);
    card.append(small, btnRow);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // --- lógica bloqueo 5s para alert/confirm ---
    let allowClose = (type === 'prompt'); // prompt puede cerrar YA
    let countdownTimer = null;
    if (type === 'alert' || type === 'confirm') {
      let countdown = 5;
      btnOK.disabled = true;
      small.textContent = `Espera ${countdown} segundos...`;
      countdownTimer = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
          clearInterval(countdownTimer);
          btnOK.disabled = false;
          allowClose = true;
          small.textContent = (type === 'alert') ? 'Puedes cerrar esta ventana ahora.' : 'Puedes confirmar o cancelar.';
        } else {
          small.textContent = `Espera ${countdown} segundos...`;
        }
      }, 1000);
    } else {
      small.textContent = 'Puedes cerrar esta ventana cuando quieras.';
    }

    // --- helpers cierre y limpieza ---
    function cleanupAndResolve(result) {
      // limpiar timers / listeners
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
      document.removeEventListener('keydown', onKeyDown);
      // animación de salida (si tu CSS usa .open)
      overlay.classList.remove('open');
      setTimeout(() => {
        try { overlay.remove(); } catch(e){}
        dialogOpen = false;
        lastDialogClose = Date.now();
        resolve(result);
      }, 160);
    }

    function closeWith(result) {
      // para alert/confirm respetamos allowClose para btnOK; cancel siempre cierra
      cleanupAndResolve(result);
    }

    // --- listeners botones ---
    btnOK.addEventListener('click', () => {
      if ((type === 'alert' || type === 'confirm') && !allowClose) return; // no hacer nada hasta que pase el tiempo
      if (type === 'prompt') return closeWith(input.value);
      if (type === 'confirm') return closeWith(true);
      return closeWith(undefined); // alert
    });

    btnCancel.addEventListener('click', () => {
      if (type === 'confirm') return closeWith(false);
      if (type === 'prompt') return closeWith(null);
      // alert no tiene cancel normalmente, pero si lo tuviera:
      return closeWith(undefined);
    });

    // --- teclado: Esc (cancelar) / Enter (OK) ---
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        // En alert: solo si allowClose true permitir cerrar con ESC (si no, ignorar)
        if (type === 'alert') {
          if (allowClose) cleanupAndResolve(undefined);
        } else if (type === 'confirm') {
          cleanupAndResolve(false);
        } else if (type === 'prompt') {
          cleanupAndResolve(null);
        }
      } else if (e.key === 'Enter') {
        // si tenemos input y está enfocado, aceptar
        if (input && document.activeElement === input) {
          btnOK.click();
        } else {
          if (!btnOK.disabled) btnOK.click();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);

    // evitar cerrar al clickear overlay por accidente (no cerramos)
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        // si quieres permitir cerrar con clic en overlay cuando allowClose = true, descomenta:
        // if (allowClose) cleanupAndResolve(undefined);
        ev.stopPropagation();
      }
    });

    // foco inicial
    setTimeout(() => {
      if (input) input.focus();
      else btnOK.focus();
    }, 50);

  }); // end Promise
}
