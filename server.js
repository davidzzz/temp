const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);

const invites = new Map();
const events = [];

function track(eventName, properties) {
  events.push({ eventName, properties, at: new Date().toISOString() });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function sendText(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function serveFile(res, filePath, contentType = 'text/html; charset=utf-8') {
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    sendText(res, 404, 'Not found');
  }
}

function buildInviteUrl(req, token) {
  const host = req.headers.host || `localhost:${PORT}`;
  return `http://${host}/i/${token}`;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);

  if (req.method === 'GET' && url.pathname === '/') {
    return serveFile(res, path.join(__dirname, 'public', 'index.html'));
  }

  if (req.method === 'GET' && url.pathname === '/app.js') {
    return serveFile(res, path.join(__dirname, 'public', 'app.js'), 'application/javascript; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/invite-accepted.html') {
    return serveFile(res, path.join(__dirname, 'public', 'invite-accepted.html'));
  }

  if (req.method === 'POST' && url.pathname === '/api/invites/setup-share') {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return sendJson(res, 401, { error: 'Auth required: provide x-user-id header.' });
    }

    let body;
    try {
      body = await parseBody(req);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }

    const checklistId = body.checklistId;
    if (!checklistId) {
      return sendJson(res, 400, { error: 'checklistId is required.' });
    }

    const token = crypto.randomBytes(12).toString('base64url');
    const invite = {
      id: `inv_${token}`,
      token,
      inviter_user_id: String(userId),
      checklist_id: String(checklistId),
      created_at: new Date().toISOString(),
      accepted_at: null,
      accepted_user_id: null,
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    };
    invites.set(token, invite);

    track('share_clicked', {
      user_id: String(userId),
      checklist_id: String(checklistId),
      surface: 'setup_success'
    });

    return sendJson(res, 200, {
      inviteUrl: buildInviteUrl(req, token),
      inviteId: invite.id
    });
  }

  if (req.method === 'GET' && url.pathname.startsWith('/i/')) {
    const token = url.pathname.replace('/i/', '');
    const invite = invites.get(token);
    if (!invite) return sendText(res, 404, 'Invalid invite link');
    if (new Date(invite.expires_at) < new Date()) return sendText(res, 410, 'Invite link expired');

    const acceptedUser = url.searchParams.get('user') || 'guest_user';
    if (!invite.accepted_at) {
      invite.accepted_at = new Date().toISOString();
      invite.accepted_user_id = acceptedUser;
      track('invite_accepted', {
        invite_id: invite.id,
        inviter_user_id: invite.inviter_user_id,
        accepted_user_id: acceptedUser,
        checklist_id: invite.checklist_id
      });
    }

    const location = `/invite-accepted.html?checklistId=${encodeURIComponent(invite.checklist_id)}`;
    res.writeHead(302, { Location: location });
    return res.end();
  }

  if (req.method === 'GET' && url.pathname === '/api/metrics') {
    const shareClicked = events.filter((e) => e.eventName === 'share_clicked').length;
    const inviteAccepted = events.filter((e) => e.eventName === 'invite_accepted').length;
    return sendJson(res, 200, {
      events,
      summary: {
        share_clicked: shareClicked,
        invite_accepted: inviteAccepted,
        invite_accept_rate: shareClicked === 0 ? 0 : inviteAccepted / shareClicked,
        shares_per_setup: shareClicked
      }
    });
  }

  return sendText(res, 404, 'Not found');
});

if (require.main === module) {
  server.listen(PORT, () => {
    process.stdout.write(`Server listening on http://localhost:${PORT}\n`);
  });
}

module.exports = { server, invites, events };
