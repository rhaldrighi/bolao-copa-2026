import { type NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Middleware mínimo — proteção de rotas é feita client-side em cada página
  return NextResponse.next()
}

export const config = {
  matcher: [],   // não intercepta nenhuma rota
}
