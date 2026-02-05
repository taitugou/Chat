/**
 * 将帖子内容中的 @提及 转换为可点击的链接
 * @param content 原始 HTML 内容
 * @returns 转换后的 HTML 内容
 */
export function renderMentions(content: string): string {
  if (!content) return '';
  
  if (!content.includes('@')) return content;

  const mentionRegex = /@(\w+)/g;

  const buildMentionLinkHtml = (username: string) =>
    `<a href="/profile/${username}" class="mention-link" onclick="event.stopPropagation()">@${username}</a>`;

  if (typeof DOMParser === 'undefined') {
    return content.replace(mentionRegex, (_match, username) => buildMentionLinkHtml(username));
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${content}</div>`, 'text/html');
  const container = doc.body.firstElementChild as HTMLElement | null;
  if (!container) return content;

  const shouldSkipTextNode = (node: Text) => {
    const parent = node.parentElement;
    if (!parent) return false;
    if (parent.closest('a')) return true;
    const tag = parent.tagName?.toLowerCase();
    return tag === 'script' || tag === 'style';
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      if (shouldSkipTextNode(textNode)) return;
      const text = textNode.nodeValue || '';
      if (!text.includes('@')) return;

      mentionRegex.lastIndex = 0;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      const frag = doc.createDocumentFragment();

      while ((match = mentionRegex.exec(text))) {
        const [full, username] = match;
        const start = match.index;
        if (start > lastIndex) {
          frag.appendChild(doc.createTextNode(text.slice(lastIndex, start)));
        }
        const a = doc.createElement('a');
        a.setAttribute('href', `/profile/${username}`);
        a.setAttribute('class', 'mention-link');
        a.setAttribute('onclick', 'event.stopPropagation()');
        a.textContent = full;
        frag.appendChild(a);
        lastIndex = start + full.length;
      }

      if (lastIndex === 0) return;
      if (lastIndex < text.length) {
        frag.appendChild(doc.createTextNode(text.slice(lastIndex)));
      }

      textNode.replaceWith(frag);
      return;
    }

    const children = Array.from(node.childNodes);
    for (const child of children) {
      walk(child);
    }
  };

  walk(container);

  return container.innerHTML;
}

function ensureAnchorsStopPropagation(content: string): string {
  if (!content) return '';
  if (!content.includes('<a')) return content;

  if (typeof DOMParser === 'undefined') {
    return content.replace(
      /<a(?![^>]*\bonclick\s*=)([^>]*)>/gi,
      '<a$1 onclick="event.stopPropagation()">'
    );
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${content}</div>`, 'text/html');
  const container = doc.body.firstElementChild as HTMLElement | null;
  if (!container) return content;

  const anchors = container.querySelectorAll('a');
  anchors.forEach((a) => {
    if (!a.getAttribute('onclick')) {
      a.setAttribute('onclick', 'event.stopPropagation()');
    }
  });

  return container.innerHTML;
}

function wrapForwardQuotes(content: string): string {
  if (!content || !content.includes('forward-quote')) return content;

  if (typeof DOMParser === 'undefined') {
    // 简单的正则处理，如果不在浏览器环境
    return content.replace(
      /<blockquote class="forward-quote">([\s\S]*?)<\/blockquote>/gi,
      '<div class="forward-container"><blockquote class="forward-quote">$1</blockquote></div>'
    );
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${content}</div>`, 'text/html');
  const container = doc.body.firstElementChild as HTMLElement | null;
  if (!container) return content;

  const quotes = container.querySelectorAll('blockquote.forward-quote');
  quotes.forEach((quote) => {
    // 检查是否已经被包裹在 forward-container 中
    const parent = quote.parentElement;
    if (parent && parent.classList.contains('forward-container')) {
      return;
    }

    const wrapper = doc.createElement('div');
    wrapper.className = 'forward-container';
    quote.parentNode?.insertBefore(wrapper, quote);
    wrapper.appendChild(quote);
  });

  return container.innerHTML;
}

/**
 * 格式化内容，包括提及和其他可能的转换（如话题标签）
 */
export function formatPostContent(content: string): string {
  let formatted = content;
  
  // 处理提及
  formatted = renderMentions(formatted);

  // 确保链接不触发父级点击
  formatted = ensureAnchorsStopPropagation(formatted);

  // 包装转发内容
  formatted = wrapForwardQuotes(formatted);
  
  return formatted;
}
