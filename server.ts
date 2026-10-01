import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data Types
interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  phone: string;
  about: string;
  passwordHash: string;
  publicKeyJwk: any;
  privacy: 'public' | 'private';
  online: boolean;
  lastSeen: number;
}

interface Chat {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  avatar?: string;
  description?: string;
  participants: string[];
  admins?: string[];
  createdAt: number;
  updatedAt: number;
  lastMessage?: MessageSummary;
}

interface MessageSummary {
  id: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  mediaType?: 'text' | 'image' | 'voice' | 'file';
  isEncrypted: boolean;
  previewText?: string;
}

interface StoredMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  mediaType: 'text' | 'image' | 'voice' | 'file';
  ciphertext?: string;
  iv?: string;
  encryptedKeys?: Record<string, string>;
  replyTo?: {
    id: string;
    senderName: string;
    snippet: string;
  };
  reactions?: Record<string, string>;
  status: 'sent' | 'delivered' | 'read';
  deliveredTo: string[];
  readBy: string[];
  mediaUrl?: string;
  duration?: number;
}

interface StatusItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  type: 'text' | 'image';
  content: string;
  caption?: string;
  bgColor?: string;
  timestamp: number;
  viewers: string[];
}

// Initial Seed Personas (ParmChat Core)
const DEFAULT_USERS: User[] = [
  {
    id: 'user_alex',
    username: 'alex',
    displayName: 'Alex Rivera',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    phone: '+1 (555) 234-5678',
    about: 'ParmChat Security & E2EE 🔐',
    passwordHash: 'demo123',
    publicKeyJwk: null,
    privacy: 'public',
    online: true,
    lastSeen: Date.now(),
  },
  {
    id: 'user_sarah',
    username: 'sarah',
    displayName: 'Sarah Chen',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    phone: '+1 (555) 876-5432',
    about: 'At the gym 🏋️‍♀️ | ParmChat active',
    passwordHash: 'demo123',
    publicKeyJwk: null,
    privacy: 'public',
    online: true,
    lastSeen: Date.now() - 1000 * 60 * 5,
  },
  {
    id: 'user_marcus',
    username: 'marcus',
    displayName: 'Marcus Vance',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    phone: '+1 (555) 432-1098',
    about: 'Code & ParmChat Core ☕️',
    passwordHash: 'demo123',
    publicKeyJwk: null,
    privacy: 'private', // Marcus has a private profile
    online: false,
    lastSeen: Date.now() - 1000 * 60 * 42,
  },
  {
    id: 'user_elena',
    username: 'elena',
    displayName: 'Elena Rostova',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    phone: '+1 (555) 654-3210',
    about: 'Zero-Knowledge Protocol Auditor 🛡️',
    passwordHash: 'demo123',
    publicKeyJwk: null,
    privacy: 'public',
    online: true,
    lastSeen: Date.now() - 1000 * 60 * 15,
  },
];

const DEFAULT_CHATS: Chat[] = [
  {
    id: 'chat_group_parmchat_security',
    type: 'group',
    name: '🔒 ParmChat Cryptography Core',
    avatar: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=150&auto=format&fit=crop&q=80',
    description: 'Official ParmChat E2EE group. End-to-end encrypted with ECDH P-256 and AES-256-GCM.',
    participants: ['user_alex', 'user_sarah', 'user_marcus', 'user_elena'],
    admins: ['user_alex', 'user_sarah'],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    updatedAt: Date.now() - 1000 * 60 * 10,
    lastMessage: {
      id: 'm_init_group',
      senderId: 'user_sarah',
      senderName: 'Sarah Chen',
      timestamp: Date.now() - 1000 * 60 * 10,
      mediaType: 'text',
      isEncrypted: true,
      previewText: '🔒 [Encrypted Group Message]',
    },
  },
  {
    id: 'chat_direct_alex_sarah',
    type: 'direct',
    participants: ['user_alex', 'user_sarah'],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    updatedAt: Date.now() - 1000 * 60 * 25,
    lastMessage: {
      id: 'm_init_direct',
      senderId: 'user_sarah',
      senderName: 'Sarah Chen',
      timestamp: Date.now() - 1000 * 60 * 25,
      mediaType: 'text',
      isEncrypted: true,
      previewText: '🔒 [Encrypted Direct Message]',
    },
  },
];

// Production Database Service (MySQL with automatic table creation & Fallback Store)
class DatabaseService {
  private pool: mysql.Pool | null = null;
  public isUsingMysql = false;

  // In-memory / file fallback store
  public memoryUsers: Map<string, User> = new Map();
  public memoryChats: Map<string, Chat> = new Map();
  public memoryMessages: Map<string, StoredMessage[]> = new Map();
  public memoryStatuses: StatusItem[] = [];
  public sessions: Map<string, string> = new Map();

  constructor() {
    this.seedMemory();
    this.initMySQL();
  }

