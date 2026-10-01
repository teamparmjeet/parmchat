type EventCallback = (data: any) => void;

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectTimeout: any = null;
  private reconnectAttempts = 0;
  private token: string | null = null;
  private userId: string | null = null;
  private isIntentionallyClosed = false;

  constructor() {
    // bind
  }

  public connect(token: string, userId: string) {
    this.token = token;
    this.userId = userId;
    this.isIntentionallyClosed = false;

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      // Re-authenticate
      this.send({ type: 'auth', token, userId });
      return;
    }

    if (this.socket) {
      this.socket.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.emit('connection:open', {});
        // Send authentication
        this.send({
          type: 'auth',
          token: this.token,
          userId: this.userId,
        });
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type) {
            this.emit(data.type, data);
            this.emit('*', data);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      this.socket.onerror = (error) => {
        this.emit('connection:error', error);
      };

      this.socket.onclose = () => {
        this.emit('connection:close', {});
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.error('Failed to establish WebSocket connection:', err);
      this.scheduleReconnect();
    }
  }

  public send(payload: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    } else {
      // Queue or retry on open
      const onOpen = () => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify(payload));
          this.off('connection:open', onOpen);
        }
      };
      this.on('connection:open', onOpen);
    }
  }

  public on(eventType: string, callback: EventCallback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
    return () => this.off(eventType, callback);
  }

  public off(eventType: string, callback: EventCallback) {
    const set = this.listeners.get(eventType);
    if (set) {
      set.delete(callback);
    }
  }

  private emit(eventType: string, data: any) {
    const set = this.listeners.get(eventType);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in event listener for ${eventType}:`, e);
        }
      });
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      if (this.token && this.userId && !this.isIntentionallyClosed) {
        this.connect(this.token, this.userId);
      }
    }, delay);
  }

  public disconnect() {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export const realtime = new RealtimeClient();
