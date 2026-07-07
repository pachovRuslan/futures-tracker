import { NextRequest, NextResponse } from "next/server";

// Простая Basic Auth защита — приложение single-user, полноценный логин не нужен.
// Логин/пароль задаются в APP_BASIC_AUTH_USER / APP_BASIC_AUTH_PASSWORD.
export function middleware(req: NextRequest) {
  const expectedUser = process.env.APP_BASIC_AUTH_USER;
  const expectedPass = process.env.APP_BASIC_AUTH_PASSWORD;

  // Если пароль не задан — считаем, что защита осознанно отключена (dev-режим)
  if (!expectedUser || !expectedPass) return NextResponse.next();

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
    const [user, pass] = decoded.split(":");
    if (user === expectedUser && pass === expectedPass) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Auth required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="futures-tracker"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