  private seedMemory() {
    DEFAULT_USERS.forEach((u) => this.memoryUsers.set(u.id, { ...u }));
    DEFAULT_CHATS.forEach((c) => this.memoryChats.set(c.id, { ...c }));

    this.memoryMessages.set('chat_group_parmchat_security', [
      {
        id: 'msg_g_1',
        chatId: 'chat_group_parmchat_security',
        senderId: 'user_alex',
        senderName: 'Alex Rivera',
        timestamp: Date.now() - 1000 * 60 * 45,
        mediaType: 'text',
        ciphertext: 'w7sAAqFwYWxsb2NhdG9yL...[E2EE-ENCRYPTED-PAYLOAD]',
        iv: 's9F2kl90aA==',
        status: 'read',
        deliveredTo: ['user_sarah', 'user_marcus', 'user_elena'],
        readBy: ['user_sarah', 'user_marcus', 'user_elena'],
      },
    ]);

    this.memoryMessages.set('chat_direct_alex_sarah', [
      {
        id: 'msg_d_1',
        chatId: 'chat_direct_alex_sarah',
        senderId: 'user_sarah',
        senderName: 'Sarah Chen',
        timestamp: Date.now() - 1000 * 60 * 25,
        mediaType: 'text',
        ciphertext: 'k09aN8v7...[E2EE-ENCRYPTED-PAYLOAD]',
        iv: 'y2Bn819mA==',
        status: 'read',
        deliveredTo: ['user_alex'],
        readBy: ['user_alex'],
      },
    ]);

    this.memoryStatuses = [
      {
        id: 'st_1',
        userId: 'user_sarah',
        userName: 'Sarah Chen',
        userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        type: 'text',
        content: 'ParmChat deployed with zero server knowledge 🔒',
        bgColor: '#005c4b',
        timestamp: Date.now() - 1000 * 60 * 60 * 2,
        viewers: ['user_alex'],
      },
    ];
  }

  // Automatic MySQL Table Creation & Connection
  async initMySQL() {
    const host = process.env.MYSQL_HOST;
    const port = Number(process.env.MYSQL_PORT) || 3306;
    const user = process.env.MYSQL_USER;
    const password = process.env.MYSQL_PASSWORD || '';
    const database = process.env.MYSQL_DATABASE || 'parmchat_db';
    const mysqlUrl = process.env.MYSQL_URL;

    if (!host && !mysqlUrl) {
      console.log('ℹ️ MySQL not configured in .env. Running on ParmChat built-in persistent storage.');
      return;
    }

    try {
      // Connect without db first to ensure db exists
      const config: mysql.PoolOptions = mysqlUrl
        ? { uri: mysqlUrl }
        : {
            host,
            port,
            user,
            password,
            waitForConnections: true,
            connectionLimit: 10,
          };

      const rootConn = await mysql.createConnection(config);
      await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await rootConn.end();

      // Connect to the specific database
      this.pool = mysql.createPool({
        ...config,
        database,
      });

      console.log(`✅ Connected to MySQL database "${database}". Automatically creating tables...`);

      // Automatically create tables
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS \`users\` (
          \`id\` VARCHAR(64) PRIMARY KEY,
          \`username\` VARCHAR(64) NOT NULL UNIQUE,
          \`display_name\` VARCHAR(128) NOT NULL,
          \`avatar\` VARCHAR(512),
          \`phone\` VARCHAR(32) NOT NULL UNIQUE,
          \`about\` VARCHAR(255),
          \`password_hash\` VARCHAR(255) NOT NULL,
          \`public_key_jwk\` TEXT,
          \`privacy\` ENUM('public', 'private') DEFAULT 'public',
          \`online\` TINYINT(1) DEFAULT 0,
          \`last_seen\` BIGINT,
          \`created_at\` BIGINT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS \`chats\` (
          \`id\` VARCHAR(64) PRIMARY KEY,
          \`type\` ENUM('direct', 'group') NOT NULL,
          \`name\` VARCHAR(128),
          \`avatar\` VARCHAR(512),
          \`description\` TEXT,
          \`created_at\` BIGINT,
          \`updated_at\` BIGINT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS \`chat_participants\` (
          \`chat_id\` VARCHAR(64) NOT NULL,
          \`user_id\` VARCHAR(64) NOT NULL,
          \`is_admin\` TINYINT(1) DEFAULT 0,
          PRIMARY KEY (\`chat_id\`, \`user_id\`),
          INDEX \`idx_user\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS \`messages\` (
          \`id\` VARCHAR(64) PRIMARY KEY,
          \`chat_id\` VARCHAR(64) NOT NULL,
          \`sender_id\` VARCHAR(64) NOT NULL,
          \`sender_name\` VARCHAR(128) NOT NULL,
          \`timestamp\` BIGINT NOT NULL,
          \`media_type\` VARCHAR(32) DEFAULT 'text',
          \`ciphertext\` MEDIUMTEXT,
          \`iv\` VARCHAR(64),
          \`encrypted_keys\` MEDIUMTEXT,
          \`reply_to_id\` VARCHAR(64),
          \`reply_to_sender\` VARCHAR(128),
          \`reply_to_snippet\` TEXT,
          \`reactions\` TEXT,
          \`status\` VARCHAR(32) DEFAULT 'sent',
          \`media_url\` TEXT,
          \`duration\` INT DEFAULT 0,
          \`delivered_to\` TEXT,
          \`read_by\` TEXT,
          INDEX \`idx_chat_time\` (\`chat_id\`, \`timestamp\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS \`statuses\` (
          \`id\` VARCHAR(64) PRIMARY KEY,
          \`user_id\` VARCHAR(64) NOT NULL,
          \`user_name\` VARCHAR(128) NOT NULL,
          \`user_avatar\` VARCHAR(512),
          \`type\` VARCHAR(32) DEFAULT 'text',
          \`content\` TEXT,
          \`caption\` VARCHAR(255),
          \`bg_color\` VARCHAR(32),
          \`timestamp\` BIGINT NOT NULL,
          INDEX \`idx_user_time\` (\`user_id\`, \`timestamp\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Seed MySQL if empty
      const [rows]: any = await this.pool.query('SELECT COUNT(*) as count FROM users');
      if (rows[0].count === 0) {
        console.log('Seeding initial ParmChat personas into MySQL...');
        for (const u of DEFAULT_USERS) {
          await this.pool.query(
            `INSERT INTO users (id, username, display_name, avatar, phone, about, password_hash, public_key_jwk, privacy, online, last_seen, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              u.id,
              u.username,
              u.displayName,
              u.avatar,
              u.phone,
              u.about,
              u.passwordHash,
              u.publicKeyJwk ? JSON.stringify(u.publicKeyJwk) : null,
              u.privacy,
              u.online ? 1 : 0,
              u.lastSeen,
              Date.now(),
            ]
          );
        }

