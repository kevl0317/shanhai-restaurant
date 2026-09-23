const READINGS = Object.freeze({ 寅: 'yín', 霁: 'jì', 莼: 'chún', 煨: 'wēi', 芡: 'qiàn', 鳜: 'guì' });

// Annotate rendered text only: dish IDs, search values and accessible labels stay intact.
export function addReadings(root) {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 4);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement.closest('ruby, script, style, textarea, .collectible, .reference-dish') && /[寅霁莼煨芡鳜]/u.test(node.data)) nodes.push(node);
  }
  for (const node of nodes) {
    const fragment = doc.createDocumentFragment();
    const characterCard = node.parentElement.closest('.character-introduction');
    for (const part of node.data.split(/([寅霁莼煨芡鳜])/u)) {
      if (!READINGS[part] || (/[寅霁]/u.test(part) && !characterCard)) { fragment.append(doc.createTextNode(part)); continue; }
      const ruby = doc.createElement('ruby');
      ruby.className = 'reading-hint';
      ruby.append(doc.createTextNode(part));
      const rt = doc.createElement('rt');
      rt.textContent = READINGS[part];
      rt.setAttribute('aria-hidden', 'true');
      ruby.append(rt);
      fragment.append(ruby);
    }
    node.replaceWith(fragment);
  }
}
