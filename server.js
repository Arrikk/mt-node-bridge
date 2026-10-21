'use strict';

const net = require('net');
const readline = require('readline');

const HOST = process.env.MT5_BRIDGE_HOST || '192.168.18.14';
const PORT = Number(process.env.MT5_BRIDGE_PORT || 9000);
const API_KEY = process.env.MT5_BRIDGE_API_KEY || 'change-me';

let activeSocket = null;
let receiveBuffer = '';
let lastPingAt = 0;

function isSocketReady(socket) {
  return Boolean(socket) && !socket.destroyed && socket.writable;
}

function send(socket, payload) {
  if (!isSocketReady(socket)) {
    console.log('Socket is not writable. Command was not sent.');
    return false;
  }

  const line = JSON.stringify(payload);
  socket.write(`${line}\n`, 'utf8', (error) => {
    if (error) {
      console.error(`Write failed: ${error.message}`);
      return;
    }
    console.log(`SENT -> ${line}`);
  });
  return true;
}

function sendCommand(action, fields = {}) {
  if (!isSocketReady(activeSocket)) {
    console.log('No EA socket is currently connected.');
    return;
  }

  const payload = {
    request_id: `req-${Date.now()}`,
    action,
    api_key: API_KEY,
    ...fields
  };

  send(activeSocket, payload);
}

function sendRawJson(rawJson) {
  if (!isSocketReady(activeSocket)) {
    console.log('No EA socket is currently connected.');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawJson);
  } catch (error) {
    console.error(`Invalid raw JSON: ${error.message}`);
    return;
  }

  if (!payload.request_id) {
    payload.request_id = `req-${Date.now()}`;
  }

  if (!payload.api_key) {
    payload.api_key = API_KEY;
  }

  send(activeSocket, payload);
}

function printStatus() {
  console.log('Socket status:');
  console.log(`  connected: ${isSocketReady(activeSocket)}`);
  if (activeSocket) {
    console.log(`  remote: ${activeSocket.remoteAddress || 'n/a'}:${activeSocket.remotePort || 'n/a'}`);
    console.log(`  destroyed: ${activeSocket.destroyed}`);
    console.log(`  writable: ${activeSocket.writable}`);
  }
  console.log(`  last ping at: ${lastPingAt ? new Date(lastPingAt).toISOString() : 'never'}`);
}

function handleMessage(socket, line) {
  console.log(`RECV <- ${line}`);

  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    console.error('Invalid JSON from EA:', error.message);
    return;
  }

  if (message.event === 'ping') {
    lastPingAt = Date.now();
    // send(socket, { event: 'pong', ts: Date.now() });
    return;
  }

  if (message.type === 'account_snapshot') {
    console.log(
      `Account balance=${message.balance} equity=${message.equity} positions=${message.positions} orders=${message.orders}`
    );
    return;
  }

  if (message.type === 'market_tick') {
    console.log(
      `Tick ${message.symbol} bid=${message.bid} ask=${message.ask} spread=${message.spread}`
    );
    return;
  }

  if (message.type === 'trade_event' || message.type === 'command_result' || message.type === 'error') {
    console.dir(message, { depth: null });
  }
}

function createServer() {
  const server = net.createServer((socket) => {
    activeSocket = socket;
    receiveBuffer = '';
    console.log(`EA connected from ${socket.remoteAddress}:${socket.remotePort}`);

    sendCommand('get_account');
    sendCommand('get_symbols');

    socket.on('data', (chunk) => {
      receiveBuffer += chunk.toString('utf8');

      let boundary = receiveBuffer.indexOf('\n');
      while (boundary !== -1) {
        const line = receiveBuffer.slice(0, boundary).trim();
        receiveBuffer = receiveBuffer.slice(boundary + 1);

        if (line.length > 0) {
          handleMessage(socket, line);
        }

        boundary = receiveBuffer.indexOf('\n');
      }
    });

    socket.on('close', () => {
      if (activeSocket === socket) {
        activeSocket = null;
      }
      console.log('EA disconnected.');
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error.message);
    });
  });

  server.on('error', (error) => {
    console.error('Server error:', error.message);
  });

  server.listen(1000, '127.0.0.1', () => {
    console.log(`MT5 bridge server listening on ${HOST}:${PORT}`);
    console.log(`API key: ${API_KEY}`);
    console.log('Type "help" for test commands.');
  });
}

function printHelp() {
  console.log('Available commands:');
  console.log('  help');
  console.log('  status');
  console.log('  account');
  console.log('  positions');
  console.log('  orders');
  console.log('  symbols');
  console.log('  history <symbol> <timeframe> <count>');
  console.log('  subscribe <symbol>');
  console.log('  unsubscribe <symbol>');
  console.log('  timeframe <symbol> <timeframe>');
  console.log('  buy <symbol> <lots>');
  console.log('  sell <symbol> <lots>');
  console.log('  closeall [symbol]');
  console.log('  trailing <points>');
  console.log('  prices');
  console.log('  breakeven <triggerPoints> <lockPoints>');
  console.log('  raw <json>');
}

function createConsole() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'mt5-bridge> '
  });

  rl.prompt();

  rl.on('line', (input) => {
    const parts = input.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      rl.prompt();
      return;
    }

    const command = parts[0].toLowerCase();

    switch (command) {
      case 'help':
        printHelp();
        break;
      case 'status':
        printStatus();
        break;
      case 'account':
        sendCommand('get_account');
        break;
      case 'positions':
        sendCommand('get_positions');
        break;
      case 'orders':
        sendCommand('get_orders');
        break;
      case 'symbols':
        sendCommand('get_symbols');
        break;
      case 'history':
        sendCommand('get_history', {
          symbol: parts[1] || 'EURUSD',
          timeframe: parts[2] || 'M1',
          count: Number(parts[3] || 50)
        });
        break;
      case 'subscribe':
        sendCommand('subscribe_symbol', {
          symbol: parts[1] || 'EURUSD'
        });
        break;
      case 'unsubscribe':
        sendCommand('unsubscribe_symbol', {
          symbol: parts[1] || 'EURUSD'
        });
        break;
      case 'timeframe':
        sendCommand('set_timeframe', {
          symbol: parts[1] || 'EURUSD',
          timeframe: parts[2] || 'M5'
        });
        break;
      case 'buy':
        sendCommand('trade', {
          symbol: parts[1] || 'EURUSD',
          side: 'buy',
          order_kind: 'market',
          lot_size: Number(parts[2] || 0.01),
          deviation: 10
        });
        break;
      case 'sell':
        sendCommand('trade', {
          symbol: parts[1] || 'EURUSD',
          side: 'sell',
          order_kind: 'market',
          lot_size: Number(parts[2] || 0.01),
          deviation: 10
        });
        break;
      case 'closeall':
        sendCommand('close_all', {
          symbol: parts[1] || ''
        });
        break;
      case 'trailing':
        sendCommand('set_trailing_stop', {
          enabled: true,
          points: Number(parts[1] || 100)
        });
        break;
      case 'breakeven':
        sendCommand('set_break_even', {
          enabled: true,
          trigger_points: Number(parts[1] || 100),
          lock_points: Number(parts[2] || 10)
        });
        break;
      case 'prices':
        sendCommand('get_symbols_with_prices');
        break;
      case 'sub_price':
        sendCommand('subscribe_prices', {symbol: parts[1] || 'BTCUSD'});
        break;
      case 'raw':
        sendRawJson(input.trim().slice(4).trim());
        break;
      default:
        console.log(`Unknown command: ${command}`);
        printHelp();
        break;
    }

    rl.prompt();
  });
}

createServer();
createConsole();
