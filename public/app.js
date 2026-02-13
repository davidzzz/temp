const shareBtn = document.getElementById('shareBtn');
const copyBtn = document.getElementById('copyBtn');
const statusEl = document.getElementById('status');
const linkBox = document.getElementById('linkBox');

let inviteUrl = '';

shareBtn.addEventListener('click', async () => {
  statusEl.textContent = '';
  const response = await fetch('/api/invites/setup-share', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'admin_123'
    },
    body: JSON.stringify({ checklistId: 'setup-001' })
  });

  const data = await response.json();
  if (!response.ok) {
    statusEl.style.color = 'crimson';
    statusEl.textContent = data.error || 'Unable to create invite.';
    return;
  }

  inviteUrl = data.inviteUrl;
  linkBox.textContent = inviteUrl;
  copyBtn.disabled = false;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Setup checklist',
        text: 'Join my setup checklist',
        url: inviteUrl
      });
      statusEl.style.color = '#065f46';
      statusEl.textContent = 'Invite shared';
      return;
    } catch (err) {
      // fall back to copy flow
    }
  }

  await navigator.clipboard.writeText(inviteUrl);
  statusEl.style.color = '#065f46';
  statusEl.textContent = 'Invite link copied';
});

copyBtn.addEventListener('click', async () => {
  if (!inviteUrl) return;
  await navigator.clipboard.writeText(inviteUrl);
  statusEl.style.color = '#065f46';
  statusEl.textContent = 'Invite link copied';
});
