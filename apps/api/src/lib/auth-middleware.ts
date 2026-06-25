import type { Request, Response, NextFunction } from "express";
import { decode } from "next-auth/jwt";
import { getCurrentConfig, loadUserConfig } from "./config-store.js";

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
    const cookieHeader = request.headers.cookie;
    const cookies = parseCookies(cookieHeader);
    const cookieNames = Object.keys(cookies);
    
    console.log(`[AUTH-DEBUG] Incoming Request:
Method: ${request.method}
Path: ${request.path}
Origin: ${request.headers.origin ?? request.headers.referer ?? "none"}
Cookie header present?: ${cookieHeader !== undefined}
Cookie length: ${cookieHeader ? cookieHeader.length : 0}
Cookie names: ${cookieNames.join(", ") || "none"}`);

    const stdToken = cookies["next-auth.session-token"];
    const secureToken = cookies["__Secure-next-auth.session-token"];
    
    console.log(`[AUTH-DEBUG] Cookie Detection:
next-auth.session-token: ${stdToken ? `Found (length: ${stdToken.length})` : "Missing"}
__Secure-next-auth.session-token: ${secureToken ? `Found (length: ${secureToken.length})` : "Missing"}`);

    const tokenString = stdToken || secureToken;
    
    if (tokenString) {
      console.log("[AUTH-DEBUG] Attempting decode...");
      try {
        const decoded = await decode({
          token: tokenString,
          secret: process.env.NEXTAUTH_SECRET ?? ""
        });
        
        if (decoded) {
          console.log("[AUTH-DEBUG] Decode succeeded");
          console.log(`[AUTH-DEBUG] Session decoded:
sub: ${decoded.sub}
email: ${decoded.email}
exp: ${decoded.exp}`);
          
          if (decoded.sub) {
            request.userId = decoded.sub;
            await loadUserConfig(request.userId);
          }
        } else {
          console.log("[AUTH-DEBUG] Decode failed: decoded payload is null/undefined");
        }
      } catch (err: any) {
        console.log(`[AUTH-DEBUG] Decode failed: ${err?.message || err}`);
      }
    } else {
      console.log("[AUTH-DEBUG] No session token found in cookies.");
    }
    
    const isAuthenticated = !!request.userId;
    const isHealth = request.path === "/health";
    const isGetConfig = request.path === "/config" && request.method === "GET";
    const isProtected = config.auth.enabled && !isHealth && !isGetConfig;
    const isRouteAllowed = !isProtected || isAuthenticated;

    console.log(`[AUTH-DEBUG] Authorization:
request.userId: ${request.userId ?? "undefined"}
authenticated: ${isAuthenticated}
route allowed: ${isRouteAllowed}
401 reason: ${!isRouteAllowed ? (isAuthenticated ? "None" : "Missing or invalid session cookie") : "N/A"}`);

    // Log for specific routes entered before any business logic
    const matchedPath = request.path;
    const isTargetRoute = matchedPath.startsWith("/export/zip") || 
                          matchedPath.startsWith("/export/github") || 
                          matchedPath.startsWith("/integrations") || 
                          matchedPath.startsWith("/i18n/generate");
    
    if (isTargetRoute) {
      console.log(`[AUTH-DEBUG] Route entered:
Authenticated user: ${isAuthenticated ? "yes" : "no"}
User id: ${request.userId ?? "none"}
Route entered: ${matchedPath}`);
    }

    // If auth is enabled in config, enforce session presence
    if (config.auth.enabled) {
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
