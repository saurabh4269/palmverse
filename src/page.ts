/**
 * The 2D page around the XR session: title, culture-not-prediction framing,
 * privacy, an Enter button that only appears where immersive-ar is supported
 * (ui-text.md, "The 2D page on a computer"), and the gallery of saved Rekha
 * cards with download links (a file download can't happen inside XR).
 */
import { load } from './core/save.js';

export function initPage(launch: () => void): void {
  const page = document.getElementById('page');
  const btn = document.getElementById('enter') as HTMLButtonElement | null;
  const note = document.getElementById('xrnote');
  if (!page || !btn) return;
  const isEmulated = !!(window as unknown as { IWER_DEVICE?: unknown }).IWER_DEVICE;
  void (async () => {
    let ok = false;
    try {
      ok = !!(await navigator.xr?.isSessionSupported('immersive-ar'));
    } catch {
      ok = false;
    }
    btn.disabled = !ok;
    btn.textContent = ok ? 'Enter · प्रवेश करें' : 'Open this page in Meta Quest Browser';
    if (note) note.textContent = ok ? 'Put your controllers down: this experience uses your hands.' : 'This is the 2D preview. The reading happens in mixed reality on a Quest 3 or 3S.';
    // in the dev emulator the page would hide the scene: keep it out of the way
    if (isEmulated || import.meta.env.DEV) page.classList.add('hidden');
  })();
  btn.addEventListener('click', () => launch());
  const render = () => {
    const box = document.getElementById('cards');
    const none = document.getElementById('nocards');
    if (!box) return;
    const d = load();
    box.innerHTML = '';
    const items = d.readings.filter((r) => r.card).reverse();
    if (none) none.style.display = items.length ? 'none' : '';
    for (const r of items) {
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      img.src = r.card!;
      img.alt = `Rekha card, ${r.profile.side} hand, ${new Date(r.at).toLocaleDateString()}`;
      const a = document.createElement('a');
      a.href = r.card!;
      a.download = `hast-rekha-${r.profile.side}-${new Date(r.at).toISOString().slice(0, 10)}.jpg`;
      a.textContent = 'Download';
      fig.append(img, a);
      box.append(fig);
    }
  };
  render();
  window.addEventListener('hast-saved', render);
  // show the page again when the XR session ends
  navigator.xr?.addEventListener?.('sessiongranted', () => page.classList.add('hidden'));
  document.addEventListener('visibilitychange', render);
}
