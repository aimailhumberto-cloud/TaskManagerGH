import http from 'http';

const reqData = JSON.stringify({ title: '   ' });

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/tasks/t1',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'hermes-master-secret-key',
    'Content-Length': Buffer.byteLength(reqData)
  }
}, (res) => {
  console.log('--- PUT /api/tasks/t1 ---');
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Body length:', data.length);
    console.log('Body:', data);
  });
});

req.on('error', (err) => {
  console.error('Error:', err.message);
});

req.write(reqData);
req.end();
