let snackbarActive = false;
let snackbarQueue = Promise.resolve();

function showSnackbar(message, options = {}) {
  snackbarQueue = snackbarQueue.then(() => new Promise((resolve) => {
    snackbarActive = true;

    const {
      type = "info",
      duration = 4000,
    } = options;

    const bar = document.createElement("div");
    bar.className = `snackbar snackbar-${type}`;
    bar.innerHTML = `<span>${message}</span>`;

    document.body.appendChild(bar);

    const mobile = window.innerWidth < 768;
    bar.style.position = "fixed";
    bar.style.left = "50%";
    bar.style.transform = "translateX(-50%)";
    bar.style.zIndex = 99999;
    bar.style.transition = "all 0.35s ease";
    bar.style.opacity = "0";

    if (mobile) {
      bar.style.bottom = "-80px";
    } else {
      bar.style.top = "-80px";
    }

    // Entrada
    setTimeout(() => {
      bar.style.opacity = "1";
      if (mobile) bar.style.bottom = "20px";
      else bar.style.top = "20px";
    }, 20);

    // Salida
    setTimeout(() => {
      bar.style.opacity = "0";
      if (mobile) bar.style.bottom = "-80px";
      else bar.style.top = "-80px";
      setTimeout(() => {
        bar.remove();
        snackbarActive = false;
        resolve(true);
      }, 400);
    }, duration);
  }));
  return snackbarQueue;
}