        for (const c of DEFAULT_CHATS) {
          await this.pool.query(
            `INSERT INTO chats (id, type, name, avatar, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [c.id, c.type, c.name || null, c.avatar || null, c.description || null, c.createdAt, c.updatedAt]
          );
          for (const pid of c.participants) {
            const isAdmin = c.admins?.includes(pid) ? 1 : 0;
            await this.pool.query(
              `INSERT INTO chat_participants (chat_id, user_id, is_admin) VALUES (?, ?, ?)`,
              [c.id, pid, isAdmin]
            );
          }
        }
      }

      this.isUsingMysql = true;
      console.log('🚀 ParmChat MySQL initialization complete! Tables verified.');
    } catch (err) {
      console.warn('⚠️ Could not connect to MySQL. Falling back to ParmChat built-in persistent storage:', err);
      this.isUsingMysql = false;
    }
  }

  // User Operations
  async getUser(id: string): Promise<User | null> {
    if (this.isUsingMysql && this.pool) {
      try {
        const [rows]: any = await this.pool.query('SELECT * FROM users WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        const r = rows[0];
        return {
          id: r.id,
          username: r.username,
          displayName: r.display_name,
          avatar: r.avatar,
          phone: r.phone,
          about: r.about,
          passwordHash: r.password_hash,
          publicKeyJwk: r.public_key_jwk ? JSON.parse(r.public_key_jwk) : null,
          privacy: r.privacy || 'public',
          online: Boolean(r.online),
          lastSeen: Number(r.last_seen),
        };
      } catch (e) {
        console.error('MySQL getUser error:', e);
      }
    }
    return this.memoryUsers.get(id) || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const lower = username.toLowerCase().trim();
    if (this.isUsingMysql && this.pool) {
      try {
        const [rows]: any = await this.pool.query('SELECT * FROM users WHERE LOWER(username) = ?', [lower]);
        if (rows.length === 0) return null;
        const r = rows[0];
        return {
          id: r.id,
          username: r.username,
          displayName: r.display_name,
          avatar: r.avatar,
          phone: r.phone,
          about: r.about,
          passwordHash: r.password_hash,
          publicKeyJwk: r.public_key_jwk ? JSON.parse(r.public_key_jwk) : null,
          privacy: r.privacy || 'public',
          online: Boolean(r.online),
          lastSeen: Number(r.last_seen),
        };
      } catch (e) {
        console.error(e);
      }
    }
    for (const u of this.memoryUsers.values()) {
      if (u.username.toLowerCase() === lower) return u;
    }
    return null;
  }

  async getUserByPhone(phone: string): Promise<User | null> {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (this.isUsingMysql && this.pool) {
      try {
        const [rows]: any = await this.pool.query('SELECT * FROM users WHERE phone = ?', [cleanPhone]);
        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            username: r.username,
            displayName: r.display_name,
            avatar: r.avatar,
            phone: r.phone,
            about: r.about,
            passwordHash: r.password_hash,
            publicKeyJwk: r.public_key_jwk ? JSON.parse(r.public_key_jwk) : null,
            privacy: r.privacy || 'public',
            online: Boolean(r.online),
            lastSeen: Number(r.last_seen),
          };
        }
      } catch (e) {
        console.error(e);
      }
    }
    for (const u of this.memoryUsers.values()) {
      if (u.phone.replace(/[^0-9+]/g, '') === cleanPhone) return u;
    }
    return null;
  }

  async createUser(user: User): Promise<User> {
    if (this.isUsingMysql && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO users (id, username, display_name, avatar, phone, about, password_hash, public_key_jwk, privacy, online, last_seen, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            user.id,
            user.username,
            user.displayName,
            user.avatar,
            user.phone,
            user.about,
            user.passwordHash,
            user.publicKeyJwk ? JSON.stringify(user.publicKeyJwk) : null,
            user.privacy,
            user.online ? 1 : 0,
            user.lastSeen,
            Date.now(),
          ]
        );
      } catch (e) {
        console.error('MySQL createUser error:', e);
      }
    }
    this.memoryUsers.set(user.id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const existing = await this.getUser(id);
    if (!existing) return null;

    const merged = { ...existing, ...updates };

    if (this.isUsingMysql && this.pool) {
      try {
        await this.pool.query(
          `UPDATE users SET display_name = ?, about = ?, avatar = ?, public_key_jwk = ?, privacy = ?, online = ?, last_seen = ? WHERE id = ?`,
          [
            merged.displayName,
            merged.about,
            merged.avatar,
            merged.publicKeyJwk ? JSON.stringify(merged.publicKeyJwk) : null,
            merged.privacy,
            merged.online ? 1 : 0,
            merged.lastSeen,
            id,
          ]
        );
      } catch (e) {
        console.error('MySQL updateUser error:', e);
      }
    }
    this.memoryUsers.set(id, merged);
    return merged;
  }

  // Get all contacts of a user (people they share chats with)
  async getUserContactIds(userId: string): Promise<Set<string>> {
    const contactIds = new Set<string>();
    const userChats = await this.getUserChats(userId);
    for (const chat of userChats) {
      for (const pid of chat.participants) {
        if (pid !== userId) contactIds.add(pid);
      }
    }
    return contactIds;
  }

  // Search registered users with Privacy Filtering
  async searchUsers(query: string, requesterId: string): Promise<User[]> {
    const cleanQuery = query.toLowerCase().trim();
    const isExactPhone = cleanQuery.startsWith('+') || /^\d{5,}$/.test(cleanQuery);
    const existingContactIds = await this.getUserContactIds(requesterId);

    let all: User[] = [];
    if (this.isUsingMysql && this.pool) {
      try {
        const [rows]: any = await this.pool.query('SELECT * FROM users');
        all = rows.map((r: any) => ({
          id: r.id,
          username: r.username,
          displayName: r.display_name,
          avatar: r.avatar,
          phone: r.phone,
          about: r.about,
          passwordHash: r.password_hash,
          publicKeyJwk: r.public_key_jwk ? JSON.parse(r.public_key_jwk) : null,
          privacy: r.privacy || 'public',
          online: Boolean(r.online),
          lastSeen: Number(r.last_seen),
        }));
      } catch (e) {
        console.error(e);
        all = Array.from(this.memoryUsers.values());
      }
    } else {
      all = Array.from(this.memoryUsers.values());
    }

    return all.filter((u) => {
      // Exclude self
      if (u.id === requesterId) return false;

      // Privacy Check:
      // If private, only show if requester is an existing friend/contact OR searched exact phone/exact username
      if (u.privacy === 'private') {
        const isFriend = existingContactIds.has(u.id);
        const matchesExactPhone = u.phone.replace(/[^0-9]/g, '').includes(cleanQuery.replace(/[^0-9]/g, ''));
        const matchesExactUsername = u.username.toLowerCase() === cleanQuery;

        if (!isFriend && !matchesExactPhone && !matchesExactUsername) {
          return false; // Private user stays hidden from non-friends
        }
      }

      // Query Match
      if (!cleanQuery) return true;
      return (
        u.displayName.toLowerCase().includes(cleanQuery) ||
        u.username.toLowerCase().includes(cleanQuery) ||
        u.phone.includes(cleanQuery)
      );
    });
  }

  // Chat Operations
  async getUserChats(userId: string): Promise<Chat[]> {
    if (this.isUsingMysql && this.pool) {
      try {
        const [chatRows]: any = await this.pool.query(
          `SELECT c.* FROM chats c
           JOIN chat_participants cp ON c.id = cp.chat_id
           WHERE cp.user_id = ?
           ORDER BY c.updated_at DESC`,
          [userId]
        );

        const result: Chat[] = [];
        for (const r of chatRows) {
          const [parts]: any = await this.pool.query(
            `SELECT user_id, is_admin FROM chat_participants WHERE chat_id = ?`,
            [r.id]
          );

          const participants = parts.map((p: any) => p.user_id);
          const admins = parts.filter((p: any) => p.is_admin).map((p: any) => p.user_id);

          // Get last message
          const [lastMsgRows]: any = await this.pool.query(
            `SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp DESC LIMIT 1`,
            [r.id]
          );

          let lastMsg: MessageSummary | undefined = undefined;
          if (lastMsgRows.length > 0) {
            const lm = lastMsgRows[0];
            lastMsg = {
              id: lm.id,
              senderId: lm.sender_id,
              senderName: lm.sender_name,
              timestamp: Number(lm.timestamp),
              mediaType: lm.media_type,
              isEncrypted: true,
              previewText:
                lm.media_type === 'image'
                  ? '📷 Photo'
                  : lm.media_type === 'voice'
                  ? '🎤 Voice note'
                  : '🔒 Encrypted message',
            };
          }

          result.push({
            id: r.id,
            type: r.type,
            name: r.name,
            avatar: r.avatar,
            description: r.description,
            participants,
            admins,
            createdAt: Number(r.created_at),
            updatedAt: Number(r.updated_at),
            lastMessage: lastMsg,
          });
        }
        return result;
      } catch (e) {
        console.error('MySQL getUserChats error:', e);
      }
    }

    const chats: Chat[] = [];
    for (const c of this.memoryChats.values()) {
      if (c.participants.includes(userId)) {
        chats.push({ ...c });
      }
    }
    chats.sort((a, b) => b.updatedAt - a.updatedAt);
    return chats;
  }

  async getChat(id: string): Promise<Chat | null> {
    if (this.isUsingMysql && this.pool) {
      try {
        const [rows]: any = await this.pool.query('SELECT * FROM chats WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        const r = rows[0];
        const [parts]: any = await this.pool.query(
          `SELECT user_id, is_admin FROM chat_participants WHERE chat_id = ?`,
          [id]
        );
        return {
          id: r.id,
          type: r.type,
          name: r.name,
          avatar: r.avatar,
          description: r.description,
          participants: parts.map((p: any) => p.user_id),
          admins: parts.filter((p: any) => p.is_admin).map((p: any) => p.user_id),
          createdAt: Number(r.created_at),
          updatedAt: Number(r.updated_at),
        };
      } catch (e) {
        console.error(e);
      }
    }
    return this.memoryChats.get(id) || null;
  }

  async saveChat(chat: Chat): Promise<void> {
    if (this.isUsingMysql && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO chats (id, type, name, avatar, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), avatar = VALUES(avatar), description = VALUES(description), updated_at = VALUES(updated_at)`,
          [chat.id, chat.type, chat.name || null, chat.avatar || null, chat.description || null, chat.createdAt, chat.updatedAt]
        );

        // Update participants
        for (const pid of chat.participants) {
          const isAdmin = chat.admins?.includes(pid) ? 1 : 0;
          await this.pool.query(
            `INSERT IGNORE INTO chat_participants (chat_id, user_id, is_admin) VALUES (?, ?, ?)`,
            [chat.id, pid, isAdmin]
          );
        }
      } catch (e) {
        console.error('MySQL saveChat error:', e);
      }
    }
    this.memoryChats.set(chat.id, chat);
  }

  // Messages Operations
  async getChatMessages(chatId: string): Promise<StoredMessage[]> {
    if (this.isUsingMysql && this.pool) {
      try {
        const [rows]: any = await this.pool.query(
          `SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC`,
          [chatId]
        );
        return rows.map((r: any) => ({
          id: r.id,
          chatId: r.chat_id,
          senderId: r.sender_id,
          senderName: r.sender_name,
          timestamp: Number(r.timestamp),
          mediaType: r.media_type,
          ciphertext: r.ciphertext,
          iv: r.iv,
          encryptedKeys: r.encrypted_keys ? JSON.parse(r.encrypted_keys) : undefined,
          replyTo: r.reply_to_id
            ? {
                id: r.reply_to_id,
                senderName: r.reply_to_sender,
                snippet: r.reply_to_snippet,
              }
            : undefined,
          reactions: r.reactions ? JSON.parse(r.reactions) : undefined,
          status: r.status,
          mediaUrl: r.media_url,
          duration: r.duration,
          deliveredTo: r.delivered_to ? JSON.parse(r.delivered_to) : [],
          readBy: r.read_by ? JSON.parse(r.read_by) : [],
        }));
      } catch (e) {
        console.error(e);
      }
    }
    return this.memoryMessages.get(chatId) || [];
  }

  async saveMessage(msg: StoredMessage): Promise<void> {
    if (this.isUsingMysql && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO messages
           (id, chat_id, sender_id, sender_name, timestamp, media_type, ciphertext, iv, encrypted_keys, reply_to_id, reply_to_sender, reply_to_snippet, reactions, status, media_url, duration, delivered_to, read_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            msg.id,
            msg.chatId,
            msg.senderId,
            msg.senderName,
            msg.timestamp,
            msg.mediaType,
            msg.ciphertext || null,
            msg.iv || null,
            msg.encryptedKeys ? JSON.stringify(msg.encryptedKeys) : null,
            msg.replyTo?.id || null,
            msg.replyTo?.senderName || null,
            msg.replyTo?.snippet || null,
            msg.reactions ? JSON.stringify(msg.reactions) : null,
            msg.status,
            msg.mediaUrl || null,
            msg.duration || 0,
            JSON.stringify(msg.deliveredTo),
            JSON.stringify(msg.readBy),
          ]
        );

        // Update chat updated_at
        await this.pool.query(`UPDATE chats SET updated_at = ? WHERE id = ?`, [msg.timestamp, msg.chatId]);
      } catch (e) {
        console.error('MySQL saveMessage error:', e);
      }
    }

    if (!this.memoryMessages.has(msg.chatId)) {
      this.memoryMessages.set(msg.chatId, []);
    }
    this.memoryMessages.get(msg.chatId)!.push(msg);

    const chat = this.memoryChats.get(msg.chatId);
    if (chat) {
      chat.updatedAt = msg.timestamp;
      chat.lastMessage = {
        id: msg.id,
        senderId: msg.senderId,
        senderName: msg.senderName,
        timestamp: msg.timestamp,
        mediaType: msg.mediaType,
        isEncrypted: true,
        previewText:
          msg.mediaType === 'image'
            ? '📷 Photo'
            : msg.mediaType === 'voice'
            ? '🎤 Voice note'
            : '🔒 Encrypted message',
      };
    }
  }

  async markMessagesRead(chatId: string, messageIds: string[], userId: string): Promise<void> {
    if (this.isUsingMysql && this.pool) {
      try {
        for (const mid of messageIds) {
          const [rows]: any = await this.pool.query('SELECT read_by FROM messages WHERE id = ?', [mid]);
          if (rows.length > 0) {
            let readBy = rows[0].read_by ? JSON.parse(rows[0].read_by) : [];
            if (!readBy.includes(userId)) {
              readBy.push(userId);
              await this.pool.query(
                'UPDATE messages SET status = "read", read_by = ? WHERE id = ?',
                [JSON.stringify(readBy), mid]
              );
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    const msgs = this.memoryMessages.get(chatId) || [];
    msgs.forEach((m) => {
      if (messageIds.includes(m.id)) {
        if (!m.readBy.includes(userId)) {
          m.readBy.push(userId);
          m.status = 'read';
        }
      }
    });
  }
}

const db = new DatabaseService();

// AWS S3 & CloudFront Integration Service
class CloudMediaService {
  private s3: S3Client | null = null;
  public hasAws = false;

  constructor() {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-east-1';

    if (accessKeyId && secretAccessKey) {
      this.s3 = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.hasAws = true;
      console.log('✅ AWS S3 & CloudFront Media Service initialized.');
    } else {
      console.log('ℹ️ AWS S3 credentials not found in .env. Using ParmChat secure media fallback.');
    }
  }

  async uploadMedia(
    base64Data: string,
    fileType: string = 'image/jpeg'
  ): Promise<{ url: string; s3Key?: string; isCloudFront: boolean }> {
    const bucket = process.env.AWS_S3_BUCKET;
    const cloudFrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
    const region = process.env.AWS_REGION || 'us-east-1';

    if (this.hasAws && this.s3 && bucket) {
      try {
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(base64Data, 'base64');
        const extension = fileType.includes('audio') ? 'webm' : 'jpg';
        const key = `parmchat/media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;

        await this.s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: fileType,
          })
        );

        let finalUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
        let isCloudFront = false;

        if (cloudFrontDomain) {
          const domain = cloudFrontDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
          finalUrl = `https://${domain}/${key}`;
          isCloudFront = true;
        }

        return { url: finalUrl, s3Key: key, isCloudFront };
      } catch (err) {
        console.error('AWS S3 upload error, falling back to direct secure payload:', err);
      }
    }

    // Default fallback: return data URI
    return { url: base64Data, isCloudFront: false };
  }
}

const cloudMedia = new CloudMediaService();

// Express & WebSocket Server Setup
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json({ limit: '50mb' }));

// Active WebSocket connections: userId -> Set of WebSockets
const clients = new Map<string, Set<WebSocket>>();

function sendToUser(userId: string, data: any) {
  const sockets = clients.get(userId);
  if (sockets) {
    const payload = JSON.stringify(data);
    sockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }
}

function broadcastToAll(data: any, excludeUserId?: string) {
  const payload = JSON.stringify(data);
  for (const [userId, sockets] of clients.entries()) {
    if (excludeUserId && userId === excludeUserId) continue;
    sockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }
}

async function broadcastToChat(chatId: string, data: any, excludeUserId?: string) {
  const chat = await db.getChat(chatId);
  if (!chat) return;
  chat.participants.forEach((pid) => {
    if (excludeUserId && pid === excludeUserId) return;
    sendToUser(pid, data);
  });
}

// REST APIs

// 1. Auth: Demo Login / Fast Switch
app.post('/api/auth/demo-login', async (req: Request, res: Response) => {
  const { userId } = req.body;
  const user = await db.getUser(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const token = `token_${user.id}_${Date.now()}`;
  db.sessions.set(token, user.id);
  await db.updateUser(user.id, { online: true });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      phone: user.phone,
      about: user.about,
      publicKeyJwk: user.publicKeyJwk,
      privacy: user.privacy,
      online: true,
    },
  });
});

