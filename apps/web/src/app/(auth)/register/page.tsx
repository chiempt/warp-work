import type { Metadata } from "next"

import { RegisterForm } from "@/components/warp/register-form"

export const metadata: Metadata = {
  title: "Create your account · Warp",
}

export default function RegisterPage() {
  return <RegisterForm />
}
