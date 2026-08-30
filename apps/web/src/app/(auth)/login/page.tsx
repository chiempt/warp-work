import type { Metadata } from "next"

import { LoginForm } from "@/components/warp/login-form"

export const metadata: Metadata = {
  title: "Sign in · Warp",
}

export default function LoginPage() {
  return <LoginForm />
}
