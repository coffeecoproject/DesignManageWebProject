import { createHash, randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
import type { LedgerPrincipal, LedgerRole } from './yhtLedgerDomain.js';
import type { LedgerSqlPool } from './yhtLedgerPostgresRepository.js';

type AccountRow = Record<string, unknown> & {
  id: string; username: string; display_name: string; role: LedgerRole;
  password_salt: string; password_hash: string; enabled: boolean;
};
type SessionRow = Record<string, unknown> & {
  id: string; display_name: string; role: LedgerRole; enabled: boolean;
  csrf_token: string;
};
export type PortalAccount = { id: string; username: string; name: string; role: LedgerRole; enabled: boolean };
export type PortalSession = { principal: LedgerPrincipal; account: PortalAccount; csrfToken: string };
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
function passwordHash(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}
function validatePassword(password: string) {
  if (password.length < 12 || password.length > 256) throw Error('密码长度必须为12至256个字符');
}
export function createPortalAuth(pool: LedgerSqlPool) {
  return {
    async bootstrapManager(username: string, password: string) {
      if (!username || !password) throw Error('请配置YHT_BOOTSTRAP_USER和YHT_BOOTSTRAP_PASSWORD');
      validatePassword(password);
      const found = await pool.query<Record<string, unknown>>('SELECT count(*)::integer AS total FROM yht_portal_accounts');
      if (Number(found.rows[0]?.total ?? 0) !== 0) return false;
      const salt = randomBytes(16).toString('hex');
      // ON CONFLICT only protects the username; bootstrap must be run once in controlled local environment.
      await pool.query(
        "INSERT INTO yht_portal_accounts (id, username, display_name, role, password_salt, password_hash) VALUES ($1,$2,$3,'manager',$4,$5) ON CONFLICT (username) DO NOTHING",
        [randomUUID(), username, '项目负责人', salt, passwordHash(password, salt)]
      );
      return true;
    },
    async login(username: string, password: string): Promise<{sessionToken:string; csrfToken:string; account:PortalAccount} | null> {
      if (typeof username !== 'string' || typeof password !== 'string' || username.length > 100 || password.length > 256) return null;
      const result = await pool.query<AccountRow>(
        'SELECT * FROM yht_portal_accounts WHERE username = $1 AND enabled = true', [username.trim()]
      );
      const user = result.rows[0];
      if (!user) return null;
      const supplied = Buffer.from(passwordHash(password, user.password_salt), 'hex');
      const original = Buffer.from(user.password_hash, 'hex');
      if (supplied.length !== original.length || !timingSafeEqual(supplied, original)) return null;
      const sessionToken = randomBytes(32).toString('base64url');
      const csrfToken = randomBytes(24).toString('base64url');
      await pool.query(
        "INSERT INTO yht_portal_sessions (token_hash, account_id, csrf_token, expires_at) VALUES ($1,$2,$3,now() + interval '12 hours')",
        [hashToken(sessionToken), user.id, csrfToken]
      );
      return {sessionToken, csrfToken, account:{id:user.id,username:user.username,name:user.display_name,role:user.role,enabled:true}};
    },
    async session(token: string | null): Promise<PortalSession | null> {
      if (!token || token.length > 200) return null;
      const result = await pool.query<SessionRow & {username:string}>(
        "SELECT a.id,a.username,a.display_name,a.role,a.enabled,s.csrf_token FROM yht_portal_sessions s JOIN yht_portal_accounts a ON s.account_id = a.id WHERE s.token_hash=$1 AND s.expires_at>now() AND a.enabled=true",
        [hashToken(token)]
      );
      const user = result.rows[0];
      if (!user) return null;
      return {
        principal:{userId:user.id,role:user.role,enabled:user.enabled},
        account:{id:user.id,username:user.username,name:user.display_name,role:user.role,enabled:user.enabled},
        csrfToken:user.csrf_token
      };
    },
    async logout(token: string | null) {
      if (token) await pool.query('DELETE FROM yht_portal_sessions WHERE token_hash=$1', [hashToken(token)]);
    },
    async listAccounts(): Promise<PortalAccount[]> {
      const result = await pool.query<AccountRow>(
        'SELECT id,username,display_name,role,enabled FROM yht_portal_accounts ORDER BY created_at,id'
      );
      return result.rows.map(a => ({id:a.id,username:a.username,name:a.display_name,role:a.role,enabled:a.enabled}));
    },
    async resolveDesigner(id: string) {
      const found = await pool.query<AccountRow>(
        "SELECT id,display_name,role,enabled FROM yht_portal_accounts WHERE id=$1", [id]
      );
      const a=found.rows[0];
      return a ? {id:a.id,name:a.display_name,role:a.role,enabled:a.enabled} : null;
    },
    async createAccount(input: {username:string; name:string; password:string; role:'designer'|'executive'}): Promise<PortalAccount> {
      if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(input.username)) throw Error('账号只能包含3-64位英数字、点、下划线和横线');
      if (!input.name || input.name.length > 100) throw Error('姓名无效');
      if (!['designer','executive'].includes(input.role)) throw Error('角色无效');
      validatePassword(input.password);
      const id=randomUUID();
      const salt=randomBytes(16).toString('hex');
      await pool.query(
        'INSERT INTO yht_portal_accounts (id,username,display_name,role,password_salt,password_hash) VALUES ($1,$2,$3,$4,$5,$6)',
        [id,input.username,input.name.trim(),input.role,salt,passwordHash(input.password,salt)]
      );
      return {id,username:input.username,name:input.name.trim(),role:input.role,enabled:true};
    }
  };
}