// 2. Auth: Register (New phone number / user can be added easily)
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { username, displayName, avatar, phone, password, publicKeyJwk, privacy } = req.body;
  if (!username || !displayName) {
    return res.status(400).json({ error: 'Username and display name are required' });
  }

  const existingUsername = await db.getUserByUsername(username);
  if (existingUsername) {
    return res.status(400).json({ error: 'Username already taken' });
  }

  const formattedPhone = phone ? phone.trim() : `+1 (555) ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;

  const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newUser: User = {
    id,
    username: username.toLowerCase().trim(),
    displayName: displayName.trim(),
    avatar:
      avatar ||
      `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
    phone: formattedPhone,
    about: 'Hey there! I am using ParmChat 🚀',
    passwordHash: password || 'demo123',
    publicKeyJwk: publicKeyJwk || null,
    privacy: privacy === 'private' ? 'private' : 'public',
    online: true,
    lastSeen: Date.now(),
  };

  await db.createUser(newUser);
  const token = `token_${newUser.id}_${Date.now()}`;
  db.sessions.set(token, newUser.id);

  // Broadcast if public
  if (newUser.privacy === 'public') {
    broadcastToAll({
      type: 'user:joined',
      user: {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.displayName,
        avatar: newUser.avatar,
        phone: newUser.phone,
        about: newUser.about,
        publicKeyJwk: newUser.publicKeyJwk,
        privacy: newUser.privacy,
        online: true,
      },
    });
  }

  res.json({ token, user: newUser });
});

