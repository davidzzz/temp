const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { server } = require('./server');

function request(port, options = {}, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port, ...options }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('creates share invite and tracks acceptance', async (t) => {
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const port = server.address().port;

  const create = await request(port, {
    method: 'POST',
    path: '/api/invites/setup-share',
    headers: {
      'content-type': 'application/json',
      'x-user-id': 'admin_1'
    }
  }, JSON.stringify({ checklistId: 'setup-001' }));

  assert.equal(create.status, 200);
  const invite = JSON.parse(create.body);
  assert.ok(invite.inviteUrl.includes('/i/'));

  const tokenPath = new URL(invite.inviteUrl).pathname;
  const accept = await request(port, { method: 'GET', path: `${tokenPath}?user=new_user` });
  assert.equal(accept.status, 302);

  const metrics = await request(port, { method: 'GET', path: '/api/metrics' });
  assert.equal(metrics.status, 200);
  const payload = JSON.parse(metrics.body);
  assert.equal(payload.summary.share_clicked, 1);
  assert.equal(payload.summary.invite_accepted, 1);
});
