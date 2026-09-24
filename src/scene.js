// Ambient motion layered over the static shop illustration (assets/scene.svg).
// Coordinates follow the illustration's 1200×680 viewBox. `align` must match the image's
// object-position so both layers crop identically; CSS hides this layer when motion is off.
const star = (x, y, r) => `M${x} ${y - r}L${x + r / 4} ${y - r / 4}L${x + r} ${y}L${x + r / 4} ${y + r / 4}L${x} ${y + r}L${x - r / 4} ${y + r / 4}L${x - r} ${y}L${x - r / 4} ${y - r / 4}Z`;
const wisp = (d, delay) => `<path class="wisp" d="${d}" style="--d:${delay}s"/>`;
const twinkle = (x, y, r, delay) => `<path class="twinkle" d="${star(x, y, r)}" style="--d:${delay}s"/>`;

const MOTION = `<defs>
  <radialGradient id="scene-warm"><stop offset="0" stop-color="#FFDC92" stop-opacity=".72"/><stop offset=".55" stop-color="#FFDC92" stop-opacity=".2"/><stop offset="1" stop-color="#FFDC92" stop-opacity="0"/></radialGradient>
  <radialGradient id="scene-sun"><stop offset=".5" stop-color="#F7DC96" stop-opacity="0"/><stop offset=".56" stop-color="#F7DC96" stop-opacity=".5"/><stop offset="1" stop-color="#F7DC96" stop-opacity="0"/></radialGradient>
</defs>
<circle class="sun-glow" cx="996" cy="106" r="82" fill="url(#scene-sun)"/>
<circle class="lantern-glow" cx="647" cy="328" r="44" fill="url(#scene-warm)"/>
<circle class="lantern-glow" cx="1009" cy="345" r="50" fill="url(#scene-warm)" style="--d:-1.8s"/>
<g fill="none" stroke="#FFFCF0" stroke-linecap="round">
  <g stroke-width="5">${wisp('M601 350C590 338 612 330 603 316', 0)}${wisp('M619 348C610 337 631 328 621 315', -1.4)}${wisp('M610 352C600 342 620 333 611 320', -2.8)}</g>
  <g stroke-width="3.5">${wisp('M840 356C834 348 846 342 840 333', -.7)}${wisp('M851 513C845 505 857 499 851 490', -2.1)}</g>
</g>
<g fill="#FFF1C2">${twinkle(556, 221, 12, -.4)}${twinkle(948, 85, 9, -2.2)}</g>
<g fill="#D9BD73">${twinkle(468, 168, 8, -1.1)}${twinkle(714, 96, 6, -2.9)}${twinkle(1172, 64, 7, -.2)}${twinkle(884, 54, 5, -1.7)}${twinkle(300, 236, 6, -3.3)}</g>
<g transform="translate(1152 246)"><path class="leaf" d="M-8 0Q0-6 8 0Q0 6-8 0Z" fill="#C8D197" stroke="#8DAB78" stroke-width="1.5"/></g>`;

export function sceneArt({ cls = '', alt = '', align = 'xMaxYMid', priority = false } = {}) {
  return `<img${cls ? ` class="${cls}"` : ''} src="assets/scene.svg" alt="${alt}" draggable="false"${priority ? ' fetchpriority="high"' : ''}><svg class="scene-motion" viewBox="0 0 1200 680" preserveAspectRatio="${align} slice" aria-hidden="true" focusable="false">${MOTION}</svg>`;
}