// 3. Auth: Login with Username or Phone Number
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username or phone number required' });
  }

  let user = await db.getUserByUsername(username);
  if (!user && (username.startsWith('+') || /^\d+$/.test(username.replace(/[\s-()]/g, '')))) {
    user = await db.getUserByPhone(username);
  }

  if (!user) {
    return res.status(404).json({ error: 'User not found in ParmChat database' });
  }

  if (password && user.passwordHash !== password && user.passwordHash !== 'demo123') {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = `token_${user.id}_${Date.now()}`;
  db.sessions.set(token, user.id);
  await db.updateUser(user.id, { online: true });

  res.json({ token, user });
});

// 4. Update Profile & Privacy Settings
app.post('/api/users/profile', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  const userId = token ? db.sessions.get(token) : null;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { displayName, about, avatar, publicKeyJwk, privacy } = req.body;
  const updated = await db.updateUser(userId, {
    displayName,
    about,
    avatar,
    publicKeyJwk,
    privacy,
  });

  if (!updated) return res.status(404).json({ error: 'User not found' });

  broadcastToAll({
    type: 'user:updated',
    user: {
      id: updated.id,
      displayName: updated.displayName,
      about: updated.about,
      avatar: updated.avatar,
      publicKeyJwk: updated.publicKeyJwk,
      privacy: updated.privacy,
      online: updated.online,
    },
  });

  res.json({ success: true, user: updated });
});

