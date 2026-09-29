import { login, signup } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>
}) {
  const message = (await searchParams).message

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md shadow-lg border-0 rounded-2xl">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-2xl font-bold text-center tracking-tight text-gray-900">
            Welcome to Tidy
          </CardTitle>
          <CardDescription className="text-center text-gray-500">
            Sign in to your account or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
              <Input 
                id="email" 
                name="email" 
                type="email" 
                placeholder="you@example.com" 
                required 
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
              <Input 
                id="password" 
                name="password" 
                type="password" 
                required 
                className="w-full"
              />
            </div>
            
            {message && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                {message}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <Button type="submit" formAction={login} className="w-full font-medium">
                Log In
              </Button>
              <Button type="submit" formAction={signup} variant="outline" className="w-full font-medium">
                Sign Up
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
