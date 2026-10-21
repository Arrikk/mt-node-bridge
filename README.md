# Node TCP Server

This folder contains the Node.js TCP server that the MT5 EA connects to.

## Run

```bash
cd "C:\Users\HP\OneDrive\Documents\Expert Advisor\Node TCP"
npm start
```

Optional environment variables:

```bash
set MT5_BRIDGE_HOST=127.0.0.1
set MT5_BRIDGE_PORT=9000
set MT5_BRIDGE_API_KEY=change-me
```

## MT5 EA Settings

- `InpServerHost = 127.0.0.1`
- `InpServerPort = 9000`
- `InpApiKey = change-me`
- `Allow DLL imports = true`

## Interactive Test Commands

- `status`
- `account`
- `positions`
- `orders`
- `symbols`
- `history EURUSD M5 100`
- `subscribe XAUUSD`
- `timeframe EURUSD H1`
- `buy EURUSD 0.01`
- `sell EURUSD 0.01`
- `closeall`
- `trailing 150`
- `breakeven 100 10`
- `raw {"action":"get_account"}`

## Commands The EA Currently Accepts

- `trade`
- `modify_order`
- `cancel_order`
- `close_trade`
- `close_partial`
- `close_all`
- `subscribe_symbol`
- `unsubscribe_symbol`
- `set_timeframe`
- `get_account`
- `get_positions`
- `get_orders`
- `get_history`
- `get_symbols`
- `set_trailing_stop`
- `set_break_even`

## Raw JSON Examples

Market order:

```txt
raw {"action":"trade","symbol":"EURUSD","side":"buy","order_kind":"market","lot_size":0.01,"deviation":10}
```

Pending order:

```txt
raw {"action":"trade","symbol":"EURUSD","side":"buy_limit","order_kind":"pending","lot_size":0.01,"price":1.0700,"sl":1.0680,"tp":1.0760}
```

Modify open position:

```txt
raw {"action":"modify_order","target":"position","ticket":123456789,"sl":1.0710,"tp":1.0790}
```

Delete pending order:

```txt
raw {"action":"cancel_order","ticket":123456789}
```

Close position:

```txt
raw {"action":"close_trade","ticket":123456789}
```

Partial close:

```txt
raw {"action":"close_partial","ticket":123456789,"lot_size":0.01}
```

Get history:

```txt
raw {"action":"get_history","symbol":"EURUSD","timeframe":"M15","count":200}
```

Enable trailing stop:

```txt
raw {"action":"set_trailing_stop","enabled":true,"points":150}
```

Enable break even:

```txt
raw {"action":"set_break_even","enabled":true,"trigger_points":100,"lock_points":10}
```

When the EA connects, the server automatically sends:

- `get_account`
- `get_symbols`

## Verifying That Node Really Sent A Command

When a command is written to the EA socket, the server prints:

```txt
SENT -> {"request_id":"req-...","action":"get_account","api_key":"change-me"}
```

When the EA replies, the server prints:

```txt
RECV <- {"type":"command_result",...}
```

Use `status` to confirm the TCP socket is still writable before sending commands.
