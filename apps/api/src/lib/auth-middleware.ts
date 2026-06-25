import type { Request, Response, NextFunction } from "express";
import { decode } from "next-auth/jwt";
import { getCurrentConfig } from "./config-store.js";

// Extend Request type to hold userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.split("=");
    if (name && rest.length > 0) {
      cookies[name.trim()] = decodeURIComponent(rest.join("=").trim());
    }
  });
  return cookies;
}

export async function authMiddleware(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const config = getCurrentConfig();
    
    // Extract cookies and decode next-auth session token
    const cookies = parseCookies(request.headers.cookie);
    const tokenString = cookies["next-auth.session-token"] || cookies["__Secure-next-auth.session-token"];
    
    if (tokenString) {
      try {
        const decoded = await decode({
          token: tokenString,
          secret: process.env.NEXTAUTH_SECRET ?? ""
        });
        if (decoded?.sub) {
          request.userId = decoded.sub;
        }
      } catch (err) {
        // Token decode failed (expired or invalid signature)
      }
    }
    
    // If auth is enabled in config, enforce session presence
    if (config.auth.enabled) {
      const isHealth = request.path === "/health";
      const isGetConfig = request.path === "/config" && request.method === "GET";
      
      if (!isHealth && !isGetConfig) {
        if (!request.userId) {
          response.status(401).json({
            success: false,
            data: null,
            error: {
              code: "UNAUTHORIZED",
              message: "Authentication required. Invalid or missing session."
            }
          });
          return;
        }
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
}
