// Minimal RFC 6455 WebSocket server implementation.
//
// The project is deliberately dependency-free (the client has no npm packages
// and no CDN links), so rather than pulling in `ws` we implement the small
// subset of the WebSocket protocol this app needs:
//
//   * the HTTP Upgrade handshake (Sec-WebSocket-Accept)
//   * text frame decoding (client -> server, masked)
//   * text frame encoding (server -> client, unmasked)
//   * ping/pong keepalive
//   * close frames
//
// Fragmentation and binary frames are not needed by the app and are handled
// defensively (binary frames are ignored; continuation frames are buffered).

"use strict";

const crypto = require("crypto");
const { EventEmitter } = require("events");

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const OPCODE = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa,
};

/**
 * A single connected WebSocket client.
 */
class WebSocketConnection extends EventEmitter {
  /**
   * @param {import('net').Socket} socket
   * @param {object} meta  Arbitrary metadata (e.g. remote address).
   */
  constructor(socket, meta) {
    super();
    this.socket = socket;
    this.meta = meta || {};
    this.closed = false;
    this._buffer = Buffer.alloc(0);
    this._fragments = [];
    this._fragmentOpcode = null;
    this._isAlive = true;

    socket.on("data", (chunk) => this._onData(chunk));
    socket.on("close", () => this._onClose());
    socket.on("error", () => this._onClose());
    socket.on("end", () => this._onClose());
  }

  /** Send a text message (JSON string). */
  send(data) {
    if (this.closed) return false;
    const payload = Buffer.from(String(data), "utf8");
    return this._sendFrame(OPCODE.TEXT, payload);
  }

  /** Send a ping frame. */
  ping() {
    if (this.closed) return false;
    return this._sendFrame(OPCODE.PING, Buffer.alloc(0));
  }

  /** Send a close frame and end the socket. */
  close(code, reason) {
    if (this.closed) return;
    const codeBuf = Buffer.alloc(2);
    codeBuf.writeUInt16BE(typeof code === "number" ? code : 1000, 0);
    const reasonBuf = Buffer.from(reason || "", "utf8");
    this._sendFrame(OPCODE.CLOSE, Buffer.concat([codeBuf, reasonBuf]));
    this.closed = true;
    try {
      this.socket.end();
    } catch (e) {
      /* ignore */
    }
  }

  _sendFrame(opcode, payload) {
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 127;
      header.writeUInt32BE(0, 2);
      header.writeUInt32BE(len, 6);
    }
    header[0] = 0x80 | opcode; // FIN + opcode
    try {
      this.socket.write(Buffer.concat([header, payload]));
      return true;
    } catch (e) {
      this._onClose();
      return false;
    }
  }

  _onData(chunk) {
    this._buffer = Buffer.concat([this._buffer, chunk]);
    // Decode as many complete frames as are buffered.
    for (;;) {
      const frame = this._decodeFrame();
      if (!frame) break;
      this._handleFrame(frame);
    }
  }

  _decodeFrame() {
    const buf = this._buffer;
    if (buf.length < 2) return null;

    const b0 = buf[0];
    const b1 = buf[1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let payloadLen = b1 & 0x7f;
    let offset = 2;

    if (payloadLen === 126) {
      if (buf.length < offset + 2) return null;
      payloadLen = buf.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLen === 127) {
      if (buf.length < offset + 8) return null;
      const high = buf.readUInt32BE(offset);
      const low = buf.readUInt32BE(offset + 4);
      payloadLen = high * 0x100000000 + low;
      offset += 8;
    }

    let maskKey = null;
    if (masked) {
      if (buf.length < offset + 4) return null;
      maskKey = buf.slice(offset, offset + 4);
      offset += 4;
    }

    if (buf.length < offset + payloadLen) return null;

    let payload = buf.slice(offset, offset + payloadLen);
    if (masked && maskKey) {
      const unmasked = Buffer.alloc(payloadLen);
      for (let i = 0; i < payloadLen; i++) {
        unmasked[i] = payload[i] ^ maskKey[i % 4];
      }
      payload = unmasked;
    }

    // Consume the frame from the buffer.
    this._buffer = buf.slice(offset + payloadLen);
    return { fin: fin, opcode: opcode, payload: payload };
  }

  _handleFrame(frame) {
    const { fin, opcode, payload } = frame;

    if (opcode === OPCODE.CLOSE) {
      this.close(1000, "");
      return;
    }
    if (opcode === OPCODE.PING) {
      this._sendFrame(OPCODE.PONG, payload);
      return;
    }
    if (opcode === OPCODE.PONG) {
      this._isAlive = true;
      return;
    }
    if (opcode === OPCODE.BINARY) {
      // Not used by the app; ignore.
      return;
    }

    if (opcode === OPCODE.CONTINUATION) {
      this._fragments.push(payload);
      if (fin) {
        const full = Buffer.concat(this._fragments);
        const op = this._fragmentOpcode;
        this._fragments = [];
        this._fragmentOpcode = null;
        if (op === OPCODE.TEXT) this._emitMessage(full.toString("utf8"));
      }
      return;
    }

    if (opcode === OPCODE.TEXT) {
      if (!fin) {
        this._fragmentOpcode = OPCODE.TEXT;
        this._fragments = [payload];
        return;
      }
      this._emitMessage(payload.toString("utf8"));
    }
  }

  _emitMessage(text) {
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = null;
    }
    this.emit("message", text, parsed);
  }

  _onClose() {
    if (this.closed) return;
    this.closed = true;
    this.emit("close");
  }
}

