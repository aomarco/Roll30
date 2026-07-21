const endpoint = 'https://eujhtcnnjtwsthscdfqk.supabase.co/functions/v1/access-gate';

async function request(body) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The private access check could not be reached.');
  return data;
}

export async function ensurePrivateAccess() {
  const gate = document.getElementById('access-gate');
  const form = document.getElementById('gate-form');
  const password = document.getElementById('gate-password');
  const submit = document.getElementById('gate-submit');
  const copy = document.getElementById('gate-copy');
  const status = document.getElementById('gate-status');
  if (!gate || !form || !password || !submit || !copy || !status) throw new Error('The private access screen is incomplete.');

  const setStatus = (message, kind = '') => { status.textContent = message; status.className = `gate-status ${kind}`.trim(); };
  const unlockInterface = () => { gate.remove(); };

  let check;
  try {
    check = await request({ action:'check' });
  } catch (error) {
    copy.textContent = 'The table access check is unavailable. The campaign will remain locked.';
    setStatus(error.message, 'error');
    throw error;
  }
  if (check.allowed) {
    unlockInterface();
    return;
  }

  copy.textContent = 'This is a private table. Enter the shared password once and this network will be remembered.';
  form.classList.remove('gate-hidden');
  password.focus();

  await new Promise(resolve => {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      submit.disabled = true;
      setStatus('Checking the table password…');
      try {
        const result = await request({ action:'unlock', password:password.value });
        password.value = '';
        if (result.allowed) {
          setStatus('Access granted.', 'ok');
          unlockInterface();
          resolve();
          return;
        }
        if (result.blocked) {
          setStatus(`Too many attempts. Try again in about ${Math.ceil((result.retry_after_seconds || 900) / 60)} minutes.`, 'error');
        } else {
          setStatus(`That password did not work. ${result.attempts_remaining ?? 0} attempts remain before a short lockout.`, 'error');
        }
      } catch (error) {
        setStatus(error.message, 'error');
      } finally {
        submit.disabled = false;
        if (document.contains(password)) password.focus();
      }
    });
  });
}