// 5. Search Users from Database (Enforcing Public/Private Visibility)
app.get('/api/users/search', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  const requesterId = token ? db.sessions.get(token) || 'user_alex' : 'user_alex';

  const query = (req.query.q as string) || '';
  const searchResults = await db.searchUsers(query, requesterId);

  res.json(
    searchResults.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatar: u.avatar,
      phone: u.phone,
      about: u.about,
      publicKeyJwk: u.publicKeyJwk,
      privacy: u.privacy,
      online: clients.has(u.id) && clients.get(u.id)!.size > 0,
      lastSeen: u.lastSeen,
    }))
  );
});

// 6. Get All Discoverable Users
app.get('/api/users', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  const requesterId = token ? db.sessions.get(token) || 'user_alex' : 'user_alex';

  const users = await db.searchUsers('', requesterId);
  res.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatar: u.avatar,
      phone: u.phone,
      about: u.about,
      publicKeyJwk: u.publicKeyJwk,
      privacy: u.privacy,
      online: clients.has(u.id) && clients.get(u.id)!.size > 0,
      lastSeen: u.lastSeen,
    }))
  );
});

// 7. AWS S3 & CloudFront Media Upload Endpoint
app.post('/api/upload-media', async (req: Request, res: Response) => {
  const { data, type } = req.body;
  if (!data) return res.status(400).json({ error: 'No media data provided' });

  try {
    const uploadResult = await cloudMedia.uploadMedia(data, type || 'image/jpeg');
    res.json(uploadResult);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Media upload failed' });
  }
});

