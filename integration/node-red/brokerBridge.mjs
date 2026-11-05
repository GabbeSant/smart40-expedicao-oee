import WebSocket from 'ws';

/** Saída Node-RED → broker WSS do Caminho A. Não executa comandos recebidos. */
export function createBrokerBridge({ url, token, storage, maxPending = 10000, maxQueueBytes = 10 * 1024 * 1024,
  reconnectBaseMs = 2000, reconnectMaxMs = 30000, heartbeatMs = 20000 }) {
  const destination = new URL(url);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(destination.hostname);
  if (!(destination.protocol === 'wss:' || destination.protocol === 'ws:' && local) ||
    destination.username || destination.password || destination.searchParams.has('token') ||
    typeof token !== 'string' || !token.trim() || token.length > 4096)
    throw new Error('Broker exige WSS (WS somente localhost) e token separado não vazio');
  destination.searchParams.set('token', token);
  let queue = [];
  const saved = storage?.load();
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.version !== 1 || !Array.isArray(parsed.pending) || parsed.pending.some(e => !e || typeof e.eventId !== 'string'))
      throw new Error('Fila WSS inválida; arquivo preservado');
    queue = parsed.pending;
  }
  let socket, reconnect, heartbeat, stopped = false, sending = false, attempts = 0, alive = true;
  let connection = 'DISCONNECTED', lastError = null, ignoredCommands = 0;
  const save = pending => storage?.save(JSON.stringify({ version: 1, pending }));
  const flush = () => {
    if (sending || socket?.readyState !== WebSocket.OPEN || !queue.length || stopped) return;
    sending = true;
    const active = socket;
    active.send(JSON.stringify(queue[0]), error => {
      sending = false;
      if (error) { lastError = 'SEND_FAILED'; active.terminate(); return; }
      try { const next = queue.slice(1); save(next); queue = next; }
      catch { lastError = 'QUEUE_STORAGE_FAILED'; active.terminate(); return; }
      flush();
    });
  };
  const connect = () => {
    if (stopped) return;
    connection = 'CONNECTING';
    socket = new WebSocket(destination, { handshakeTimeout: 10000, maxPayload: 65536 });
    socket.on('open', () => {
      connection = 'CONNECTED'; attempts = 0; lastError = null; alive = true; flush();
      heartbeat = setInterval(() => { if (!alive) return socket.terminate(); alive = false; socket.ping(); }, heartbeatMs);
    });
    socket.on('pong', () => { alive = true; });
    socket.on('message', () => { ignoredCommands++; });
    socket.on('error', () => { lastError = 'CONNECTION_FAILED'; });
    socket.on('close', () => {
      connection = 'DISCONNECTED'; clearInterval(heartbeat);
      if (!stopped) reconnect = setTimeout(connect, Math.min(reconnectBaseMs * 2 ** attempts++, reconnectMaxMs));
    });
  };
  connect();
  return {
    publish(event) {
      if (stopped) throw new Error('Ponte WSS encerrada');
      if (!event || typeof event.eventId !== 'string' || typeof event.type !== 'string' || 'acao' in event)
        throw new Error('Ponte WSS aceita somente eventos de telemetria identificados');
      if (queue.some(item => item.eventId === event.eventId)) return;
      const next = [...queue, structuredClone(event)];
      if (next.length > maxPending || Buffer.byteLength(JSON.stringify(next)) > maxQueueBytes)
        throw new Error('Fila WSS cheia; evento não confirmado para encaminhamento');
      save(next); queue = next; flush();
    },
    status: () => ({ connection, pending: queue.length, lastError, ignoredCommands }),
    close() { stopped = true; clearTimeout(reconnect); clearInterval(heartbeat); socket?.terminate(); },
  };
}
