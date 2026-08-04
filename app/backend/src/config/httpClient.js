const axios = require('axios');
const http  = require('http');
const https = require('https');

// Keep-alive agents so outbound gateway calls REUSE TCP+TLS connections instead
// of doing a fresh handshake per request. At high TPS this is the single biggest
// win: it removes the per-request TLS cost and avoids ephemeral-port / TIME_WAIT
// exhaustion that otherwise caps sustained outbound throughput below ~450 conn/s.
const agentOptions = {
  keepAlive:      true,
  maxSockets:     200,   // max concurrent sockets per host
  maxFreeSockets: 50,    // idle sockets kept warm per host
  timeout:        60000, // socket inactivity timeout (ms)
};

const httpAgent  = new http.Agent(agentOptions);
const httpsAgent = new https.Agent(agentOptions);

// Shared axios instance for ALL payment-gateway / downstream calls.
// Per-call config (timeout, headers) still overrides these defaults.
const gatewayHttp = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 15000,
});

module.exports = { gatewayHttp, httpAgent, httpsAgent };
