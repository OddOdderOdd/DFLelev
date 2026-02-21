import crypto from 'crypto';
import { prisma } from '../index.js';

function anonymizeIp(ip = '') {
  return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 16);
}

/**
 * Middleware: Kræver authentication
 */
export async function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  
  if (!token) {
    return res.status(401).json({ fejl: 'Ikke logget ind' });
  }

  try {
    // Find session
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session) {
      return res.status(401).json({ fejl: 'Session ugyldig' });
    }

    // Check if expired
    if (new Date(session.udloeber) < new Date()) {
      await prisma.session.delete({ where: { token } });
      return res.status(401).json({ fejl: 'Session udløbet' });
    }

    // Check if user is active
    if (!session.user.aktiv) {
      return res.status(401).json({ fejl: 'Konto inaktiv' });
    }

    // Attach user to request
    req.user = session.user;
    req.sessionToken = token;
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ fejl: 'Server fejl' });
  }
}

/**
 * Middleware: Kræver admin rettigheder
 */
export async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    try {
      // Check if user has admin authority
      const adminAuthority = await prisma.userAuthority.findFirst({
        where: {
          userId: req.user.id,
          rolle: {
            in: ['Admin', 'Owner']
          }
        }
      });

      if (!adminAuthority) {
        // Log red flag
        await prisma.redFlag.create({
          data: {
            userId: req.user.id,
            grund: 'Forsøgte at tilgå admin uden tilladelse',
            detaljer: JSON.stringify({ 
              endpoint: req.path,
              ipHash: anonymizeIp(req.ip) 
            })
          }
        });

        return res.status(403).json({ fejl: 'Kun for administratorer' });
      }

      next();
    } catch (error) {
      console.error('Admin check error:', error);
      return res.status(500).json({ fejl: 'Server fejl' });
    }
  });
}

/**
 * Helper: Check if user has specific permission
 */
export async function hasPermission(userId, permission) {
  try {
    // Get user authorities
    const authorities = await prisma.userAuthority.findMany({
      where: { userId }
    });

    // Get permissions for those roles
    const permissions = await prisma.permission.findMany({
      where: {
        rolle: {
          in: authorities.map(a => a.rolle)
        }
      }
    });

    // Check if any permission matches
    return permissions.some(p => {
      const perms = JSON.parse(p.rettigheder);
      return perms.includes(permission);
    });
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}
