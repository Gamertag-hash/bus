"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const jwtSecret = process.env.JWT_SECRET || 'secret';
const authenticate = (req, res, next) => {
    const authReq = req;
    const token = authReq.cookies?.token || authReq.headers.authorization?.split(' ')[1];
    if (!token)
        return res.status(401).json({ message: 'Unauthorized' });
    try {
        const payload = jsonwebtoken_1.default.verify(token, jwtSecret);
        authReq.user = payload;
        next();
    }
    catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};
exports.authenticate = authenticate;
const authorize = (roles) => (req, res, next) => {
    const authReq = req;
    if (!authReq.user)
        return res.status(401).json({ message: 'Unauthorized' });
    if (!roles.includes(authReq.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    next();
};
exports.authorize = authorize;
//# sourceMappingURL=middleware.js.map