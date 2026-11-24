(() => {
  const dialog = document.getElementById("w3-image-dialog");
  if (!dialog || typeof dialog.showModal !== "function") return;

  const image = document.getElementById("w3-dialog-image");
  const title = document.getElementById("w3-image-title");
  const originalLink = document.getElementById("w3-image-link");
  const sizeButton = document.getElementById("w3-image-size");
  const viewport = dialog.querySelector(".w3-dialog-body");

  document.querySelectorAll(".w3-zoom").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      title.textContent = link.dataset.caption;
      image.src = link.href;
      image.alt = link.querySelector("img")?.alt || link.dataset.caption;
      originalLink.href = link.href;
      viewport.classList.remove("is-original");
      sizeButton.setAttribute("aria-pressed", "false");
      sizeButton.textContent = "Tamaño original";
      dialog.showModal();
      document.body.classList.add("w3-modal-open");
    });
  });

  sizeButton.addEventListener("click", () => {
    const original = viewport.classList.toggle("is-original");
    sizeButton.setAttribute("aria-pressed", String(original));
    sizeButton.textContent = original ? "Ver completa" : "Tamaño original";
  });

  dialog.addEventListener("close", () => {
    document.body.classList.remove("w3-modal-open");
  });

  dialog.addEventListener("click", event => {
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right ||
        event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
})();
