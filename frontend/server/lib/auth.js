import jwt from "jsonwebtoken";

// Falls back to a fixed dev value so local setup needs zero config, but any
// real deployment MUST set JWT_SECRET in server/.env to a random secret —
// anyone who knows the fallback string can forge a valid admin token.
const JWT_SECRET = process.env.JWT_SECRET || "polarops-dev-secret-change-me";
const TOKEN_TTL = "12h";

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing authorization token." });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    next();
  };
}
