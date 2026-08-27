(() => {
  const NEW_LABEL = 'Lunarist Member Register';

  const replaceCreateAccountLabels = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);

    for (const textNode of nodes) {
      if (textNode.nodeValue.trim() !== 'Create Account') continue;
      textNode.nodeValue = textNode.nodeValue.replace('Create Account', NEW_LABEL);
    }

    document.querySelectorAll('[value="Create Account"], [aria-label="Create Account"], [title="Create Account"]').forEach((el) => {
      if ('value' in el) el.value = NEW_LABEL;
      if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', NEW_LABEL);
      if (el.hasAttribute('title')) el.setAttribute('title', NEW_LABEL);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', replaceCreateAccountLabels, { once: true });
  } else {
    replaceCreateAccountLabels();
  }

  const observer = new MutationObserver(replaceCreateAccountLabels);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