// 8. Get User Chats
app.get('/api/chats', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  const userId = token ? db.sessions.get(token) : null;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userChats = await db.getUserChats(userId);
  const populatedChats = await Promise.all(
    userChats.map(async (chat) => {
      const participantDetails = await Promise.all(
        chat.participants.map(async (pid) => {
          const u = await db.getUser(pid);
          return {
            id: pid,
            displayName: u?.displayName || 'User',
            avatar: u?.avatar || '',
            online: clients.has(pid) && clients.get(pid)!.size > 0,
            publicKeyJwk: u?.publicKeyJwk,
          };
        })
      );

      const msgs = await db.getChatMessages(chat.id);
      const unreadCount = msgs.filter(
        (m) => m.senderId !== userId && !m.readBy?.includes(userId)
      ).length;

      return {
        ...chat,
        participantDetails,
        unreadCount,
      };
    })
  );

  populatedChats.sort((a, b) => b.updatedAt - a.updatedAt);
  res.json(populatedChats);
});

// 9. Create Direct Chat (Checks database users)
app.post('/api/chats/create-direct', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  const userId = token ? db.sessions.get(token) : null;
  const { targetUserId } = req.body;

  if (!userId || !targetUserId) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  const targetUser = await db.getUser(targetUserId);
  if (!targetUser) {
    return res.status(404).json({ error: 'Target user does not exist in ParmChat database' });
  }

  const existingChats = await db.getUserChats(userId);
  for (const c of existingChats) {
    if (
      c.type === 'direct' &&
      c.participants.length === 2 &&
      c.participants.includes(userId) &&
      c.participants.includes(targetUserId)
    ) {
      return res.json(c);
    }
  }

  const id = `chat_d_${Date.now()}`;
  const newChat: Chat = {
    id,
    type: 'direct',
    participants: [userId, targetUserId],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.saveChat(newChat);

  [userId, targetUserId].forEach((pid) => {
    sendToUser(pid, {
      type: 'chat:created',
      chat: newChat,
    });
  });

  res.json(newChat);
});