/**
 * Attach a WebSocket server to an existing Node http.Server.
 *
 * @param {import('http').Server} httpServer
 * @param {object} [options]
 * @param {string} [options.path]  Only upgrade requests on this path.
 * @param {function(WebSocketConnection): void} [options.onConnection]
 * @returns {{ clients: Set<WebSocketConnection>, broadcast: function(string): number, close: function(): void }}
 */
function attachWebSocketServer(httpServer, options) {
  const opts = options || {};
  const upgradePath = opts.path || "/ws";
  const clients = new Set();

  httpServer.on("upgrade", (req, socket) => {
    const url = req.url || "";
    const pathname = url.split("?")[0];
    if (pathname !== upgradePath) {
      socket.destroy();
      return;
    }

    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }

    const accept = crypto
      .createHash("sha1")
      .update(key + GUID)
      .digest("base64");

    const headers = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      "Sec-WebSocket-Accept: " + accept,
      "\r\n",
    ];
    socket.write(headers.join("\r\n"));

    const conn = new WebSocketConnection(socket, {
      remoteAddress: req.socket.remoteAddress,
    });
    clients.add(conn);
    conn.on("close", () => clients.delete(conn));

    if (typeof opts.onConnection === "function") {
      try {
        opts.onConnection(conn);
      } catch (err) {
        console.error("[ws] onConnection error:", err);
      }
    }
  });

  // Keepalive: ping every 30s, drop clients that did not pong.
  const interval = setInterval(() => {
    clients.forEach((conn) => {
      if (conn.closed) {
        clients.delete(conn);
        return;
      }
      if (conn._isAlive === false) {
        conn.close(1001, "keepalive timeout");
        clients.delete(conn);
        return;
      }
      conn._isAlive = false;
      conn.ping();
    });
  }, 30000);
  if (interval.unref) interval.unref();

  function broadcast(text) {
    let sent = 0;
    clients.forEach((conn) => {
      if (!conn.closed && conn.send(text)) sent++;
    });
    return sent;
  }

  function close() {
    clearInterval(interval);
    clients.forEach((conn) => conn.close(1001, "server shutting down"));
    clients.clear();
  }

  return { clients: clients, broadcast: broadcast, close: close };
}

module.exports = {
  attachWebSocketServer: attachWebSocketServer,
  WebSocketConnection: WebSocketConnection,
  OPCODE: OPCODE,
};
