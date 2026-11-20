// Génère les clés « anon » et « service_role » signées avec le secret JWT LOCAL.
import { createHmac } from 'node:crypto';
const secret = process.argv[2];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (role) => {
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64({ role, iss: 'teranga-local', iat: 1763600000, exp: 2079200000 });
  const s = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
};
console.log(`ANON_KEY=${sign('anon')}`);
console.log(`SERVICE_ROLE_KEY=${sign('service_role')}`);
