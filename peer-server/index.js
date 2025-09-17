const fs = require('fs');
const { PeerServer } = require('peer');
const secrets = require('./secrets.json');
const configuration = require('./configuration.json');

const peerServer = PeerServer({
  host: configuration.peerServer.host,
  port: configuration.peerServer.port,
  concurrent_limit: configuration.peerServer.concurrent_limit,
  allow_discovery: false,
  path: "/" + secrets.secretPath,
  key: secrets.secretKey,
  ssl: {
    key: fs.readFileSync(configuration.ssl.key),
    cert: fs.readFileSync(configuration.ssl.cert)
  }
});

console.log(`PeerJS server started on port ${configuration.peerServer.port}`);

peerServer.on('connection', (client) => {
  console.log(`Client connected: ${client.id}`);
});

peerServer.on('error', (err) => {
  console.error('PeerServer error:', err);
});