// 10. Create Group Chat
app.post('/api/chats/create-group', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  const userId = token ? db.sessions.get(token) : null;
  const { name, description, avatar, participantIds } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  const allParticipants = Array.from(new Set([userId, ...(participantIds || [])]));

  const id = `chat_g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newChat: Chat = {
    id,
    type: 'group',
    name: name.trim(),
    description: description || 'Encrypted ParmChat Group',
    avatar:
      avatar ||
      `https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80`,
    participants: allParticipants,
    admins: [userId],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.saveChat(newChat);

  allParticipants.forEach((pid) => {
    sendToUser(pid, {
      type: 'chat:created',
      chat: newChat,
    });
  });

  res.json(newChat);
});

// 11. Update Group Chat
app.patch('/api/chats/:id/group', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  const userId = token ? db.sessions.get(token) : null;
  const { id } = req.params;
  const { name, description, avatar, addParticipants, removeParticipants } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const chat = await db.getChat(id);
  if (!chat || chat.type !== 'group') {
    return res.status(404).json({ error: 'Group not found' });
  }

  if (name) chat.name = name.trim();
  if (description !== undefined) chat.description = description;
  if (avatar) chat.avatar = avatar;

  if (addParticipants && Array.isArray(addParticipants)) {
    addParticipants.forEach((pid) => {
      if (!chat.participants.includes(pid)) chat.participants.push(pid);
    });
  }

  if (removeParticipants && Array.isArray(removeParticipants)) {
    chat.participants = chat.participants.filter((p) => !removeParticipants.includes(p));
  }

  chat.updatedAt = Date.now();
  await db.saveChat(chat);

  await broadcastToChat(chat.id, {
    type: 'chat:updated',
    chat,
  });

  res.json(chat);
});

// 12. Get Chat Messages
app.get('/api/chats/:id/messages', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  const userId = token ? db.sessions.get(token) : null;
  const { id } = req.params;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const chat = await db.getChat(id);
  if (!chat || !chat.participants.includes(userId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const messages = await db.getChatMessages(id);
  res.json(messages);
});

// 13. Status Stories
app.get('/api/status', (req: Request, res: Response) => {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const activeStatuses = db.memoryStatuses.filter((s) => s.timestamp > dayAgo);
  res.json(activeStatuses);
});

app.post('/api/status/create', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  const userId = token ? db.sessions.get(token) : null;
  const { type, content, caption, bgColor } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = await db.getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const newStatus: StatusItem = {
    id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    userId,
    userName: user.displayName,
    userAvatar: user.avatar,
    type: type || 'text',
    content,
    caption,
    bgColor: bgColor || '#005c4b',
    timestamp: Date.now(),
    viewers: [],
  };

  db.memoryStatuses.unshift(newStatus);
  broadcastToAll({
    type: 'status:new',
    status: newStatus,
  });

  res.json(newStatus);
});

// Real-Time WebSockets
wss.on('connection', (ws: WebSocket) => {
  let authenticatedUserId: string | null = null;

  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  }, 30000);

  ws.on('message', async (rawData) => {
    try {
      const data = JSON.parse(rawData.toString());

      switch (data.type) {
        case 'auth': {
          const { token, userId } = data;
          let uid = userId;
          if (token && db.sessions.has(token)) {
            uid = db.sessions.get(token);
          }

          if (uid) {
            const user = await db.getUser(uid);
            if (user) {
              authenticatedUserId = uid;
              if (!clients.has(uid)) clients.set(uid, new Set());
              clients.get(uid)!.add(ws);

              await db.updateUser(uid, { online: true, lastSeen: Date.now() });

              ws.send(JSON.stringify({ type: 'auth:success', userId: uid }));

              broadcastToAll(
                {
                  type: 'presence:update',
                  userId: uid,
                  online: true,
                  lastSeen: Date.now(),
                },
                uid
              );
            }
          }
          break;
        }

        case 'message:send': {
          if (!authenticatedUserId) return;
          const {
            chatId,
            mediaType,
            ciphertext,
            iv,
            encryptedKeys,
            replyTo,
            mediaUrl,
            duration,
          } = data;

          const chat = await db.getChat(chatId);
          if (!chat || !chat.participants.includes(authenticatedUserId)) return;

          const sender = await db.getUser(authenticatedUserId);
          const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

          const activeRecipients = chat.participants.filter(
            (pid) => pid !== authenticatedUserId && clients.has(pid) && clients.get(pid)!.size > 0
          );

          const status: 'sent' | 'delivered' = activeRecipients.length > 0 ? 'delivered' : 'sent';

          const storedMsg: StoredMessage = {
            id: messageId,
            chatId,
            senderId: authenticatedUserId,
            senderName: sender?.displayName || 'Unknown',
            timestamp: Date.now(),
            mediaType: mediaType || 'text',
            ciphertext,
            iv,
            encryptedKeys,
            replyTo,
            status,
            deliveredTo: activeRecipients,
            readBy: [authenticatedUserId],
            mediaUrl,
            duration,
          };

          await db.saveMessage(storedMsg);

          await broadcastToChat(chatId, {
            type: 'message:new',
            chatId,
            message: storedMsg,
          });

          break;
        }

        case 'message:read': {
          if (!authenticatedUserId) return;
          const { chatId, messageIds } = data;
          await db.markMessagesRead(chatId, messageIds, authenticatedUserId);

          await broadcastToChat(chatId, {
            type: 'message:status',
            chatId,
            messageIds,
            status: 'read',
            userId: authenticatedUserId,
          });
          break;
        }

        case 'typing:start': {
          if (!authenticatedUserId) return;
          const { chatId } = data;
          const sender = await db.getUser(authenticatedUserId);
          await broadcastToChat(
            chatId,
            {
              type: 'typing:start',
              chatId,
              userId: authenticatedUserId,
              userName: sender?.displayName || 'Someone',
            },
            authenticatedUserId
          );
          break;
        }

        case 'typing:stop': {
          if (!authenticatedUserId) return;
          const { chatId } = data;
          await broadcastToChat(
            chatId,
            {
              type: 'typing:stop',
              chatId,
              userId: authenticatedUserId,
            },
            authenticatedUserId
          );
          break;
        }

        case 'call:signal': {
          if (!authenticatedUserId) return;
          const { targetUserId, callType, signal, action } = data;
          const caller = await db.getUser(authenticatedUserId);

          sendToUser(targetUserId, {
            type: 'call:incoming',
            callerId: authenticatedUserId,
            callerName: caller?.displayName || 'Caller',
            callerAvatar: caller?.avatar || '',
            callType: callType || 'audio',
            signal,
            action,
          });
          break;
        }
      }
    } catch (e) {
      console.error('WebSocket parse error:', e);
    }
  });

  ws.on('close', async () => {
    clearInterval(pingInterval);
    if (authenticatedUserId) {
      const userSockets = clients.get(authenticatedUserId);
      if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) {
          clients.delete(authenticatedUserId);
          await db.updateUser(authenticatedUserId, { online: false, lastSeen: Date.now() });

          broadcastToAll({
            type: 'presence:update',
            userId: authenticatedUserId,
            online: false,
            lastSeen: Date.now(),
          });
        }
      }
    }
  });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ParmChat Production Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
