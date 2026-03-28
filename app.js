/**
 * Chat n8n — Application Logic
 * Sends user messages to an n8n webhook and displays the response.
 */

'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const DEFAULT_WEBHOOK = 'https://n8n.develle.fr/webhook-test/1f05a851-71d7-4dff-8c7d-721e6c94eefb';

// ─── DOM References ──────────────────────────────────────────────────────────
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
const clearChatBtn = document.getElementById('clearChatBtn');

// ─── State ───────────────────────────────────────────────────────────────────
let isSending = false;

// ─── Init ─────────────────────────────────────────────────────────────────────
(function init() {
  // Auto-grow textarea
  messageInput.addEventListener('input', autoGrow);

  // Send on Enter (Shift+Enter for newline)
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn.addEventListener('click', handleSend);

  // Clear chat
  clearChatBtn.addEventListener('click', clearChat);
})();

// ─── Auto-grow textarea ──────────────────────────────────────────────────────
function autoGrow() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 140) + 'px';
}

// ─── Send Message ────────────────────────────────────────────────────────────
async function handleSend() {
  if (isSending) return;

  const text = messageInput.value.trim();
  if (!text) return;

  const webhookUrl = DEFAULT_WEBHOOK;

  // Display user message
  appendMessage(text, 'user');
  messageInput.value = '';
  messageInput.style.height = 'auto';

  // Lock UI
  isSending = true;
  sendBtn.disabled = true;

  // Show typing indicator
  showTypingIndicator();

  try {
    const response = await sendToN8n(webhookUrl, text);
    hideTypingIndicator();
    appendMessage(response, 'bot');
  } catch (err) {
    hideTypingIndicator();
    appendMessage(
      `❌ Erreur lors de la connexion au workflow n8n.\n\nDétail : ${err.message}`,
      'error'
    );
    console.error('[n8n Chat] Erreur:', err);
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

// ─── n8n API Call ────────────────────────────────────────────────────────────
async function sendToN8n(webhookUrl, message) {
  const body = JSON.stringify({ message });

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} — ${res.statusText}`);
  }

  // Try to parse JSON, fall back to text
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const data = await res.json();

    // Support various n8n response formats:
    // { response: "..." } | { output: "..." } | { text: "..." } | { message: "..." }
    // | [{ response: "..." }] | plain object (stringified)
    if (Array.isArray(data)) {
      const first = data[0] || {};
      return first.response ?? first.output ?? first.text ?? first.message ?? JSON.stringify(first, null, 2);
    }

    if (typeof data === 'object') {
      return data.response ?? data.output ?? data.text ?? data.message ?? JSON.stringify(data, null, 2);
    }

    return String(data);
  }

  // Plain text response
  return await res.text();
}

// ─── Append Message ──────────────────────────────────────────────────────────
function appendMessage(text, role) {
  const isUser = role === 'user';
  const isError = role === 'error';

  const group = document.createElement('div');
  group.className = `message-group ${isUser ? 'user-group' : 'bot-group'}`;

  // Avatar (only for bot / error)
  if (!isUser) {
    const avatar = document.createElement('div');
    avatar.className = 'avatar-small';
    avatar.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>`;
    group.appendChild(avatar);
  }

  // Stack (message + time)
  const stack = document.createElement('div');
  stack.className = 'messages-stack';

  const bubble = document.createElement('div');
  bubble.className = `message ${isUser ? 'user-message animate-in-user' : isError ? 'error-message animate-in' : 'bot-message animate-in'}`;

  // Render text with basic formatting (newlines → <br>)
  bubble.innerHTML = formatText(text);

  const timeEl = document.createElement('span');
  timeEl.className = 'message-time';
  timeEl.textContent = getCurrentTime();

  stack.appendChild(bubble);
  stack.appendChild(timeEl);
  group.appendChild(stack);

  chatMessages.appendChild(group);
  scrollToBottom();
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function showTypingIndicator() {
  typingIndicator.classList.add('visible');
  typingIndicator.setAttribute('aria-hidden', 'false');
  scrollToBottom();
}

function hideTypingIndicator() {
  typingIndicator.classList.remove('visible');
  typingIndicator.setAttribute('aria-hidden', 'true');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function scrollToBottom() {
  requestAnimationFrame(() => {
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
  });
}

function getCurrentTime() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatText(text) {
  // Escape HTML, then convert newlines to <br> and **bold** to <strong>
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const withBold = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  const withBreaks = withBold.replace(/\n/g, '<br>');

  return `<p>${withBreaks}</p>`;
}

function clearChat() {
  // Keep only the welcome message
  const welcome = document.getElementById('welcomeMessage');
  chatMessages.innerHTML = '';
  if (welcome) chatMessages.appendChild(welcome);
  showToast('💬 Conversation effacée');
}

// ─── Toast ───────────────────────────────────────────────────────────────────
let toastTimeout = null;

function showToast(msg) {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  clearTimeout(toastTimeout);

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}
