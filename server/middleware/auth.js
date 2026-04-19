const jwt = require('jsonwebtoken');
const User = require('../models/User');

const DEFAULT_CLAUDE_SCOPES = ['tasks:read', 'tasks:write', 'projects:read', 'users:read', 'documents:read', 'documents:write', 'portfolio:read'];

const getApiKeyFromRequest = (req) => {
  const xApiKey = req.header('X-API-Key') || req.header('x-api-key');
  if (xApiKey) return xApiKey.trim();

  const authHeader = req.header('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const bearerValue = authHeader.slice(7).trim();
  const looksLikeJwt = bearerValue.split('.').length === 3;
  return looksLikeJwt ? null : bearerValue;
};

const getClaudeScopes = () => {
  const raw = (process.env.CLAUDE_API_SCOPES || '').trim();
  if (!raw) return DEFAULT_CLAUDE_SCOPES;

  return raw
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
};

const ensureClaudeIntegrationUser = async () => {
  const email = (process.env.CLAUDE_API_USER_EMAIL || 'claude-api@soft-synergy.local').trim().toLowerCase();
  let user = await User.findOne({ email });

  if (!user) {
    user = new User({
      email,
      password: `claude-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      firstName: 'Claude',
      lastName: 'API',
      role: 'employee',
      isActive: true
    });
    await user.save();
    return user;
  }

  let shouldSave = false;
  if (!user.isActive) {
    user.isActive = true;
    shouldSave = true;
  }
  if (user.role !== 'employee') {
    user.role = 'employee';
    shouldSave = true;
  }

  if (shouldSave) {
    await user.save();
  }

  return user;
};

const auth = async (req, res, next) => {
  try {
    const apiKey = getApiKeyFromRequest(req);
    const expectedApiKey = (process.env.CLAUDE_API_KEY || '').trim();

    if (apiKey && expectedApiKey && apiKey === expectedApiKey) {
      const user = await ensureClaudeIntegrationUser();
      req.user = user;
      req.authType = 'api_key';
      req.authScopes = getClaudeScopes();
      return next();
    }

    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Brak tokenu autoryzacji' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Użytkownik nie istnieje lub jest nieaktywny' });
    }

    req.user = user;
    req.authType = 'jwt';
    req.authScopes = ['*'];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Nieprawidłowy token autoryzacji' });
  }
};

const requireScope = (requiredScopes) => {
  const scopes = Array.isArray(requiredScopes) ? requiredScopes : [requiredScopes];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Brak autoryzacji' });
    }

    if (req.authType !== 'api_key') {
      return next();
    }

    const grantedScopes = Array.isArray(req.authScopes) ? req.authScopes : [];
    const hasAllScopes = scopes.every((scope) => grantedScopes.includes(scope) || grantedScopes.includes('*'));

    if (!hasAllScopes) {
      return res.status(403).json({ message: 'Ten klucz API nie ma uprawnień do wykonania tej operacji' });
    }

    next();
  };
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Brak autoryzacji' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Brak uprawnień do wykonania tej operacji' });
    }

    next();
  };
};

module.exports = { auth, requireRole, requireScope };
