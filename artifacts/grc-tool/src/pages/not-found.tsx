import { Link } from "wouter"

export default function NotFound() {
  return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight">404</h1>
      <p className="text-lg text-muted-foreground">Page not found</p>
      <Link href="/" className="text-primary hover:underline mt-4">
        Return to Dashboard
      </Link>
    </div>
  )
}
